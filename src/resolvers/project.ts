import type {
  ProjectConfig,
  ResolverResult,
  ScanOptions,
  ScanProgress,
  ScanSource,
  ScanSummary,
  WorkItem,
} from "../types";
import type { QueuePort, StoragePorts } from "../lib/ports";
import {
  getScan,
  putScan,
  listScans,
  queryWorkItems,
  getWorkItem,
  type WorkItemFacet,
} from "../lib/entities";
import { presignZipUpload, acceptZipPart, zipObjectKey } from "../lib/ingest";
import { resolveReferences } from "../catalog";
import { buildPlan, stableId } from "../domain";
import { putWorkItem, putArtifact, getArtifact } from "../lib/entities";
import { serialize } from "../exports";
import type { ExportFormat } from "../types";
import {
  createJiraIssues as runCreateJiraIssues,
  type JiraClient,
} from "../jira/issueCreator";
import {
  publishPlan,
  type ConfluenceClient,
} from "../confluence/pagePublisher";
import type { MigrationPlan } from "../types";

/**
 * Pure project-page resolver core (brief 8.1). No Forge imports: every method
 * takes injected ports so the whole surface is unit-tested with the in-memory
 * fakes. The Forge resolver registration in resolvers/index.ts binds these to
 * the live storage and queue. Methods return a discriminated result and never
 * throw raw (brief 8.4).
 */
export interface ProjectResolverDeps {
  ports: StoragePorts;
  queue: QueuePort;
  jira?: JiraClient;
  confluence?: ConfluenceClient;
  now?: () => number;
}

