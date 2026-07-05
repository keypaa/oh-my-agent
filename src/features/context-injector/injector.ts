import type { Message, Part } from "@opencode-ai/sdk"
import { isRealUserMessage, isRealUserTextPart, log } from "../../shared"
import { getMainSessionID } from "../session-state"
import { getKnownIssuesForFile } from "../failure-journal"
import type { ContextCollector } from "./collector"

interface OutputPart {
  type: string
  text?: string
  [key: string]: unknown
}

interface InjectionResult {
  injected: boolean
  contextLength: number
}

export function injectPendingContext(
  collector: ContextCollector,
  sessionID: string,
  parts: OutputPart[]
): InjectionResult {
  if (!collector.hasPending(sessionID)) {
    return { injected: false, contextLength: 0 }
  }

  const textPartIndex = parts.findIndex(isRealUserTextPart)
  if (textPartIndex === -1) {
    return { injected: false, contextLength: 0 }
  }

  const pending = collector.consume(sessionID)
  const originalText = parts[textPartIndex].text ?? ""
  parts[textPartIndex].text = `${pending.merged}\n\n---\n\n${originalText}`

  return {
    injected: true,
    contextLength: pending.merged.length,
  }
}

interface ChatMessageInput {
  sessionID: string
  agent?: string
  model?: { providerID: string; modelID: string }
  messageID?: string
}

interface ChatMessageOutput {
  message: Record<string, unknown>
  parts: OutputPart[]
}

export function createContextInjectorHook(collector: ContextCollector) {
  return {
    "chat.message": async (
      input: ChatMessageInput,
      output: ChatMessageOutput
    ): Promise<void> => {
      const result = injectPendingContext(collector, input.sessionID, output.parts)
      if (result.injected) {
        log("[context-injector] Injected pending context via chat.message", {
          sessionID: input.sessionID,
          contextLength: result.contextLength,
        })
      }
    },
  }
}

interface MessageWithParts {
  info: Message
  parts: Part[]
}

type MessagesTransformHook = {
  "experimental.chat.messages.transform"?: (
    input: Record<string, never>,
    output: { messages: MessageWithParts[] }
  ) => Promise<void>
}

function getSessionIDFromMessageInfo(info: Message): string | undefined {
  return "sessionID" in info && typeof info.sessionID === "string" ? info.sessionID : undefined
}

function hasText(part: Part): boolean {
  return "text" in part && typeof part.text === "string" && part.text.length > 0
}

const FILE_PATH_PATTERN = /(?:^|\s)((?:[A-Za-z]:\\|\.\/|\.\.\/|\/)[^\s,;:"')]+)/gm

function extractFilePaths(text: string): string[] {
  const paths: string[] = []
  const seen = new Set<string>()
  let match: RegExpExecArray | null
  FILE_PATH_PATTERN.lastIndex = 0
  while ((match = FILE_PATH_PATTERN.exec(text)) !== null) {
    const filePath = match[1].replace(/[.,;:]+$/, "")
    if (!seen.has(filePath)) {
      seen.add(filePath)
      paths.push(filePath)
    }
  }
  return paths
}

function formatKnownIssues(issues: ReturnType<typeof getKnownIssuesForFile>): string | null {
  if (issues.length === 0) return null
  const unresolved = issues.filter((i) => !i.resolved)
  if (unresolved.length === 0) return null
  const lines = unresolved.map((i) => `- [${i.reportedBy}] ${i.rootCause} (${i.pattern})`)
  return `### Known Issues for This File\n${lines.join("\n")}`
}

export function createContextInjectorMessagesTransformHook(
  collector: ContextCollector
): MessagesTransformHook {
  return {
    "experimental.chat.messages.transform": async (_input, output) => {
      const { messages } = output
      if (messages.length === 0) {
        return
      }

      let lastUserMessageIndex = -1
      for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i]
        if (message?.info.role === "user") {
          lastUserMessageIndex = i
          break
        }
      }

      if (lastUserMessageIndex === -1) {
        return
      }

      const lastUserMessage = messages[lastUserMessageIndex]
      if (lastUserMessage === undefined) {
        return
      }
      if (!isRealUserMessage(lastUserMessage)) {
        log("[context-injector] Latest user message is synthetic/internal, skipping injection", {
          sessionID: getSessionIDFromMessageInfo(lastUserMessage.info) ?? getMainSessionID(),
        })
        return
      }
      const messageSessionID = getSessionIDFromMessageInfo(lastUserMessage.info)
      const sessionID = messageSessionID ?? getMainSessionID()
      if (!sessionID) {
        return
      }

      const hasPending = collector.hasPending(sessionID)
      if (!hasPending) {
        return
      }

      const textPartIndex = lastUserMessage.parts.findIndex(
        (p) => isRealUserTextPart(p) && hasText(p)
      )

      if (textPartIndex === -1) {
        log("[context-injector] No text part found in last user message, skipping injection", {
          sessionID,
          partsCount: lastUserMessage.parts.length,
        })
        return
      }

      const pending = collector.consume(sessionID)
      if (!pending.hasContent) {
        return
      }

      const textPart = lastUserMessage.parts[textPartIndex]
      const userText = (textPart && "text" in textPart && typeof textPart.text === "string") ? textPart.text : ""
      const filePaths = extractFilePaths(userText)
      let knownIssuesContext = ""
      for (const filePath of filePaths) {
        const issues = getKnownIssuesForFile(filePath)
        const formatted = formatKnownIssues(issues)
        if (formatted) {
          knownIssuesContext += `\n\n${formatted}`
        }
      }

      const combinedContext = knownIssuesContext
        ? `${pending.merged}\n\n${knownIssuesContext}`
        : pending.merged

      const syntheticPart = {
        id: `prt_synthetic_hook_${sessionID}`,
        messageID: lastUserMessage.info.id,
        sessionID: messageSessionID ?? "",
        type: "text" as const,
        text: combinedContext,
        synthetic: true,
      }

      lastUserMessage.parts.splice(textPartIndex, 0, syntheticPart as Part)

      log("[context-injector] Inserted synthetic part with hook content", {
        sessionID,
        contentLength: pending.merged.length,
      })
    },
  }
}
