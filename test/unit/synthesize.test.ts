import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { scanFile, synthesize } from "../../src/domain";
import type { CandidateMatch, FileRef } from "../../src/types";

const FIX = join(process.cwd(), "test", "fixtures", "bad");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function badCandidates(): { candidates: CandidateMatch[]; loc: Record<string, number> } {
  const candidates: CandidateMatch[] = [];
  const loc: Record<string, number> = {};
  for (const abs of walk(FIX)) {
    const rel = abs.slice(join(process.cwd(), "test", "fixtures").length + 1);
    const ref: FileRef = { path: rel, ext: extname(abs).slice(1).toLowerCase() };
    const content = readFileSync(abs, "utf8");
    loc[rel] = content.split("\n").length;
    candidates.push(...scanFile(ref, content));
  }
  return { candidates, loc };
}

describe("synthesizer (brief 9.4, 14)", () => {
  const { candidates, loc } = badCandidates();
  const input = {
    candidates,
    fileLoc: loc,
    scanId: "scan-1",
    detectedAt: "2026-05-17T10:00:00.000Z",
  };
  const items = synthesize(input);

  it("produces well-formed work items", () => {
    expect(items.length).toBeGreaterThan(0);
    for (const wi of items) {
      expect(wi.id).toMatch(/^WI-\d{4}$/);
      expect(wi.occurrences).toBeGreaterThanOrEqual(1);
      expect(wi.recommendation).not.toContain("{{");
      expect(wi.title.length).toBeGreaterThan(5);
      expect(wi.detectedAt).toBe("2026-05-17T10:00:00.000Z");
      expect([1, 2, 3, 4]).toContain(wi.phase);
      expect(wi.references.length).toBeGreaterThan(0);
    }
  });

  it("groups by (rule, file): one item per pair, occurrences counted", () => {
    const keys = items.map((w) => `${w.ruleId} ${w.location.file}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("numbers display ids sequentially from a stable order", () => {
    const ids = items.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("WI-0001");
    expect(ids[ids.length - 1]).toBe(`WI-${String(ids.length).padStart(4, "0")}`);
  });

  it("maps priority from severity and blocks security migration", () => {
    const map: Record<string, string> = {
      critical: "P0",
      high: "P1",
      medium: "P2",
      low: "P3",
    };
    for (const wi of items) {
      expect(wi.priority).toBe(map[wi.severity]);
      if (wi.category === "security") {
        expect(wi.blocksMigration).toBe(true);
        expect(wi.jiraIssueType).toBe("Bug");
        expect(wi.phase).toBe(1);
      }
    }
  });

  it("resolves the static dependency graph, preferring same-file links", () => {
    const linked = items.filter(
      (w) => w.blocks.length > 0 || w.blockedBy.length > 0,
    );
    expect(linked.length).toBeGreaterThan(0);

    const sec001 = items.find((w) => w.ruleId === "CFML-SEC-001");
    expect(sec001).toBeDefined();
    const sameFileMod001 = items.find(
      (w) =>
        w.ruleId === "CFML-MOD-001" &&
        w.location.file === sec001?.location.file,
    );
    expect(sameFileMod001).toBeDefined();
    expect(sec001?.blocks).toContain(sameFileMod001?.id);
    expect(sameFileMod001?.blockedBy).toContain(sec001?.id);
  });

  it("keeps blocks and blockedBy reciprocal", () => {
    const byId = new Map(items.map((w) => [w.id, w]));
    for (const w of items) {
      for (const blockedId of w.blocks) {
        expect(byId.get(blockedId)?.blockedBy).toContain(w.id);
      }
      for (const blockerId of w.blockedBy) {
        expect(byId.get(blockerId)?.blocks).toContain(w.id);
      }
    }
  });

  it("is deterministic across runs (idempotent ids)", () => {
    const again = synthesize(input);
    expect(again.map((w) => w.id)).toEqual(items.map((w) => w.id));
    expect(again.map((w) => `${w.id}:${w.ruleId}:${w.location.file}`)).toEqual(
      items.map((w) => `${w.id}:${w.ruleId}:${w.location.file}`),
    );
  });
});