async function collectAllWorkItems(
  ports: StoragePorts,
  scanId: string,
): Promise<WorkItem[]> {
  const items: WorkItem[] = [];
  let cursor: string | undefined;
  do {
    const page = await queryWorkItems(
      ports.entities,
      scanId,
      { type: "all" },
      cursor,
      100,
    );
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
}

const ok = <T extends object>(v: T): { ok: true } & T => ({ ok: true, ...v });
const err = (
  code: "unauthorized" | "invalid-input" | "not-found" | "conflict" | "internal",
  message: string,
): ResolverResult<never> => ({ ok: false, code, message });

function newScanId(projectId: string, now: number): string {
  return `${projectId}-${now}-${Math.floor(Math.random() * 1e6)}`;
}

function validSource(s: unknown): s is ScanSource {
  if (!s || typeof s !== "object") return false;
  const k = (s as { kind?: string }).kind;
  if (k === "zip") return true;
  if (k === "github") return typeof (s as { repo?: string }).repo === "string";
  if (k === "bitbucket") {
    return (
      typeof (s as { workspace?: string }).workspace === "string" &&
      typeof (s as { repoSlug?: string }).repoSlug === "string"
    );
  }
  return false;
}

export function createProjectResolver(deps: ProjectResolverDeps) {
  const now = deps.now ?? Date.now;
  const { ports, queue } = deps;

  return {
    async getProjectState(input: { projectId: string }) {
      if (!input?.projectId) return err("invalid-input", "projectId required");
      const scans = await listScans(ports.entities, input.projectId);
      const projectConfig =
        (await ports.kvs.get<ProjectConfig>(`proj:${input.projectId}`)) ?? {
          projectId: input.projectId,
          disabledRuleIds: [],
        };
      return ok({
        recentScans: scans.items,
        projectConfig,
        ...(scans.nextCursor ? { nextCursor: scans.nextCursor } : {}),
      });
    },

    async presignZip(input: {
      projectId: string;
      scanId: string;
      length: number;
      sha256: string;
    }) {
      if (!input?.scanId || !input?.length) {
        return err("invalid-input", "scanId and length required");
      }
      try {
        const { url } = await presignZipUpload(
          ports,
          input.scanId,
          input.length,
          input.sha256 ?? "",
        );
        return ok({ url, objectKey: zipObjectKey(input.scanId) });
      } catch (e) {
        return err("invalid-input", (e as Error).message);
      }
    },

    async putZipPart(input: {
      scanId: string;
      partIndex: number;
      total: number;
      dataB64: string;
    }) {
      try {
        await acceptZipPart(
          ports,
          input.scanId,
          input.partIndex,
          input.total,
          input.dataB64,
        );
        return ok({});
      } catch (e) {
        return err("invalid-input", (e as Error).message);
      }
    },

    async startScan(input: {
      projectId: string;
      source: ScanSource;
      options?: Partial<ScanOptions>;
      scanId?: string;
    }) {
      if (!input?.projectId) return err("invalid-input", "projectId required");
      if (!validSource(input.source)) {
        return err("invalid-input", "unsupported or malformed source");
      }
      const ts = now();
      const scanId = input.scanId ?? newScanId(input.projectId, ts);
      await putScan(ports.entities, {
        scanId,
        projectId: input.projectId,
        status: "queued",
        sourceKind: input.source.kind,
        ...(input.source.kind === "zip"
          ? { objectKey: input.source.objectKey ?? zipObjectKey(scanId) }
          : {}),
        totalFiles: 0,
        processedFiles: 0,
        candidateCount: 0,
        workItemCount: 0,
        chunkTotal: 0,
        chunkDone: 0,
        createdAt: ts,
      });
      await ports.kvs.set(`scansrc:${scanId}`, input.source);
      await ports.kvs.set(`scanopts:${scanId}`, {
        ignorePatterns: input.options?.ignorePatterns ?? [],
        includeCategories: input.options?.includeCategories ?? [],
      });
      await queue.push({ scanId, phase: "bootstrap" });
      return ok({ scanId });
    },

    async getScanProgress(input: { scanId: string }) {
      const scan = await getScan(ports.entities, input?.scanId);
      if (!scan) return err("not-found", `scan ${input?.scanId} not found`);
      const pct =
        scan.status === "complete"
          ? 100
          : scan.totalFiles > 0
            ? Math.min(
                99,
                Math.round((scan.processedFiles / scan.totalFiles) * 100),
              )
            : scan.status === "queued"
              ? 0
              : 5;
      const step: Record<string, string> = {
        queued: "Queued",
        scanning: `Scanning files (${scan.processedFiles}/${scan.totalFiles})`,
        synthesizing: "Building work items",
        complete: "Complete",
        failed: scan.error ?? "Failed",
      };
      const progress: ScanProgress = {
        status: scan.status,
        percentComplete: pct,
        currentStep: step[scan.status] ?? scan.status,
        chunkDone: scan.chunkDone,
        chunkTotal: scan.chunkTotal,
      };
      return ok({ progress });
    },

    async getWorkItems(input: {
      scanId: string;
      facet?: WorkItemFacet;
      cursor?: string;
      pageSize?: number;
    }) {
      if (!input?.scanId) return err("invalid-input", "scanId required");
      const page = await queryWorkItems(
        ports.entities,
        input.scanId,
        input.facet ?? { type: "all" },
        input.cursor,
        input.pageSize ?? 50,
      );
      return ok(page);
    },

    async getWorkItemDetail(input: {
      scanId: string;
      ruleId: string;
      file: string;
    }) {
      const rec = await getWorkItem(
        ports.entities,
        input?.scanId,
        input?.ruleId,
        input?.file,
      );
      if (!rec) return err("not-found", "work item not found");
      const wi = rec.payload as WorkItem;
      return ok({ workItem: wi, references: resolveReferences(wi.references) });
    },

    async getPlan(input: {
      scanId: string;
      teamSize?: number;
      sprintLengthWeeks?: number;
      projectName?: string;
    }) {
      const scan = await getScan(ports.entities, input?.scanId);
      if (!scan) return err("not-found", `scan ${input?.scanId} not found`);
      const items = await collectAllWorkItems(ports, input.scanId);

      const plan = buildPlan({
        workItems: items,
        projectName: input.projectName ?? scan.projectId,
        scannedAt: new Date(scan.createdAt).toISOString(),
        teamSize: input.teamSize ?? 3,
        sprintLengthWeeks: input.sprintLengthWeeks ?? 2,
      });
      plan.scanId = input.scanId;
      await ports.kvs.set(`plan:${input.scanId}`, plan);
      return ok({ plan });
    },

    async getPlanForView(input: { scanId: string }) {
      const plan = await ports.kvs.get<MigrationPlan>(
        `plan:${input?.scanId}`,
      );
      if (!plan) return err("not-found", "no published plan for this scan");
      return ok({ plan });
    },

    async requestExport(input: {
      scanId: string;
      format: ExportFormat;
    }) {
      const scan = await getScan(ports.entities, input?.scanId);
      if (!scan) return err("not-found", `scan ${input?.scanId} not found`);
      const valid: ExportFormat[] = ["json", "markdown", "csv", "gh-script"];
      if (!valid.includes(input.format)) {
        return err("invalid-input", "unsupported export format");
      }
      const items = await collectAllWorkItems(ports, input.scanId);
      let plan = await ports.kvs.get<MigrationPlan>(`plan:${input.scanId}`);
      if (!plan) {
        plan = buildPlan({
          workItems: items,
          projectName: scan.projectId,
          scannedAt: new Date(scan.createdAt).toISOString(),
          teamSize: 3,
          sprintLengthWeeks: 2,
        });
        plan.scanId = input.scanId;
      }
      const { content, ext } = serialize(input.format, plan, items);
      const bytes = new TextEncoder().encode(content);
      const artifactId = stableId([input.scanId, input.format]);
      const objectKey = `export/${input.scanId}/${artifactId}.${ext}`;
      await ports.objects.putBytes(objectKey, bytes);
      await putArtifact(ports.entities, {
        artifactId,
        scanId: input.scanId,
        format: input.format,
        objectKey,
        sizeBytes: bytes.length,
      });
      // Never returns the body, only a handle (brief 16.4, DECISIONS.md).
      return ok({ artifactId, sizeBytes: bytes.length });
    },

    async getExport(input: { artifactId: string }) {
      const art = await getArtifact(ports.entities, input?.artifactId);
      if (!art) return err("not-found", "export not found");
      const dl = await ports.objects.createDownloadUrl(art.objectKey);
      if (!dl) return err("internal", "export object unavailable");
      return ok({ url: dl.url, format: art.format, sizeBytes: art.sizeBytes });
    },

    async getPlanForSpace(input: { spaceKey: string }) {
      const scanId = await ports.kvs.get<string>(
        `spacelatest:${input?.spaceKey}`,
      );
      if (!scanId) return err("not-found", "no plan published to this space");
      const plan = await ports.kvs.get<MigrationPlan>(`plan:${scanId}`);
      if (!plan) return err("not-found", "plan missing for this space");
      return ok({ plan });
    },

    async createJiraIssues(input: {
      scanId: string;
      workItemIds?: string[];
    }) {
      if (!deps.jira) return err("internal", "Jira client unavailable");
      const scan = await getScan(ports.entities, input?.scanId);
      if (!scan) return err("not-found", `scan ${input?.scanId} not found`);
      let items = await collectAllWorkItems(ports, input.scanId);
      if (input.workItemIds && input.workItemIds.length > 0) {
        const want = new Set(input.workItemIds);
        items = items.filter((w) => want.has(w.id));
      }
      const res = await runCreateJiraIssues({
        client: deps.jira,
        projectId: scan.projectId,
        scanId: input.scanId,
        workItems: items,
      });
      return ok({
        created: res.created,
        skipped: res.skipped,
        failed: res.failed,
      });
    },

    async publishToConfluence(input: { scanId: string; spaceKey: string }) {
      if (!deps.confluence) {
        return err("internal", "Confluence client unavailable");
      }
      if (!input?.spaceKey) {
        return err("invalid-input", "spaceKey required");
      }
      const scan = await getScan(ports.entities, input?.scanId);
      if (!scan) return err("not-found", `scan ${input?.scanId} not found`);
      const items = await collectAllWorkItems(ports, input.scanId);
      let plan = await ports.kvs.get<MigrationPlan>(`plan:${input.scanId}`);
      if (!plan) {
        plan = buildPlan({
          workItems: items,
          projectName: scan.projectId,
          scannedAt: new Date(scan.createdAt).toISOString(),
          teamSize: 3,
          sprintLengthWeeks: 2,
        });
        plan.scanId = input.scanId;
        await ports.kvs.set(`plan:${input.scanId}`, plan);
      }
      const res = await publishPlan({
        client: deps.confluence,
        spaceKey: input.spaceKey,
        plan,
        workItems: items,
      });
      await ports.kvs.set(`spacelatest:${input.spaceKey}`, input.scanId);
      // Back-link each work item to its phase child page.
      for (const wi of items) {
        const idx = plan.phases.findIndex((p) => p.phase === wi.phase);
        const pageId = res.childPageIds[idx];
        if (pageId && wi.confluencePageId !== pageId) {
          await putWorkItem(ports.entities, input.scanId, {
            ...wi,
            confluencePageId: pageId,
          });
        }
      }
      return ok(res);
    },

    async saveProjectConfig(input: {
      projectId: string;
      disabledRuleIds: string[];
    }) {
      if (!input?.projectId) return err("invalid-input", "projectId required");
      const cfg: ProjectConfig = {
        projectId: input.projectId,
        disabledRuleIds: input.disabledRuleIds ?? [],
      };
      await ports.kvs.set(`proj:${input.projectId}`, cfg);
      return ok({ projectConfig: cfg });
    },
  };
}

export type ProjectResolver = ReturnType<typeof createProjectResolver>;
