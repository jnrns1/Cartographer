import type { AppConfig, ScanEvent, ScanSource, SourceAdapter } from "../types";
import { createForgeStorage, createForgeQueue } from "../lib/forge";
import { loadZipBytes } from "../lib/ingest";
import { ZipSource, GitHubSource, BitbucketSource, fetchHttpClient } from "../sources";
import { handleScanEvent, type WorkerDeps } from "../workers/scan";

/**
 * Async scan worker, consumer of the `scan-queue` queue (manifest
 * `scan-consumer` -> `index.scanConsumer`). Thin Forge wiring around the pure
 * `handleScanEvent`; the worker logic is unit-tested with in-memory fakes (P6
 * integration test). The exact `@forge/events` consumer event shape is NEEDS
 * VERIFICATION AT BUILD TIME (DECISIONS.md), so the payload is read defensively.
 */
const srcKey = (scanId: string) => `scansrc:${scanId}`;

async function buildSource(scanId: string): Promise<SourceAdapter> {
  const ports = createForgeStorage();
  const source = await ports.kvs.get<ScanSource>(srcKey(scanId));
  if (!source) throw new Error(`no source descriptor for scan ${scanId}`);

  if (source.kind === "zip") {
    const cfg = await ports.kvs.get<AppConfig>("config:default");
    const mode = cfg?.ingestMode ?? "objectstore";
    const bytes = await loadZipBytes(ports, mode, scanId, source.objectKey);
    return new ZipSource(bytes);
  }

  const { fetch } = (await import("@forge/api")) as {
    fetch: (u: string, i?: { headers?: Record<string, string> }) => Promise<{
      status: number;
      ok: boolean;
      text(): Promise<string>;
      json(): Promise<unknown>;
    }>;
  };
  const http = fetchHttpClient(fetch);
  const token = (await ports.kvs.get<string>(source.tokenRef)) ?? "";

  if (source.kind === "github") {
    return new GitHubSource(
      { repo: source.repo, ...(source.ref ? { ref: source.ref } : {}), token },
      http,
    );
  }
  return new BitbucketSource(
    {
      workspace: source.workspace,
      repoSlug: source.repoSlug,
      ...(source.ref ? { ref: source.ref } : {}),
      token,
    },
    http,
  );
}

function deps(): WorkerDeps {
  return {
    ports: createForgeStorage(),
    queue: createForgeQueue(),
    sourceFor: buildSource,
  };
}

interface ForgeConsumerEvent {
  payload?: ScanEvent;
  body?: ScanEvent;
}

/** Manifest handler: index.scanConsumer. */
export async function scanConsumer(
  event: ForgeConsumerEvent | ScanEvent,
): Promise<{ ok: boolean }> {
  const payload =
    (event as ForgeConsumerEvent).payload ??
    (event as ForgeConsumerEvent).body ??
    (event as ScanEvent);
  await handleScanEvent(deps(), payload);
  return { ok: true };
}
