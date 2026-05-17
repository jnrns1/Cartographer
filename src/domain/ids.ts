import { createHash } from "node:crypto";

/**
 * Deterministic identifiers. Idempotency under at-least-once async delivery
 * depends on these being a pure function of stable inputs: a redelivered
 * chunk recomputes the same id and upserts rather than duplicating
 * (DECISIONS.md, P6 design).
 */
export function stableId(parts: Array<string | number>): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

export function candidateEntityId(
  scanId: string,
  file: string,
  ruleId: string,
  startLine: number,
  endLine: number,
  snippet: string,
): string {
  // Snippet is included so two distinct matches of the same rule on the same
  // line span are kept separate, while a redelivered identical match maps to
  // the same key (idempotent upsert under at-least-once delivery).
  return stableId([scanId, file, ruleId, startLine, endLine, snippet]);
}

export function workItemEntityId(
  scanId: string,
  ruleId: string,
  file: string,
): string {
  return stableId([scanId, ruleId, file]);
}

/** Human-facing sequential id (brief 14): WI-0001, WI-0002, ... */
export function displayId(n: number): string {
  return `WI-${String(n).padStart(4, "0")}`;
}
