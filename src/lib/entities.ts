import type {
  CandidateMatch,
  Category,
  Confidence,
  ScanMeta,
  ScanSummary,
  WorkItem,
} from "../types";
import { getRule } from "../catalog";
import { candidateEntityId, workItemEntityId } from "../domain";
import type { EntityStore } from "./ports";
import {
  InMemoryEntityStore,
  InMemoryKvs,
  InMemoryObjectStore,
  type IndexSpecs,
} from "./memory";
import type { StoragePorts } from "./ports";

/** Entity names (lowercase, matching manifest.yml app.storage.entities). */
export const ENTITY = {
  scan: "scan",
  candidate: "candidate",
  workitem: "workitem",
  exportartifact: "exportartifact",
  chunkstate: "chunkstate",
  blobpart: "blobpart",
} as const;

/** Index specs mirroring manifest.yml exactly (kept in sync by a test). */
export const INDEX_SPECS: IndexSpecs = {
  scan: {
    "by-project": { partition: "projectId", range: "createdAt" },
    "by-status": { partition: "status", range: "createdAt" },
  },
  candidate: {
    "by-scan": { partition: "scanId", range: "createdAt" },
  },
  workitem: {
    "by-scan": { partition: "scanId", range: "createdAt" },
    "by-scan-phase": { partition: "scanPhase", range: "severity" },
    "by-scan-category": { partition: "scanCategory", range: "confidence" },
    "by-scan-severity": { partition: "scanSeverity", range: "confidence" },
  },
  exportartifact: {
    "by-scan": { partition: "scanId", range: "createdAt" },
  },
  chunkstate: {
    "by-scan": { partition: "scanId", range: "chunkIndex" },
  },
  blobpart: {
    "by-scan": { partition: "scanId", range: "partIndex" },
  },
};

const CONF_BUCKET: Record<Confidence, number> = {
  high: 90,
  medium: 60,
  low: 30,
};
export const confidenceBucket = (c: Confidence): number => CONF_BUCKET[c];

/** Build an in-memory StoragePorts (offline tests, the P6 integration test). */
export function makeMemoryPorts(): StoragePorts {
  return {
    kvs: new InMemoryKvs(),
    entities: new InMemoryEntityStore(INDEX_SPECS),
    objects: new InMemoryObjectStore(),
  };
}

// --- scan -----------------------------------------------------------------
export async function putScan(es: EntityStore, scan: ScanMeta): Promise<void> {
  await es.set(ENTITY.scan, scan.scanId, {
    ...scan,
  } as unknown as Record<string, unknown>);
}

export function getScan(
  es: EntityStore,
  scanId: string,
): Promise<ScanMeta | undefined> {
  return es.get<ScanMeta>(ENTITY.scan, scanId);
}

export async function listScans(
  es: EntityStore,
  projectId: string,
  cursor?: string,
  limit = 25,
): Promise<{ items: ScanSummary[]; nextCursor?: string }> {
  const page = await es.query<ScanMeta>(ENTITY.scan, {
    index: "by-project",
    partition: projectId,
    limit,
    ...(cursor ? { cursor } : {}),
  });
  return {
    items: page.results
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((s) => ({
        scanId: s.scanId,
        status: s.status,
        createdAt: s.createdAt,
        ...(s.finishedAt !== undefined ? { finishedAt: s.finishedAt } : {}),
        workItemCount: s.workItemCount,
        sourceKind: s.sourceKind,
      })),
    ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
  };
}

// --- candidate ------------------------------------------------------------
export async function putCandidate(
  es: EntityStore,
  scanId: string,
  match: CandidateMatch,
  chunkIndex: number,
): Promise<void> {
  const rule = getRule(match.ruleId);
  const id = candidateEntityId(
    scanId,
    match.file,
    match.ruleId,
    match.startLine,
    match.endLine,
    match.snippet,
  );
  await es.set(ENTITY.candidate, id, {
    candidateId: id,
    scanId,
    ruleId: match.ruleId,
    filePath: match.file,
    lineStart: match.startLine,
    lineEnd: match.endLine,
    category: rule?.category ?? "config",
    severity: rule?.severity ?? "low",
    confidence: confidenceBucket(rule?.confidence ?? "low"),
    snippet: match.snippet,
    chunkIndex,
    createdAt: Date.now(),
  });
}

