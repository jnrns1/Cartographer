import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import yaml from "js-yaml";
import { buildZip } from "../helpers/zip";
import {
  makeMemoryPorts,
  INDEX_SPECS,
  putScan,
  getScan,
  listScans,
  putCandidate,
  collectCandidates,
  putWorkItem,
  queryWorkItems,
  markChunkDone,
  countChunksDone,
  putArtifact,
  getArtifact,
  presignZipUpload,
  acceptZipPart,
  loadZipBytes,
  MAX_ZIP_BYTES,
} from "../../src/lib";
import { presign } from "../../src/functions/osPresign";
import { scanFile, synthesize } from "../../src/domain";
import { ZipSource } from "../../src/sources";
import type { FileRef, ScanMeta } from "../../src/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw YAML doc
const manifest = yaml.load(
  readFileSync(join(process.cwd(), "manifest.yml"), "utf8"),
) as any;

const FIXBAD = join(process.cwd(), "test", "fixtures", "bad");

function badScan() {
  const candidates = [];
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
  return { candidates, loc };
}

describe("INDEX_SPECS mirror manifest.yml exactly", () => {
  it("matches every declared entity index", () => {
    for (const ent of manifest.app.storage.entities) {
      for (const idx of ent.indexes ?? []) {
        if (typeof idx === "string") continue;
        const spec = INDEX_SPECS[ent.name]?.[idx.name];
        expect(spec, `${ent.name}.${idx.name}`).toBeDefined();
        expect(spec?.partition).toBe(idx.partition[0]);
        expect(spec?.range).toBe(idx.range?.[0]);
      }
    }
  });
});

