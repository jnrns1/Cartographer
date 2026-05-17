import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildZip } from "../helpers/zip";
import { makeMemoryPorts, InMemoryQueue } from "../../src/lib";
import { createProjectResolver } from "../../src/resolvers/project";
import { drainQueue } from "../../src/workers/scan";
import { ZipSource } from "../../src/sources";
import type { ScanSource, SourceAdapter } from "../../src/types";

const FIXBAD = join(process.cwd(), "test", "fixtures", "bad");
const zip = buildZip(
  readdirSync(FIXBAD).map((n) => ({
    name: `src/${n}`,
    content: readFileSync(join(FIXBAD, n), "utf8"),
  })),
);

function setup() {
  const ports = makeMemoryPorts();
  const queue = new InMemoryQueue();
  const core = createProjectResolver({ ports, queue, now: () => 1_700_000_000 });
  const worker = {
    ports,
    queue,
    sourceFor: async (): Promise<SourceAdapter> => new ZipSource(zip),
    now: () => 1_700_000_000_000,
  };
  return { ports, queue, core, worker };
}

describe("project resolver core (brief 8.1)", () => {
  it("runs a zip scan end to end and serves project state", async () => {
    const { core, worker } = setup();
    const src: ScanSource = { kind: "zip", objectKey: "k" };
    const started = await core.startScan({
      projectId: "P1",
      source: src,
      scanId: "scan-1",
    });
    expect(started.ok).toBe(true);
    await drainQueue(worker);

    const state = await core.getProjectState({ projectId: "P1" });
    expect(state.ok && state.recentScans[0]?.scanId).toBe("scan-1");

    const prog = await core.getScanProgress({ scanId: "scan-1" });
    expect(prog.ok && prog.progress.status).toBe("complete");
    expect(prog.ok && prog.progress.percentComplete).toBe(100);

    const all = await core.getWorkItems({ scanId: "scan-1" });
    expect(all.ok && all.items.length).toBeGreaterThan(0);

    const sec = await core.getWorkItems({
      scanId: "scan-1",
      facet: { type: "category", value: "security" },
    });
    expect(sec.ok && sec.items.every((w) => w.category === "security")).toBe(
      true,
    );

    const first = all.ok ? all.items[0] : undefined;
    const detail = await core.getWorkItemDetail({
      scanId: "scan-1",
      ruleId: first?.ruleId ?? "",
      file: first?.location.file ?? "",
    });
    expect(detail.ok && detail.workItem.id).toBe(first?.id);
    expect(detail.ok && Array.isArray(detail.references)).toBe(true);
  });

  it("paginates work items with a cursor", async () => {
    const { core, worker } = setup();
    await core.startScan({
      projectId: "P1",
      source: { kind: "zip" },
      scanId: "scan-2",
    });
    await drainQueue(worker);
    const page1 = await core.getWorkItems({
      scanId: "scan-2",
      pageSize: 5,
    });
    expect(page1.ok && page1.items.length).toBe(5);
    expect(page1.ok && page1.nextCursor).toBeTruthy();
    const page2 = await core.getWorkItems({
      scanId: "scan-2",
      pageSize: 5,
      cursor: page1.ok ? page1.nextCursor : undefined,
    });
    expect(page2.ok && page2.items.length).toBeGreaterThan(0);
    const ids1 = page1.ok ? page1.items.map((w) => w.id) : [];
    const ids2 = page2.ok ? page2.items.map((w) => w.id) : [];
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });

  it("validates input and never throws raw", async () => {
    const { core } = setup();
    const a = await core.getProjectState({ projectId: "" });
    expect(a.ok).toBe(false);
    const b = await core.getScanProgress({ scanId: "nope" });
    expect(b.ok === false && b.code).toBe("not-found");
    const c = await core.startScan({
      projectId: "P1",
      source: { kind: "github" } as unknown as ScanSource,
    });
    expect(c.ok === false && c.code).toBe("invalid-input");
    const d = await core.presignZip({
      projectId: "P1",
      scanId: "s",
      length: 99_999_999_999,
      sha256: "x",
    });
    expect(d.ok).toBe(false);
  });

  it("wires Jira creation, Confluence publish, and plan views", async () => {
    const ports = makeMemoryPorts();
    const queue = new InMemoryQueue();
    const jiraKeys = new Map<string, string>();
    let jn = 0;
    const jira = {
      async getProjectMeta() {
        return { priorityAvailable: true };
      },
      async findIssueKeyByCartographerId(s: string, c: string) {
        return jiraKeys.get(`${s}:${c}`) ?? null;
      },
      async createIssue() {
        return { key: `J-${++jn}` };
      },
      async setCartographerId(k: string, s: string, c: string) {
        jiraKeys.set(`${s}:${c}`, k);
      },
    };
    const pages = new Map<string, { title: string; version: number }>();
    let pn = 0;
    const confluence = {
      async findPageByTitle(_s: string, t: string) {
        for (const [id, p] of pages) {
          if (p.title === t) return { id, version: p.version };
        }
        return null;
      },
      async createPage(i: { title: string }) {
        const id = `C-${++pn}`;
        pages.set(id, { title: i.title, version: 1 });
        return { id };
      },
      async updatePage(i: { id: string; title: string; version: number }) {
        pages.set(i.id, { title: i.title, version: i.version });
        return { id: i.id };
      },
    };
    const core = createProjectResolver({ ports, queue, jira, confluence });
    await core.startScan({
      projectId: "Acme",
      source: { kind: "zip" },
      scanId: "scan-9",
    });
    await drainQueue({
      ports,
      queue,
      sourceFor: async (): Promise<SourceAdapter> => new ZipSource(zip),
      now: () => 1_700_000_000_000,
    });

    const created = await core.createJiraIssues({ scanId: "scan-9" });
    expect(created.ok && created.created.length).toBeGreaterThan(0);
    const again = await core.createJiraIssues({ scanId: "scan-9" });
    expect(again.ok && again.created).toEqual([]); // idempotent

    const pub = await core.publishToConfluence({
      scanId: "scan-9",
      spaceKey: "ENG",
    });
    expect(pub.ok && pub.childPageIds.length).toBe(4);
    const view = await core.getPlanForView({ scanId: "scan-9" });
    expect(view.ok && view.plan.phases.length).toBe(4);
    const space = await core.getPlanForSpace({ spaceKey: "ENG" });
    expect(space.ok && space.plan.scanId).toBe("scan-9");

    const noJira = createProjectResolver({ ports, queue });
    const fail = await noJira.createJiraIssues({ scanId: "scan-9" });
    expect(fail.ok === false && fail.code).toBe("internal");
  });

  it("persists project settings", async () => {
    const { core } = setup();
    const saved = await core.saveProjectConfig({
      projectId: "P1",
      disabledRuleIds: ["CFML-AI-001"],
    });
    expect(saved.ok && saved.projectConfig.disabledRuleIds).toContain(
      "CFML-AI-001",
    );
    const state = await core.getProjectState({ projectId: "P1" });
    expect(
      state.ok && state.projectConfig.disabledRuleIds,
    ).toContain("CFML-AI-001");
  });
});