/** All candidates for a scan, walking the cursor (synthesis input). */
export async function collectCandidates(
  es: EntityStore,
  scanId: string,
): Promise<CandidateMatch[]> {
  const out: CandidateMatch[] = [];
  let cursor: string | undefined;
  do {
    const page = await es.query<{
      ruleId: string;
      filePath: string;
      lineStart: number;
      lineEnd: number;
      snippet: string;
    }>(ENTITY.candidate, {
      index: "by-scan",
      partition: scanId,
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    for (const r of page.results) {
      out.push({
        ruleId: r.ruleId,
        file: r.filePath,
        startLine: r.lineStart,
        endLine: r.lineEnd,
        snippet: r.snippet,
      });
    }
    cursor = page.nextCursor;
  } while (cursor);
  return out;
}

// --- workitem -------------------------------------------------------------
interface WorkItemRecord {
  workItemId: string;
  scanId: string;
  scanPhase: string;
  scanCategory: string;
  scanSeverity: string;
  title: string;
  category: Category;
  severity: string;
  confidence: number;
  priority: string;
  phase: number;
  effortPoints: number;
  occurrences: number;
  filePath: string;
  ruleId: string;
  jiraIssueKey: string | null;
  confluencePageId: string | null;
  blocksMigration: boolean;
  createdAt: number;
  payload: WorkItem;
}

export async function putWorkItem(
  es: EntityStore,
  scanId: string,
  wi: WorkItem,
): Promise<void> {
  const id = workItemEntityId(scanId, wi.ruleId, wi.location.file);
  const record: WorkItemRecord = {
    workItemId: id,
    scanId,
    scanPhase: `${scanId}#${wi.phase}`,
    scanCategory: `${scanId}#${wi.category}`,
    scanSeverity: `${scanId}#${wi.severity}`,
    title: wi.title,
    category: wi.category,
    severity: wi.severity,
    confidence: confidenceBucket(wi.confidence),
    priority: wi.priority,
    phase: wi.phase,
    effortPoints: wi.effort.storyPoints,
    occurrences: wi.occurrences,
    filePath: wi.location.file,
    ruleId: wi.ruleId,
    jiraIssueKey: wi.jiraIssueKey,
    confluencePageId: wi.confluencePageId,
    blocksMigration: wi.blocksMigration,
    createdAt: Date.parse(wi.detectedAt) || Date.now(),
    payload: wi,
  };
  await es.set(
    ENTITY.workitem,
    id,
    record as unknown as Record<string, unknown>,
  );
}

export type WorkItemFacet =
  | { type: "all" }
  | { type: "phase"; value: number }
  | { type: "category"; value: string }
  | { type: "severity"; value: string };

/** Guided-facet, cursor-paginated work item query (DECISIONS.md, P7 UI). */
export async function queryWorkItems(
  es: EntityStore,
  scanId: string,
  facet: WorkItemFacet,
  cursor?: string,
  pageSize = 50,
): Promise<{ items: WorkItem[]; nextCursor?: string }> {
  const route = (() => {
    switch (facet.type) {
      case "phase":
        return { index: "by-scan-phase", partition: `${scanId}#${facet.value}` };
      case "category":
        return {
          index: "by-scan-category",
          partition: `${scanId}#${facet.value}`,
        };
      case "severity":
        return {
          index: "by-scan-severity",
          partition: `${scanId}#${facet.value}`,
        };
      default:
        return { index: "by-scan", partition: scanId };
    }
  })();
  const page = await es.query<WorkItemRecord>(ENTITY.workitem, {
    index: route.index,
    partition: route.partition,
    limit: pageSize,
    ...(cursor ? { cursor } : {}),
  });
  return {
    items: page.results.map((r) => r.payload),
    ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
  };
}

export function getWorkItem(
  es: EntityStore,
  scanId: string,
  ruleId: string,
  file: string,
): Promise<WorkItemRecord | undefined> {
  return es.get<WorkItemRecord>(
    ENTITY.workitem,
    workItemEntityId(scanId, ruleId, file),
  );
}

// --- chunkstate (idempotent progress markers) -----------------------------
export async function markChunkDone(
  es: EntityStore,
  scanId: string,
  chunkIndex: number,
): Promise<void> {
  const csKey = `${scanId}#${chunkIndex}`;
  await es.set(ENTITY.chunkstate, csKey, {
    csKey,
    scanId,
    chunkIndex,
    doneAt: Date.now(),
  });
}

export async function countChunksDone(
  es: EntityStore,
  scanId: string,
): Promise<number> {
  let cursor: string | undefined;
  let n = 0;
  do {
    const page = await es.query<{ csKey: string }>(ENTITY.chunkstate, {
      index: "by-scan",
      partition: scanId,
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    n += page.results.length;
    cursor = page.nextCursor;
  } while (cursor);
  return n;
}

// --- blobpart (chunked ingest fallback) -----------------------------------
export async function putBlobPart(
  es: EntityStore,
  scanId: string,
  partIndex: number,
  total: number,
  dataB64: string,
): Promise<void> {
  const partKey = `${scanId}#${partIndex}`;
  await es.set(ENTITY.blobpart, partKey, {
    partKey,
    scanId,
    partIndex,
    total,
    data: dataB64,
    createdAt: Date.now(),
  });
}

export async function reassembleBlob(
  es: EntityStore,
  scanId: string,
): Promise<Uint8Array> {
  const parts: Array<{ partIndex: number; data: string }> = [];
  let cursor: string | undefined;
  do {
    const page = await es.query<{ partIndex: number; data: string }>(
      ENTITY.blobpart,
      {
        index: "by-scan",
        partition: scanId,
        limit: 100,
        ...(cursor ? { cursor } : {}),
      },
    );
    parts.push(...page.results);
    cursor = page.nextCursor;
  } while (cursor);
  parts.sort((a, b) => a.partIndex - b.partIndex);
  return Buffer.concat(parts.map((p) => Buffer.from(p.data, "base64")));
}

// --- exportartifact -------------------------------------------------------
export async function putArtifact(
  es: EntityStore,
  artifact: {
    artifactId: string;
    scanId: string;
    format: string;
    objectKey: string;
    sizeBytes: number;
  },
): Promise<void> {
  await es.set(ENTITY.exportartifact, artifact.artifactId, {
    ...artifact,
    createdAt: Date.now(),
  });
}

export function getArtifact(
  es: EntityStore,
  artifactId: string,
): Promise<
  | {
      artifactId: string;
      scanId: string;
      format: string;
      objectKey: string;
      sizeBytes: number;
    }
  | undefined
> {
  return es.get(ENTITY.exportartifact, artifactId);
}
