import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { badWorkItems } from "../helpers/items";
import { buildZip } from "../helpers/zip";
import { buildPlan } from "../../src/domain";
import {
  toJSON,
  toCSV,
  toMarkdown,
  toGhScript,
  serialize,
} from "../../src/exports";
import { makeMemoryPorts, InMemoryQueue, putScan } from "../../src/lib";
import { createProjectResolver } from "../../src/resolvers/project";
import { drainQueue } from "../../src/workers/scan";
import { ZipSource } from "../../src/sources";
import type { ScanMeta, SourceAdapter } from "../../src/types";

const items = badWorkItems();
const plan = (() => {
  const p = buildPlan({
    workItems: items,
    projectName: "Acme",
    scannedAt: "2026-05-17T10:00:00.000Z",
    teamSize: 3,
    sprintLengthWeeks: 2,
  });
  p.scanId = "scan-1";
  return p;
})();

describe("export serializers (brief 16.4)", () => {
  it("JSON parses and carries plan plus work items", () => {
    const parsed = JSON.parse(toJSON(plan, items));
    expect(parsed.plan.phases).toHaveLength(4);
    expect(parsed.workItems.length).toBe(items.length);
  });

  it("CSV has the Jira import header and one row per item", () => {
    const lines = toCSV(plan, items).split("\n");
    expect(lines[0]).toContain('"Summary"');
    expect(lines[0]).toContain('"Story Points"');
    expect(lines.length).toBe(items.length + 1);
  });

  it("Markdown has the report headings", () => {
    const md = toMarkdown(plan, items);
    expect(md).toContain("# BoxLang migration plan: Acme");
    expect(md).toContain("## Executive summary");
    expect(md).toContain("## Phase 1: Stabilize");
  });

  it("gh-script is valid idempotent bash", () => {
    const sh = toGhScript(plan, items);
    expect(sh.startsWith("#!/usr/bin/env bash")).toBe(true);
    expect(sh).toContain("set -euo pipefail");
    expect(sh).toContain("create_issue()");
    expect(sh).toContain("grep -Fxq");
    expect((sh.match(/^create_issue /gm) ?? []).length).toBe(items.length);
  });

  it("serialize picks the right extension and content type", () => {
    expect(serialize("json", plan, items).ext).toBe("json");
    expect(serialize("csv", plan, items).contentType).toBe("text/csv");
    expect(serialize("gh-script", plan, items).ext).toBe("sh");
  });
});

describe("export resolver returns a URL, never the body", () => {
  function realisticZip(): Buffer {
    const dir = join(process.cwd(), "test", "fixtures", "realistic");
    const files: Array<{ name: string; content: string }> = [];
    const walk = (d: string, base: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const abs = join(d, e.name);
        const rel = base ? `${base}/${e.name}` : e.name;
        if (e.isDirectory()) walk(abs, rel);
        else if (statSync(abs).isFile())
          files.push({ name: `app/${rel}`, content: readFileSync(abs, "utf8") });
      }
    };
    walk(dir, "");
    return buildZip(files);
  }

  it("scans the realistic corpus and serves a download url", async () => {
    const ports = makeMemoryPorts();
    const queue = new InMemoryQueue();
    const scan: ScanMeta = {
      scanId: "scan-r",
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
      scanId: "scan-r",
    });
    const zip = realisticZip();
    await drainQueue({
      ports,
      queue,
      sourceFor: async (): Promise<SourceAdapter> => new ZipSource(zip),
      now: () => 1_700_000_000_000,
    });

    const req = await core.requestExport({
      scanId: "scan-r",
      format: "json",
    });
    expect(req.ok).toBe(true);
    if (req.ok) {
      expect(req).not.toHaveProperty("content");
      expect(typeof req.artifactId).toBe("string");
      const got = await core.getExport({ artifactId: req.artifactId });
      expect(got.ok).toBe(true);
      if (got.ok) {
        expect(got.url).toContain("mem://get/");
        expect(got).not.toHaveProperty("content");
      }
    }

    const bad = await core.requestExport({
      scanId: "scan-r",
      format: "xml" as never,
    });
    expect(bad.ok === false && bad.code).toBe("invalid-input");
    const missing = await core.requestExport({
      scanId: "nope",
      format: "json",
    });
    expect(missing.ok === false && missing.code).toBe("not-found");
  });
});
