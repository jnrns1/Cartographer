import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { scanFile, synthesize, buildPlan } from "../../src/domain";
import { planColumns } from "../../src/frontend/lib/viewModel";
import { makeMemoryPorts, InMemoryQueue, putScan } from "../../src/lib";
import { createProjectResolver } from "../../src/resolvers/project";
import { drainQueue } from "../../src/workers/scan";
import { buildZip } from "../helpers/zip";
import { ZipSource } from "../../src/sources";
import type { CandidateMatch, FileRef, ScanMeta, SourceAdapter } from "../../src/types";

const FIXBAD = join(process.cwd(), "test", "fixtures", "bad");

function badItems() {
  const candidates: CandidateMatch[] = [];
  const loc: Record<string, number> = {};
  for (const name of readdirSync(FIXBAD)) {
    const abs = join(FIXBAD, name);
    const ref: FileRef = {
      path: `bad/${name}`,
      ext: extname(abs).slice(1).toLowerCase(),
    };
    const content = readFileSync(abs, "utf8");
    loc[ref.path] = content.split("\n").length;
    candidates.push(...scanFile(ref, content));
  }
  return synthesize({
    candidates,
    fileLoc: loc,
    scanId: "scan-1",
    detectedAt: "2026-05-17T10:00:00.000Z",
  });
}

const BANNED = /\b(seamlessly|leverage|empower|unlock|elevate|robust|journey)\b/i;

describe("migration plan (brief 12, 15, 16)", () => {
  const items = badItems();
  const plan = buildPlan({
    workItems: items,
    projectName: "Acme Legacy",
    scannedAt: "2026-05-17T10:00:00.000Z",
    teamSize: 3,
    sprintLengthWeeks: 2,
  });

  it("has the four risk-first phases in order", () => {
    expect(plan.phases.map((p) => p.name)).toEqual([
      "Stabilize",
      "Compatibility",
      "Modernize",
      "Elevate",
    ]);
    expect(plan.phases.map((p) => p.phase)).toEqual([1, 2, 3, 4]);
  });

  it("partitions every work item into exactly one phase", () => {
    const sum = plan.phases.reduce((s, p) => s + p.workItemCount, 0);
    expect(sum).toBe(items.length);
    expect(plan.stats.totalWorkItems).toBe(items.length);
    for (const p of plan.phases) {
      for (const id of p.workItemIds) {
        expect(items.find((w) => w.id === id)?.phase).toBe(p.phase);
      }
    }
  });

  it("counts migration blockers and totals hours", () => {
    expect(plan.stats.blocksMigrationCount).toBe(
      items.filter((w) => w.blocksMigration).length,
    );
    const total = Math.round(
      plan.phases.reduce((s, p) => s + p.totalHours, 0) * 10,
    ) / 10;
    expect(plan.stats.totalHours).toBe(total);
  });

  it("derives sprints from team capacity (25h/dev/week)", () => {
    for (const p of plan.phases) {
      const perSprint = 3 * 25 * 2;
      const expected =
        p.totalHours > 0 ? Math.ceil(p.totalHours / perSprint) : 0;
      expect(p.sprintRecommendation.sprints).toBe(expected);
      expect(p.sprintRecommendation.teamSize).toBe(3);
    }
  });

  it("writes a plain executive summary (no em dash or softeners)", () => {
    expect(plan.executiveSummary).not.toMatch(/—/);
    expect(plan.executiveSummary).not.toMatch(BANNED);
    expect(plan.executiveSummary).toContain(String(items.length));
    expect(plan.executiveSummary.length).toBeGreaterThan(80);
  });

  it("is deterministic across runs", () => {
    const again = buildPlan({
      workItems: items,
      projectName: "Acme Legacy",
      scannedAt: "2026-05-17T10:00:00.000Z",
      teamSize: 3,
      sprintLengthWeeks: 2,
    });
    expect(again).toEqual(plan);
  });

  it("matches the committed golden plan summary", () => {
    expect(
      plan.phases.map((p) => ({
        phase: p.phase,
        name: p.name,
        count: p.workItemCount,
        hours: p.totalHours,
        sprints: p.sprintRecommendation.sprints,
      })),
    ).toMatchSnapshot();
  });

  it("exposes PhaseColumn data for the UI", () => {
    const cols = planColumns(plan);
    expect(cols).toHaveLength(4);
    expect(cols[0]?.name).toBe("Stabilize");
  });
});

describe("getPlan resolver method", () => {
  it("builds and persists the plan for a completed scan", async () => {
    const ports = makeMemoryPorts();
    const queue = new InMemoryQueue();
    const zip = buildZip(
      readdirSync(FIXBAD).map((n) => ({
        name: `src/${n}`,
        content: readFileSync(join(FIXBAD, n), "utf8"),
      })),
    );
    const scan: ScanMeta = {
      scanId: "scan-1",
      projectId: "Acme",
      status: "queued",
      sourceKind: "zip",
      totalFiles: 0,
      processedFiles: 0,
      candidateCount: 0,
      workItemCount: 0,
      chunkTotal: 0,
      chunkDone: 0,
      createdAt: 1_700_000_000_000,
    };
    await putScan(ports.entities, scan);
    const core = createProjectResolver({ ports, queue });
    await core.startScan({
      projectId: "Acme",
      source: { kind: "zip" },
      scanId: "scan-1",
    });
    await drainQueue({
      ports,
      queue,
      sourceFor: async (): Promise<SourceAdapter> => new ZipSource(zip),
      now: () => 1_700_000_000_000,
    });

    const res = await core.getPlan({
      scanId: "scan-1",
      teamSize: 4,
      sprintLengthWeeks: 3,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.plan.scanId).toBe("scan-1");
      expect(res.plan.phases).toHaveLength(4);
      const persisted = await ports.kvs.get("plan:scan-1");
      expect(persisted).toBeTruthy();
    }
  });
});
