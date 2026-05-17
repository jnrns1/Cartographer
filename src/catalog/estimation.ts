import type { EstimationHeuristics } from "../types";

/**
 * Effort estimation heuristics. Values are transcribed verbatim from
 * BUILD_BRIEF.md section 6.5. Bundled as a typed constant rather than loaded
 * into Forge Storage on install (see DECISIONS.md): version-locked with the
 * engine, no install hook, no per-scan read latency.
 */
export const ESTIMATION: EstimationHeuristics = {
  baseHoursPerOccurrence: {
    security: 2,
    "legacy-ui": 4,
    deprecated: 1,
    "compat-adobe": 2,
    "compat-lucee": 1,
    architecture: 8,
    modernization: 3,
    "ai-readiness": 4,
    tests: 1,
    config: 0.5,
  },
  maxRollupPerFile: {
    security: 16,
    "legacy-ui": 24,
    deprecated: 8,
    "compat-adobe": 12,
    "compat-lucee": 8,
    architecture: 32,
    modernization: 16,
    "ai-readiness": 16,
    tests: 8,
    config: 4,
  },
  multipliers: {
    fileSizeOver500Loc: 1.25,
    fileSizeOver1500Loc: 1.5,
    fileTouchedBy5PlusRules: 1.2,
    fileHasTests: 0.8,
    fileInLegacyPath: 1.3,
  },
  capacity: {
    productiveHoursPerDevPerWeek: 25,
  },
};
