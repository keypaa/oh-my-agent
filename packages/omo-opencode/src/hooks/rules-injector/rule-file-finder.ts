import { setSisyphusRuleDeprecationLogger } from "#shared/rules-engine";
import { log } from "../../shared/logger";

setSisyphusRuleDeprecationLogger(log);

export { findRuleFiles } from "#shared/rules-engine";
export type { FindRuleFilesOptions } from "#shared/rules-engine";
