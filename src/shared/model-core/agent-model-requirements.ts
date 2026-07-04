import type { ModelRequirement } from "./model-requirement-types"

// No per-agent model requirements in code. Agents inherit the caller's model by default.
// Config overrides and system defaults drive model selection at runtime.
export const AGENT_MODEL_REQUIREMENTS: Record<string, ModelRequirement> = {};
