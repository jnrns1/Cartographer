import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { scanFile } from "../../src/domain";
import { RULES } from "../../src/catalog";
import type { CandidateMatch, FileRef } from "../../src/types";

const FIX = join(process.cwd(), "test", "fixtures");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function refFor(absPath: string): FileRef {
  return {
    path: absPath.slice(FIX.length + 1).replace(/\\/g, "/"),
    ext: extname(absPath).slice(1).toLowerCase(),
  };
}

function scanDir(dir: string): CandidateMatch[] {
  const all: CandidateMatch[] = [];
  for (const f of walk(dir)) {
    all.push(...scanFile(refFor(f), readFileSync(f, "utf8")));
  }
  return all;
}

describe("bad fixtures trigger every rule (brief Phase 2 gate)", () => {
  const candidates = scanDir(join(FIX, "bad"));
  const hit = new Set(candidates.map((c) => c.ruleId));

  it("produces at least one candidate per rule in the catalog", () => {
    const missing = RULES.map((r) => r.id).filter((id) => !hit.has(id));
    expect(missing).toEqual([]);
  });

  it("records line numbers and snippets on every candidate", () => {
    for (const c of candidates) {
      expect(c.startLine).toBeGreaterThanOrEqual(1);
      expect(c.endLine).toBeGreaterThanOrEqual(c.startLine);
      expect(c.snippet.length).toBeGreaterThan(0);
      expect(c.file.length).toBeGreaterThan(0);
    }
  });
});

describe("good fixtures produce zero candidates (no false positives)", () => {
  for (const f of walk(join(FIX, "good"))) {
    it(`is clean: ${f.slice(FIX.length + 1)}`, () => {
      const found = scanFile(refFor(f), readFileSync(f, "utf8"));
      expect(found.map((c) => c.ruleId)).toEqual([]);
    });
  }
});

describe("engine antiPattern and exclusion semantics", () => {
  const cfm: FileRef = { path: "x.cfm", ext: "cfm" };

  it("flags an interpolated cfquery without cfqueryparam", () => {
    const code = `<cfquery name="q">SELECT * FROM u WHERE id = #url.id#</cfquery>`;
    const hits = scanFile(cfm, code).filter((c) => c.ruleId === "CFML-SEC-001");
    expect(hits.length).toBe(1);
  });

  it("excludes a cfquery that uses cfqueryparam", () => {
    const code =
      `<cfquery name="q">SELECT * FROM u WHERE id = ` +
      `<cfqueryparam value="#url.id#" cfsqltype="cf_sql_integer"></cfquery>`;
    const hits = scanFile(cfm, code).filter((c) => c.ruleId === "CFML-SEC-001");
    expect(hits.length).toBe(0);
  });

  it("does not apply a cfc-only rule to a .cfm file", () => {
    const code = `<cfset this.datasource = "x">`;
    const hits = scanFile(cfm, code).filter((c) => c.ruleId === "CFML-CFG-001");
    expect(hits.length).toBe(0);
  });

  it("skips files over the size guard", () => {
    const huge = "x".repeat(2_000_001);
    expect(scanFile(cfm, huge)).toEqual([]);
  });
});
