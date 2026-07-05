import type { PluginInput } from "@opencode-ai/plugin"
import type { OhMyOpenCodeConfig } from "../../config"
import type { AuditLoopHook, AuditLoopState, AuditContext, VerifierVerdict } from "./types"
import { log } from "../../shared/logger"
import { HOOK_NAME, getMaxCycles, isAuditLoopEnabled, shouldSkipVerifier2 } from "./constants"
import { buildFullContext, buildSanitizedContext } from "./sanitized-context-builder"
import { dispatchInternalPrompt } from "../shared/prompt-async-gate"
import { recordFailure } from "../../features/failure-journal"
import {
  createInternalAgentContinuationTextPart,
  isAmbiguousPostDispatchPromptFailure,
  normalizeSDKResponse,
} from "../../shared"
import { resolveRegisteredAgentName } from "../../features/session-state"
import { normalizeAgentForPromptKey, stripAgentListSortPrefix } from "../../shared/agent-display-names"

const COMPLETION_CLAIM_PATTERNS = [
  /\b(?:done|completed|finished)\b/i,
  /\ball (?:tasks?|todos?) (?:are )?complete\b/i,
  /\beverything (?:is )?(?:done|complete|finished)\b/i,
  /\ball (?:items?|checkboxes?) (?:are )?checked\b/i,
  /\bwork (?:is )?(?:complete|done|finished)\b/i,
  /\bimplementation (?:is )?(?:complete|done|finished)\b/i,
  /\btask (?:is )?(?:complete|done|finished)\b/i,
]

const NEGATION_PATTERNS = [
  /\bnot\b/i,
  /\bnever\b/i,
  /\bdidn't\b/i,
  /\bwasn't\b/i,
  /\bisn't\b/i,
  /\bare not\b/i,
  /\bweren't\b/i,
]

type MessageInfo = {
  role?: string
  agent?: string
  model?: { providerID: string; modelID: string; variant?: string }
}

type SessionMessage = {
  info?: MessageInfo
  parts?: Array<{ type?: string; text?: string }>
}

function collectAssistantText(message: SessionMessage): string {
  if (!Array.isArray(message.parts)) return ""
  if (message.info?.role !== "assistant") return ""
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("\n")
}

function detectCompletionClaim(messages: SessionMessage[]): boolean {
  for (const msg of messages) {
    const text = collectAssistantText(msg)
    if (!text) continue
    const hasCompletion = COMPLETION_CLAIM_PATTERNS.some((pattern) => pattern.test(text))
    if (!hasCompletion) continue
    const hasNegation = NEGATION_PATTERNS.some((pattern) => pattern.test(text))
    if (hasNegation) continue
    if (/\?\s*$/.test(text.trim())) continue
    if (/^[^.!?\n]*\?/.test(text.trim())) continue
    return true
  }
  return false
}

