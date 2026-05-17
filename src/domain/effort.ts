import type { Category, Effort, EstimationHeuristics, TShirt } from "../types";
import { ESTIMATION } from "../catalog";

/**
 * Effort estimation, brief 15. expectedHours = base * occurrences, capped at
 * the per-file rollup, then compounding multipliers. low = expected * 0.5,
 * high = expected * 2. Every multiplier applied is recorded in notes.
 */
export interface FileEffortContext {
  loc: number;
  rulesTouchingFile: number;
  hasTests: boolean;
  inLegacyPath: boolean;
}

function tshirtFor(hours: number): TShirt {
  if (hours <= 2) return "XS";
  if (hours <= 8) return "S";
  if (hours <= 16) return "M";
  if (hours <= 32) return "L";
  return "XL";
}

function storyPointsFor(hours: number): number {
  if (hours <= 1) return 1;
  if (hours <= 2) return 2;
  if (hours <= 4) return 3;
  if (hours <= 8) return 5;
  if (hours <= 16) return 8;
  if (hours <= 32) return 13;
  return 21;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Path heuristic for the legacy-path multiplier. */
export function isLegacyPath(path: string): boolean {
  return /(^|\/)(legacy|old|deprecated|archive)(\/|$)/i.test(path);
}

/** Path heuristic for the test-coverage multiplier. */
export function pathHasTests(path: string): boolean {
  return /(^|\/)tests?\//i.test(path) || /\.(test|spec|bdd)\./i.test(path);
}

export function estimateEffort(
  category: Category,
  occurrences: number,
  ctx: FileEffortContext,
  est: EstimationHeuristics = ESTIMATION,
): Effort {
  const base = est.baseHoursPerOccurrence[category];
  const cap = est.maxRollupPerFile[category];
  const raw = base * occurrences;
  let expected = Math.min(raw, cap);

  const notes: string[] = [
    `base ${base}h x ${occurrences} occurrence(s) = ${round2(raw)}h${
      raw > cap ? ` (capped at ${cap}h)` : ""
    }`,
  ];
  const m = est.multipliers;
  if (ctx.loc > 1500) {
    expected *= m.fileSizeOver1500Loc;
    notes.push(`file over 1500 LOC x${m.fileSizeOver1500Loc}`);
  } else if (ctx.loc > 500) {
    expected *= m.fileSizeOver500Loc;
    notes.push(`file over 500 LOC x${m.fileSizeOver500Loc}`);
  }
  if (ctx.rulesTouchingFile >= 5) {
    expected *= m.fileTouchedBy5PlusRules;
    notes.push(`file touched by 5+ rules x${m.fileTouchedBy5PlusRules}`);
  }
  if (ctx.hasTests) {
    expected *= m.fileHasTests;
    notes.push(`file has tests x${m.fileHasTests}`);
  }
  if (ctx.inLegacyPath) {
    expected *= m.fileInLegacyPath;
    notes.push(`file in legacy path x${m.fileInLegacyPath}`);
  }

  expected = round2(expected);
  return {
    tshirt: tshirtFor(expected),
    storyPoints: storyPointsFor(expected),
    estimatedHours: {
      low: round2(expected * 0.5),
      expected,
      high: round2(expected * 2),
    },
    notes: notes.join("; "),
  };
}