describe("scan + work item DAOs over the in-memory entity store", () => {
  it("stores and lists scans newest-first", async () => {
    const { entities } = makeMemoryPorts();
    const base: Omit<ScanMeta, "scanId" | "createdAt"> = {
      projectId: "P1",
      status: "complete",
      sourceKind: "zip",
      totalFiles: 1,
      processedFiles: 1,
      candidateCount: 0,
      workItemCount: 0,
      chunkTotal: 1,
      chunkDone: 1,
    };
    await putScan(entities, { ...base, scanId: "s1", createdAt: 100 });
    await putScan(entities, { ...base, scanId: "s2", createdAt: 200 });
    expect((await getScan(entities, "s2"))?.createdAt).toBe(200);
    const list = await listScans(entities, "P1");
    expect(list.items.map((s) => s.scanId)).toEqual(["s2", "s1"]);
  });

  it("persists candidates idempotently and reads them via the cursor", async () => {
    const { entities } = makeMemoryPorts();
    const { candidates } = badScan();
    for (const c of candidates) await putCandidate(entities, "scan-1", c, 0);
    const back = await collectCandidates(entities, "scan-1");
    // Truly identical matches collapse on the deterministic key; distinct
    // matches are preserved, and rule coverage survives storage.
    expect(back.length).toBeLessThanOrEqual(candidates.length);
    expect(back.length).toBeGreaterThan(40);
    expect(new Set(back.map((c) => c.ruleId)).size).toBeGreaterThan(20);
    // Re-applying every candidate (at-least-once redelivery) is idempotent.
    for (const c of candidates) await putCandidate(entities, "scan-1", c, 0);
    expect((await collectCandidates(entities, "scan-1")).length).toBe(
      back.length,
    );
  });

  it("queries work items by guided facet with cursor pagination", async () => {
    const { entities } = makeMemoryPorts();
    const { candidates, loc } = badScan();
    const items = synthesize({
      candidates,
      fileLoc: loc,
      scanId: "scan-1",
      detectedAt: "2026-05-17T10:00:00.000Z",
    });
    for (const wi of items) await putWorkItem(entities, "scan-1", wi);

    const all: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await queryWorkItems(
        entities,
        "scan-1",
        { type: "all" },
        cursor,
        10,
      );
      all.push(...page.items.map((w) => w.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(all.length).toBe(items.length);
    expect(new Set(all).size).toBe(items.length);

    const phase1 = await queryWorkItems(entities, "scan-1", {
      type: "phase",
      value: 1,
    });
    expect(phase1.items.every((w) => w.phase === 1)).toBe(true);
    const sec = await queryWorkItems(entities, "scan-1", {
      type: "category",
      value: "security",
    });
    expect(sec.items.every((w) => w.category === "security")).toBe(true);
    expect(sec.items.length).toBeGreaterThan(0);
  });

  it("derives chunk progress from idempotent markers", async () => {
    const { entities } = makeMemoryPorts();
    await markChunkDone(entities, "scan-1", 0);
    await markChunkDone(entities, "scan-1", 1);
    await markChunkDone(entities, "scan-1", 0); // redelivery
    expect(await countChunksDone(entities, "scan-1")).toBe(2);
  });

  it("round-trips export artifacts", async () => {
    const { entities } = makeMemoryPorts();
    await putArtifact(entities, {
      artifactId: "a1",
      scanId: "scan-1",
      format: "json",
      objectKey: "export/scan-1/a1.json",
      sizeBytes: 1234,
    });
    expect((await getArtifact(entities, "a1"))?.format).toBe("json");
  });
});

describe("dual-mode ingest", () => {
  const zip = buildZip([
    { name: "src/User.cfc", content: "<cfset x = 1>" },
    { name: "views/list.cfm", content: "<cfoutput>1</cfoutput>" },
  ]);

  it("presigns an object-store upload and enforces the size cap", async () => {
    const ports = makeMemoryPorts();
    const { url } = await presignZipUpload(ports, "s1", zip.length, "abc");
    expect(url).toContain("mem://put/");
    await expect(
      presignZipUpload(ports, "s1", MAX_ZIP_BYTES + 1, "abc"),
    ).rejects.toThrow(/cap/);
  });

  it("loads object-store bytes back", async () => {
    const ports = makeMemoryPorts();
    await ports.objects.putBytes("scan/s1/src.zip", zip);
    const bytes = await loadZipBytes(ports, "objectstore", "s1");
    expect(Buffer.from(bytes).equals(zip)).toBe(true);
  });

  it("reassembles a chunked upload and the result is a valid zip", async () => {
    const ports = makeMemoryPorts();
    // Split on raw bytes (not base64 chars) so each part decodes independently.
    const half = Math.ceil(zip.length / 2);
    await acceptZipPart(
      ports,
      "s1",
      0,
      2,
      zip.subarray(0, half).toString("base64"),
    );
    await acceptZipPart(
      ports,
      "s1",
      1,
      2,
      zip.subarray(half).toString("base64"),
    );
    const bytes = await loadZipBytes(ports, "chunked", "s1");
    const names = [];
    for await (const f of new ZipSource(bytes).listFiles({ ignorePatterns: [] })) {
      names.push(f.path);
    }
    expect(names.sort()).toEqual(["src/User.cfc", "views/list.cfm"]);
  });

  it("rejects an oversize or out-of-range part", async () => {
    const ports = makeMemoryPorts();
    await expect(acceptZipPart(ports, "s1", 2, 2, "AA")).rejects.toThrow(
      /invalid blob part/,
    );
    const big = Buffer.alloc(200 * 1024 + 1).toString("base64");
    await expect(acceptZipPart(ports, "s1", 0, 1, big)).rejects.toThrow(/over/);
  });
});

describe("osPresign pure core", () => {
  it("returns an upload url and a download url only when present", async () => {
    const ports = makeMemoryPorts();
    const up = await presign(ports.objects, {
      action: "upload",
      key: "k",
      length: 3,
      checksum: "x",
    });
    expect(up.url).toContain("mem://put/");
    const missing = await presign(ports.objects, {
      action: "download",
      key: "k",
    });
    expect(missing.url).toBeNull();
    await ports.objects.putBytes("k", new Uint8Array([1, 2, 3]));
    const dl = await presign(ports.objects, { action: "download", key: "k" });
    expect(dl.url).toContain("mem://get/");
  });

  it("requires a key", async () => {
    const ports = makeMemoryPorts();
    await expect(
      presign(ports.objects, { key: "" } as never),
    ).rejects.toThrow(/key/);
  });
});
