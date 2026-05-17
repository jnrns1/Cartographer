import type { CandidateMatch, FileRef, Rule } from "../types";
import { RULES } from "../catalog";

/**
 * Pure regex rule engine (brief 9.3). No AST. preFilterPattern favors recall;
 * an optional antiPattern must also match inside a pre-filter hit to keep it,
 * and an optional exclusion drops a hit when it matches inside the region.
 *
 * Guards: oversized files are skipped, matches per rule per file are capped,
 * and zero-length matches advance lastIndex so a global regex cannot loop
 * forever. The compiled-regex cache lives for the invocation lifetime.
 */
const MAX_FILE_BYTES = 2_000_000;
const MAX_MATCHES_PER_RULE = 500;
const SNIPPET_MAX = 500;

interface Compiled {
  pre: RegExp;
  anti?: RegExp;
  excl?: RegExp;
}

const cache = new Map<string, Compiled>();

function compile(rule: Rule): Compiled {
  const cached = cache.get(rule.id);
  if (cached) return cached;
  const subFlags = rule.detect.ignoreCase ? "i" : "";
  const compiled: Compiled = {
    pre: new RegExp(rule.detect.preFilterPattern, `g${subFlags}`),
    anti: rule.detect.antiPattern
      ? new RegExp(rule.detect.antiPattern, subFlags)
      : undefined,
    excl: rule.detect.exclusion
      ? new RegExp(rule.detect.exclusion, subFlags)
      : undefined,
  };
  cache.set(rule.id, compiled);
  return compiled;
}

function lineAt(content: string, index: number): number {
  let line = 1;
  const stop = Math.min(index, content.length);
  for (let i = 0; i < stop; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

function countNewlines(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 10) n++;
  }
  return n;
}

/** Apply the catalog (or a subset) to one file's content. */
export function scanFile(
  file: FileRef,
  content: string,
  rules: Rule[] = RULES,
): CandidateMatch[] {
  if (content.length === 0 || content.length > MAX_FILE_BYTES) return [];
  const out: CandidateMatch[] = [];

  for (const rule of rules) {
    if (!rule.appliesTo.includes(file.ext)) continue;
    const { pre, anti, excl } = compile(rule);
    pre.lastIndex = 0;
    let count = 0;
    let m: RegExpExecArray | null;

    while ((m = pre.exec(content)) !== null) {
      const region = m[0];
      if (region.length === 0) {
        pre.lastIndex += 1;
        continue;
      }
      const keep =
        (!anti || anti.test(region)) && (!excl || !excl.test(region));
      if (keep) {
        const startLine = lineAt(content, m.index);
        out.push({
          ruleId: rule.id,
          file: file.path,
          startLine,
          endLine: startLine + countNewlines(region),
          snippet:
            region.length > SNIPPET_MAX
              ? `${region.slice(0, SNIPPET_MAX)} ...`
              : region,
        });
        if (++count >= MAX_MATCHES_PER_RULE) break;
      }
    }
  }

  return out;
}

/** Test-only: reset the compiled-regex cache. */
export function _resetEngineCache(): void {
  cache.clear();
}
