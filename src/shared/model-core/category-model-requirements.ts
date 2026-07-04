import type { ModelRequirement } from "./model-requirement-types"

// No per-category model requirements in code. Categories inherit the caller's model by default.
// Config overrides and system defaults drive model selection at runtime.
export const CATEGORY_MODEL_REQUIREMENTS: Record<string, ModelRequirement> = {};
