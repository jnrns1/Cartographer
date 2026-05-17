import { describe, it, expect } from "vitest";
import {
  estimateEffort,
  isLegacyPath,
  pathHasTests,
  planChunks,
  eventBatches,
  phaseFor,
  stableId,
  displayId,
  candidateEntityId,
  workItemEntityId,
} from "../../src/domain";

describe("effort estimation (brief 15)", () => {
  const ctx = {
    loc: 0,
    rulesTouchingFile: 1,
    hasTests: false,
    inLegacyPath: false,
  };

  it("uses base hours and the Fibonacci point and t-shirt scale", () => {
    const e = estimateEffort("security", 1, ctx);
    expect(e.estimatedHours.expected).toBe(2);
    expect(e.estimatedHours.low).toBe(1);
    expect(e.estimatedHours.high).toBe(4);
    expect(e.tshirt).toBe("XS");
    expect(e.storyPoints).toBe(2);
    expect(e.notes).toContain("base 2h x 1");
  });

  it("caps at the per-file rollup and notes the cap", () => {
    const e = estimateEffort("security", 20, ctx); // 2*20=40, cap 16
    expect(e.estimatedHours.expected).toBe(16);
    expect(e.notes).toContain("capped at 16h");
  });

  it("compounds multipliers and records each in notes", () => {
    const e = estimateEffort("config", 1, {
      loc: 1600,
      rulesTouchingFile: 6,
      hasTests: true,
      inLegacyPath: true,
    });
    expect(e.notes).toContain("over 1500 LOC");
    expect(e.notes).toContain("touched by 5+ rules");
    expect(e.notes).toContain("file has tests");
    expect(e.notes).toContain("legacy path");
    // 0.5 base * 1.5 * 1.2 * 0.8 * 1.3 = 0.936
    expect(e.estimatedHours.expected).toBeCloseTo(0.94, 1);
  });

  it("classifies paths", () => {
    expect(isLegacyPath("src/legacy/old.cfm")).toBe(true);
    expect(isLegacyPath("src/app/user.cfc")).toBe(false);
    expect(pathHasTests("tests/UserSpec.cfc")).toBe(true);
    expect(pathHasTests("models/User.test.cfc")).toBe(true);
    expect(pathHasTests("models/User.cfc")).toBe(false);
  });
});

describe("phasing (brief 15)", () => {
  it("routes categories to the right phase", () => {
    expect(phaseFor("security", true)).toBe(1);
    expect(phaseFor("compat-adobe", true)).toBe(1);
    expect(phaseFor("compat-lucee", false)).toBe(2);
    expect(phaseFor("legacy-ui", false)).toBe(2);
    expect(phaseFor("deprecated", false)).toBe(2);
    expect(phaseFor("config", false)).toBe(2);
    expect(phaseFor("architecture", false)).toBe(3);
    expect(phaseFor("modernization", false)).toBe(3);
    expect(phaseFor("tests", false)).toBe(3);
    expect(phaseFor("ai-readiness", false)).toBe(4);
  });
});

describe("chunk planning (P6 design)", () => {
  it("slices file lists into bounded chunks", () => {
    expect(planChunks(0).chunkTotal).toBe(0);
    expect(planChunks(150).chunkTotal).toBe(1);
    const p = planChunks(151);
    expect(p.chunkTotal).toBe(2);
    expect(p.chunks[1]).toEqual({ chunkIndex: 1, start: 150, end: 151 });
  });

  it("caps chunk size at the platform-safe maximum", () => {
    expect(planChunks(1000, 999).chunkSize).toBe(150);
  });

  it("batches events within the per-push limit (linear breadth)", () => {
    const batches = eventBatches(120, 50);
    expect(batches.map((b) => b.length)).toEqual([50, 50, 20]);
    expect(batches[0]?.[0]).toBe(0);
    expect(batches[2]?.[19]).toBe(119);
  });
});

describe("deterministic ids (idempotency)", () => {
  it("hashes stably to 32 hex chars", () => {
    const a = stableId(["scan", "file.cfm", "CFML-SEC-001", 1, 2]);
    const b = stableId(["scan", "file.cfm", "CFML-SEC-001", 1, 2]);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(candidateEntityId("s", "f.cfm", "R", 1, 2, "snip")).toMatch(
      /^[0-9a-f]{32}$/,
    );
    expect(workItemEntityId("s", "R", "f.cfm")).not.toBe(
      workItemEntityId("s", "R", "g.cfm"),
    );
  });

  it("formats sequential display ids", () => {
    expect(displayId(1)).toBe("WI-0001");
    expect(displayId(73)).toBe("WI-0073");
  });
});