function parseVerifierVerdict(text: string): VerifierVerdict {
  const approveMatch = text.match(/VERDICT:\s*\[?(APPROVE|REJECT)\]?/i)
  const approved = approveMatch?.[1]?.toUpperCase() === "APPROVE"

  const issues: string[] = []
  const issueSection = text.match(/(?:Issues Found|Blocking Issues).*?\n([\s\S]*?)(?=\n###|\n##|\n---|\n$)/i)
  if (issueSection?.[1]) {
    const lines = issueSection[1].split("\n").filter((l) => l.trim().match(/^\d+\./))
    issues.push(...lines.map((l) => l.replace(/^\d+\.\s*/, "").trim()))
  }

  const summaryMatch = text.match(/Summary\n([\s\S]*?)(?=\n###|\n##|\n---)/i)
  const summary = summaryMatch?.[1]?.trim() ?? text.slice(0, 200)

  return { approved, summary, issues }
}

function normalizeInheritedAgentForPrompt(agent: string | undefined): string | undefined {
  const resolved = resolveRegisteredAgentName(agent) ?? normalizeAgentForPromptKey(agent)
  if (typeof resolved !== "string") return undefined
  const clean = stripAgentListSortPrefix(resolved).trim()
  return clean || undefined
}

async function spawnVerifierSession(
  ctx: PluginInput,
  agentName: string,
  prompt: string,
  directory: string,
): Promise<{ sessionID?: string; error?: string }> {
  try {
    const agent = normalizeInheritedAgentForPrompt(agentName) ?? agentName

    const result = await dispatchInternalPrompt({
      mode: "async",
      client: ctx.client,
      sessionID: "new",
      source: HOOK_NAME,
      settleMs: 500,
      queueBehavior: "defer",
      input: {
        path: { id: "new" },
        body: {
          agent,
          parts: [createInternalAgentContinuationTextPart(prompt)],
        },
        query: { directory },
      },
    })

    if (result.status === "dispatched") {
      const response = result.response as Record<string, unknown> | undefined
      const sessionID = response?.sessionID as string | undefined
      return { sessionID }
    }

    if (result.status === "failed") {
      if (isAmbiguousPostDispatchPromptFailure(result)) {
        return {}
      }
      return { error: String(result.error) }
    }

    return { error: `Unexpected dispatch status: ${result.status}` }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

async function readSessionMessages(
  ctx: PluginInput,
  sessionID: string,
  directory: string,
  timeoutMs = 30000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs
  const pollInterval = Number(process.env.OMA_AUDIT_POLL_INTERVAL_MS) || 2000

  while (Date.now() < deadline) {
    try {
      const response = await ctx.client.session.messages({
        path: { id: sessionID },
        query: { directory },
      })

      const messages = normalizeSDKResponse(response, [] as SessionMessage[])
      const lastAssistant = [...messages].reverse().find((m) => m.info?.role === "assistant")
      if (lastAssistant) {
        const text = collectAssistantText(lastAssistant)
        if (text && text.length > 50) {
          return text
        }
      }
    } catch {
      // Session might not exist yet, keep polling
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval))
  }

  return ""
}

export function createAuditLoopHook(
  ctx: PluginInput,
  options: {
    pluginConfig: OhMyOpenCodeConfig
    directory: string
  },
): AuditLoopHook {
  const { pluginConfig, directory } = options
  const config = pluginConfig.audit_loop

  let state: AuditLoopState | null = null
  const inFlightSessions = new Set<string>()

  async function handleIdleEvent(props: Record<string, unknown> | undefined): Promise<void> {
    if (!isAuditLoopEnabled(config)) return
    if (!state || !state.active) return

    const eventSessionID = props?.sessionID as string | undefined
    if (!eventSessionID || eventSessionID !== state.sessionID) return
    if (inFlightSessions.has(eventSessionID)) return

    inFlightSessions.add(eventSessionID)
    try {
      await processAuditLoop(eventSessionID)
    } finally {
      inFlightSessions.delete(eventSessionID)
    }
  }

  async function processAuditLoop(sessionID: string): Promise<void> {
    if (!state || !state.active) return

    if (state.cycleCount >= state.maxCycles) {
      log(`[${HOOK_NAME}] Max cycles reached, escalating to human review`, {
        sessionID,
        cycles: state.cycleCount,
      })
      state.active = false
      return
    }

    const messagesResponse = await ctx.client.session.messages({
      path: { id: sessionID },
      query: { directory },
    })

    const messages = normalizeSDKResponse(messagesResponse, [] as SessionMessage[])

    if (!detectCompletionClaim(messages)) return

    log(`[${HOOK_NAME}] Completion claim detected, starting audit cycle`, {
      sessionID,
      cycle: state.cycleCount + 1,
    })

    state.cycleCount++

    const recentMessages = messages.slice(-10)
    const agentClaims = recentMessages
      .filter((m) => m.info?.role === "assistant")
      .map((m) => collectAssistantText(m))
      .join("\n\n")

    const fullContext = buildFullContext({
      originalTask: state.originalTask,
      agentClaims,
      changedFiles: state.changedFiles,
      plan: state.plan,
    })

    log(`[${HOOK_NAME}] Spawning The-Auditor (Verifier 1)`, { sessionID })
    const theAuditorResult = await spawnVerifierSession(ctx, "the-auditor", fullContext, directory)
    if (theAuditorResult.error) {
      log(`[${HOOK_NAME}] The-Auditor spawn failed`, { error: theAuditorResult.error })
      return
    }
    if (theAuditorResult.sessionID) {
      state.theAuditorSessionID = theAuditorResult.sessionID
    }

    const theAuditorText = theAuditorResult.sessionID
      ? await readSessionMessages(ctx, theAuditorResult.sessionID, directory, 60000)
      : ""

    if (!theAuditorText) {
      log(`[${HOOK_NAME}] The-Auditor produced no output`, { sessionID })
      return
    }

    const theAuditorVerdict = parseVerifierVerdict(theAuditorText)
    log(`[${HOOK_NAME}] The-Auditor verdict`, {
      approved: theAuditorVerdict.approved,
      issues: theAuditorVerdict.issues.length,
    })

    let coldEyesVerdict: VerifierVerdict | undefined
    if (!shouldSkipVerifier2(config)) {
      const sanitizedContext = buildSanitizedContext({
        originalTask: state.originalTask,
        changedFiles: state.changedFiles,
      })

      log(`[${HOOK_NAME}] Spawning Cold-Eyes (Verifier 2)`, { sessionID })
      const coldEyesResult = await spawnVerifierSession(ctx, "cold-eyes", sanitizedContext, directory)
      if (coldEyesResult.error) {
        log(`[${HOOK_NAME}] Cold-Eyes spawn failed`, { error: coldEyesResult.error })
      } else {
        if (coldEyesResult.sessionID) {
          state.coldEyesSessionID = coldEyesResult.sessionID
        }

        const coldEyesText = coldEyesResult.sessionID
          ? await readSessionMessages(ctx, coldEyesResult.sessionID, directory, 60000)
          : ""

        if (coldEyesText) {
          coldEyesVerdict = parseVerifierVerdict(coldEyesText)
          log(`[${HOOK_NAME}] Cold-Eyes verdict`, {
            approved: coldEyesVerdict.approved,
            issues: coldEyesVerdict.issues.length,
          })
        }
      }
    }

    const bothApproved = theAuditorVerdict.approved && (coldEyesVerdict?.approved ?? true)

    if (bothApproved) {
      log(`[${HOOK_NAME}] Both verifiers approved`, { sessionID, cycle: state.cycleCount })
      state.active = false
      return
    }

    if (!theAuditorVerdict.approved) {
      for (const issue of theAuditorVerdict.issues) {
        recordFailure({
          sessionId: sessionID,
          filePath: state.changedFiles,
          rootCause: issue,
          pattern: "other",
          fixDescription: theAuditorVerdict.summary,
          reportedBy: "the-auditor",
          resolved: false,
        })
      }
    }

    if (coldEyesVerdict && !coldEyesVerdict.approved) {
      for (const issue of coldEyesVerdict.issues) {
        recordFailure({
          sessionId: sessionID,
          filePath: state.changedFiles,
          rootCause: issue,
          pattern: "other",
          fixDescription: coldEyesVerdict.summary,
          reportedBy: "cold-eyes",
          resolved: false,
        })
      }
    }

    const allIssues = [
      ...theAuditorVerdict.issues.map((i) => `[The-Auditor] ${i}`),
      ...(coldEyesVerdict?.issues.map((i) => `[Cold-Eyes] ${i}`) ?? []),
    ]

    log(`[${HOOK_NAME}] Verifiers found issues`, {
      sessionID,
      theAuditorApproved: theAuditorVerdict.approved,
      coldEyesApproved: coldEyesVerdict?.approved,
      issues: allIssues.length,
    })

    const feedbackPrompt = `## Audit Loop Feedback (Cycle ${state.cycleCount}/${state.maxCycles})

The work verification found issues:

### The-Auditor Verdict
${theAuditorVerdict.summary}
${theAuditorVerdict.issues.length > 0 ? `\nIssues:\n${theAuditorVerdict.issues.map((i) => `- ${i}`).join("\n")}` : ""}

${coldEyesVerdict ? `### Cold-Eyes Verdict\n${coldEyesVerdict.summary}\n${coldEyesVerdict.issues.length > 0 ? `\nIssues:\n${coldEyesVerdict.issues.map((i) => `- ${i}`).join("\n")}` : ""}` : ""}

Please fix the issues above and complete the work. When done, claim completion again.
`

    await dispatchInternalPrompt({
      mode: "async",
      client: ctx.client,
      sessionID,
      source: HOOK_NAME,
      settleMs: 500,
      queueBehavior: "defer",
      input: {
        path: { id: sessionID },
        body: {
          parts: [createInternalAgentContinuationTextPart(feedbackPrompt)],
        },
        query: { directory },
      },
    })
  }

  return {
    event: async (input) => {
      const { event } = input
      if (event.type !== "session.idle") return
      const props = event.properties as Record<string, unknown> | undefined
      await handleIdleEvent(props)
    },
    getState: () => state,
    startAudit: (sessionID: string, context: AuditContext): boolean => {
      if (!isAuditLoopEnabled(config)) return false
      if (state?.active) return false

      state = {
        active: true,
        sessionID,
        cycleCount: 0,
        maxCycles: getMaxCycles(config),
        originalTask: context.originalTask,
        agentClaims: context.agentClaims,
        changedFiles: context.changedFiles,
        plan: context.plan,
        startedAt: new Date().toISOString(),
      }

      log(`[${HOOK_NAME}] Audit loop started`, { sessionID })
      return true
    },
    cancelAudit: (): boolean => {
      if (!state?.active) return false
      state.active = false
      log(`[${HOOK_NAME}] Audit loop cancelled`)
      return true
    },
  }
}
