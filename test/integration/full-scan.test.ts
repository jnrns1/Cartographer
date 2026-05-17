import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildZip } from "../helpers/zip";
import {
  makeMemoryPorts,
  InMemoryQueue,
  putScan,
  getScan,
  collectCandidates,
  queryWorkItems,
} from "../../src/lib";
import { handleScanEvent, drainQueue, type WorkerDeps } from "../../src/workers/scan";
import { ZipSource } from "../../src/sources";
import { RULES } from "../../src/catalog";
import type { ScanEvent, ScanMeta, SourceAdapter } from "../../src/types";

const FIXBAD = join(process.cwd(), "test", "fixtures", "bad");

function badFixtureZip(): Buffer {
  return buildZip(
    readdirSync(FIXBAD).map((name) => ({
      name: `repo-main/src/${name}`,
      content: readFileSync(join(FIXBAD, name), "utf8"),
    })),
  );
}

function newScan(scanId: string): ScanMeta {
  return {
    scanId,
    projectId: "P1",
    status: "queued",
    sourceKind: "zip",
    totalFiles: 0,
    processedFiles: 0,
    candidateCount: 0,
    workItemCount: 0,
    chunkTotal: 0,
    chunkDone: 0,
    createdAt: 1_000,
  };
}

function depsFor(zip: Buffer): WorkerDeps & { queue: InMemoryQueue } {
  const ports = makeMemoryPorts();
  const queue = new InMemoryQueue();
  return {
    ports,
    queue,
    sourceFor: async (): Promise<SourceAdapter> => new ZipSource(zip),
    now: () => 1_700_000_000_000,
  };
}

describe("full scan, end to end (brief Phase 4 gate)", () => {
  it("scans a zip, synthesizes work items, and completes", async () => {
    const zip = badFixtureZip();
    const deps = depsFor(zip);
    await putScan(deps.ports.entities, newScan("scan-1"));

    await deps.queue.push({ scanId: "scan-1", phase: "bootstrap" });
    const processed = await drainQueue(deps);
    expect(processed).toBeGreaterThan(0);

    const scan = await getScan(deps.ports.entities, "scan-1");
    expect(scan?.status).toBe("complete");
    expect(scan?.totalFiles).toBeGreaterThan(0);
    expect(scan?.processedFiles).toBe(scan?.totalFiles);
    expect(scan?.workItemCount).toBeGreaterThan(0);

    const candidates = await collectCandidates(deps.ports.entities, "scan-1");
    const ruleIds = new Set(candidates.map((c) => c.ruleId));
    const missing = RULES.map((r) => r.id).filter((id) => !ruleIds.has(id));
    expect(missing).toEqual([]);

    let total = 0;
    let cursor: string | undefined;
    do {
      const page = await queryWorkItems(
        deps.ports.entities,
        "scan-1",
        { type: "all" },
        cursor,
        25,
      );
      total += page.items.length;
      cursor = page.nextCursor;
    } while (cursor);
    expect(total).toBe(scan?.workItemCount);
  });

  it("is idempotent: a full replay yields identical counts", async () => {
    const zip = badFixtureZip();
    const deps = depsFor(zip);
    await putScan(deps.ports.entities, newScan("scan-2"));

    await deps.queue.push({ scanId: "scan-2", phase: "bootstrap" });
    await drainQueue(deps);
    const first = await getScan(deps.ports.entities, "scan-2");

    // Replay every phase again (at-least-once redelivery of the whole job).
    await deps.queue.push({ scanId: "scan-2", phase: "bootstrap" });
    await drainQueue(deps);
    const second = await getScan(deps.ports.entities, "scan-2");

    expect(second?.workItemCount).toBe(first?.workItemCount);
    const candidates = await collectCandidates(deps.ports.entities, "scan-2");
    expect(second?.candidateCount).toBe(candidates.length);
  });

  it("handles an empty source without work", async () => {
    const deps = depsFor(buildZip([{ name: "repo/readme.md", content: "x" }]));
    await putScan(deps.ports.entities, newScan("scan-3"));
    await deps.queue.push({ scanId: "scan-3", phase: "bootstrap" });
    await drainQueue(deps);
    const scan = await getScan(deps.ports.entities, "scan-3");
    expect(scan?.status).toBe("complete");
    expect(scan?.workItemCount).toBe(0);
  });
});

describe("linear-breadth re-enqueue stays shallow", () => {
  it("enqueue-more pushes one batch plus one continuation", async () => {
    const deps = depsFor(buildZip([{ name: "a.cfm", content: "x" }]));
    const scan = newScan("scan-b");
    scan.chunkTotal = 120; // 3 batches of <=50
    await putScan(deps.ports.entities, scan);

    const ev: ScanEvent = {
      scanId: "scan-b",
      phase: "enqueue-more",
      fromBatch: 1,
    };
    await handleScanEvent(deps, ev);

    const pushed = deps.queue.pushed;
    const chunkEvents = pushed.filter((e) => e.phase === "chunk");
    const more = pushed.filter((e) => e.phase === "enqueue-more");
    expect(chunkEvents.length).toBe(50); // batch index 1
    expect(more).toHaveLength(1);
    expect(more[0]?.fromBatch).toBe(2);
  });
});
