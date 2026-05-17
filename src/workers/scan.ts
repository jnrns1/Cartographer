import type { ScanEvent, SourceAdapter } from "../types";
import type { QueuePort, StoragePorts } from "../lib/ports";
import {
  getScan,
  putScan,
  putCandidate,
  collectCandidates,
  putWorkItem,
  markChunkDone,
  countChunksDone,
} from "../lib/entities";
import { scanFile, synthesize, planChunks, eventBatches } from "../domain";

/**
 * Async scan worker (brief 9, P6 design). Chunked, idempotent under
 * at-least-once delivery: deterministic ids upsert, progress is derived from
 * chunkstate markers (never accumulated), synthesis early-exits when complete.
 * Re-enqueue is linear-breadth (one continuation per <=50-event batch) so
 * invocation depth stays far below the platform's 1000 cap.
 */
export interface WorkerDeps {
  ports: StoragePorts;
  queue: QueuePort;
  /** Builds the source adapter for a scan (zip bytes / repo client). */
  sourceFor: (scanId: string) => Promise<SourceAdapter>;
  now?: () => number;
}

const CHUNK_FILES = 150;
const filesKey = (s: string, c: number) => `scanfiles:${s}:${c}`;
const locKey = (s: string, c: number) => `scanloc:${s}:${c}`;
const optsKey = (s: string) => `scanopts:${s}`;

export async function handleScanEvent(
  deps: WorkerDeps,
  event: ScanEvent,
): Promise<void> {
  const now = deps.now ?? Date.now;
  switch (event.phase) {
    case "bootstrap":
      return bootstrap(deps, event.scanId, now);
    case "enqueue-more":
      return enqueueMore(deps, event.scanId, event.fromBatch ?? 0);
    case "chunk":
      return processChunk(deps, event.scanId, event.chunkIndex ?? 0, now);
    case "synthesize":
      return runSynthesis(deps, event.scanId, now);
  }
}

async function bootstrap(
  deps: WorkerDeps,
  scanId: string,
  now: () => number,
): Promise<void> {
  const { ports, queue } = deps;
  const scan = await getScan(ports.entities, scanId);
  if (!scan) throw new Error(`scan ${scanId} not found`);

  const opts =
    (await ports.kvs.get<{ ignorePatterns: string[] }>(optsKey(scanId))) ??
    { ignorePatterns: [] };
  const adapter = await deps.sourceFor(scanId);

  const paths: string[] = [];
  for await (const f of adapter.listFiles({
    ignorePatterns: opts.ignorePatterns,
  })) {
    paths.push(f.path);
  }

  const plan = planChunks(paths.length, CHUNK_FILES);
  for (const c of plan.chunks) {
    await ports.kvs.set(
      filesKey(scanId, c.chunkIndex),
      paths.slice(c.start, c.end),
    );
  }

  await putScan(ports.entities, {
    ...scan,
    status: paths.length === 0 ? "synthesizing" : "scanning",
    totalFiles: paths.length,
    processedFiles: 0,
    chunkTotal: plan.chunkTotal,
    chunkDone: 0,
  });

  if (plan.chunkTotal === 0) {
    await queue.push({ scanId, phase: "synthesize" });
    return;
  }

  const batches = eventBatches(plan.chunkTotal, 50);
  for (const chunkIndex of batches[0] ?? []) {
    await queue.push({ scanId, phase: "chunk", chunkIndex });
  }
  if (batches.length > 1) {
    await queue.push({ scanId, phase: "enqueue-more", fromBatch: 1 });
  }
}

async function enqueueMore(
  deps: WorkerDeps,
  scanId: string,
  fromBatch: number,
): Promise<void> {
  const scan = await getScan(deps.ports.entities, scanId);
  if (!scan) return;
  const batches = eventBatches(scan.chunkTotal, 50);
  for (const chunkIndex of batches[fromBatch] ?? []) {
    await deps.queue.push({ scanId, phase: "chunk", chunkIndex });
  }
  if (fromBatch + 1 < batches.length) {
    await deps.queue.push({
      scanId,
      phase: "enqueue-more",
      fromBatch: fromBatch + 1,
    });
  }
}

async function processChunk(
  deps: WorkerDeps,
  scanId: string,
  chunkIndex: number,
  now: () => number,
): Promise<void> {
  const { ports, queue } = deps;
  const paths =
    (await ports.kvs.get<string[]>(filesKey(scanId, chunkIndex))) ?? [];
  const adapter = await deps.sourceFor(scanId);
  const loc: Record<string, number> = {};

  for (const path of paths) {
    const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
    let content: string;
    try {
      content = await adapter.readFile({ path, ext });
    } catch {
      continue; // unreadable file: skip, do not fail the whole chunk
    }
    loc[path] = content.split("\n").length;
    for (const match of scanFile({ path, ext }, content)) {
      await putCandidate(ports.entities, scanId, match, chunkIndex);
    }
  }
  await ports.kvs.set(locKey(scanId, chunkIndex), loc);
  await markChunkDone(ports.entities, scanId, chunkIndex);

  const scan = await getScan(ports.entities, scanId);
  if (!scan) return;
  const done = await countChunksDone(ports.entities, scanId);
  const perChunk = scan.chunkTotal
    ? Math.ceil(scan.totalFiles / scan.chunkTotal)
    : 0;
  await putScan(ports.entities, {
    ...scan,
    chunkDone: done,
    processedFiles: Math.min(scan.totalFiles, done * perChunk),
  });

  if (
    done >= scan.chunkTotal &&
    scan.status !== "synthesizing" &&
    scan.status !== "complete"
  ) {
    await putScan(ports.entities, { ...scan, status: "synthesizing" });
    await queue.push({ scanId, phase: "synthesize" });
  }
}

async function runSynthesis(
  deps: WorkerDeps,
  scanId: string,
  now: () => number,
): Promise<void> {
  const { ports } = deps;
  const scan = await getScan(ports.entities, scanId);
  if (!scan || scan.status === "complete") return; // idempotent early-exit

  const candidates = await collectCandidates(ports.entities, scanId);
  const fileLoc: Record<string, number> = {};
  for (let c = 0; c < scan.chunkTotal; c++) {
    const page = await ports.kvs.get<Record<string, number>>(
      locKey(scanId, c),
    );
    if (page) Object.assign(fileLoc, page);
  }

  const items = synthesize({
    candidates,
    fileLoc,
    scanId,
    detectedAt: new Date(now()).toISOString(),
  });
  for (const wi of items) {
    await putWorkItem(ports.entities, scanId, wi);
  }

  await putScan(ports.entities, {
    ...scan,
    status: "complete",
    candidateCount: candidates.length,
    workItemCount: items.length,
    processedFiles: scan.totalFiles,
    chunkDone: scan.chunkTotal,
    finishedAt: now(),
  });
}

/** Drain helper for tests and the Forge consumer redelivery loop. */
export async function drainQueue(
  deps: WorkerDeps & { queue: { take(): ScanEvent | undefined } },
  max = 10000,
): Promise<number> {
  let processed = 0;
  for (let i = 0; i < max; i++) {
    const event = deps.queue.take();
    if (!event) break;
    await handleScanEvent(deps, event);
    processed++;
  }
  return processed;
}
