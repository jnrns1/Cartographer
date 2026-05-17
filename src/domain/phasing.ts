import type { Category, PhaseNumber } from "../types";

/**
 * Risk-first phasing, brief 15.
 *
 * Phase 1 Stabilize: all security; compat-adobe/compat-lucee that block.
 * Phase 2 Compatibility: deprecated, legacy-ui, non-blocking compat, config.
 * Phase 3 Modernize: architecture, modernization, tests.
 * Phase 4 Elevate: ai-readiness.
 *
 * config is placed in Phase 2 (the brief's phasing list omits it; settings
 * translation is compatibility work, recorded in DECISIONS.md).
 */
export function phaseFor(
  category: Category,
  blocksMigration: boolean,
): PhaseNumber {
  if (category === "security") return 1;
  if (
    (category === "compat-adobe" || category === "compat-lucee") &&
    blocksMigration
  ) {
    return 1;
  }
  if (
    category === "deprecated" ||
    category === "legacy-ui" ||
    category === "compat-adobe" ||
    category === "compat-lucee" ||
    category === "config"
  ) {
    return 2;
  }
  if (
    category === "architecture" ||
    category === "modernization" ||
    category === "tests"
  ) {
    return 3;
  }
  return 4; // ai-readiness
}

export const PHASE_NAME: Record<PhaseNumber, string> = {
  1: "Stabilize",
  2: "Compatibility",
  3: "Modernize",
  4: "Elevate",
};
