import { invoke } from "@forge/bridge";
import type {
  MigrationPlan,
  ProjectConfig,
  ScanProgress,
  ScanSource,
  ScanSummary,
  WorkItem,
} from "../../types";
import type { WorkItemFacet } from "../../lib/entities";

/**
 * Typed bridge wrapper. Every call funnels through `invoke`; resolver methods
 * return a discriminated result so the UI can branch without throwing.
 */
export type Ok<T> = { ok: true } & T;
export type ApiErr = { ok: false; code: string; message: string };
export type ApiResult<T> = Ok<T> | ApiErr;

function call<T>(
  method: string,
  payload: Record<string, unknown>,
): Promise<ApiResult<T>> {
  return invoke(method, payload) as Promise<ApiResult<T>>;
}

export const api = {
  getProjectState: (projectId: string) =>
    call<{
      recentScans: ScanSummary[];
      projectConfig: ProjectConfig;
    }>("getProjectState", { projectId }),

  startScan: (
    projectId: string,
    source: ScanSource,
    options?: { ignorePatterns?: string[] },
  ) => call<{ scanId: string }>("startScan", { projectId, source, options }),

  getScanProgress: (scanId: string) =>
    call<{ progress: ScanProgress }>("getScanProgress", { scanId }),

  getWorkItems: (
    scanId: string,
    facet: WorkItemFacet,
    cursor?: string,
    pageSize?: number,
  ) =>
    call<{ items: WorkItem[]; nextCursor?: string }>("getWorkItems", {
      scanId,
      facet,
      cursor,
      pageSize,
    }),

  getWorkItemDetail: (scanId: string, ruleId: string, file: string) =>
    call<{
      workItem: WorkItem;
      references: Array<{ key: string; title: string; url: string }>;
    }>("getWorkItemDetail", { scanId, ruleId, file }),

  getPlan: (scanId: string, teamSize: number, sprintLengthWeeks: number) =>
    call<{ plan: MigrationPlan }>("getPlan", {
      scanId,
      teamSize,
      sprintLengthWeeks,
    }),

  createJiraIssues: (scanId: string, workItemIds: string[]) =>
    call<{ created: string[]; skipped: string[]; failed: string[] }>(
      "createJiraIssues",
      { scanId, workItemIds },
    ),

  publishToConfluence: (scanId: string, spaceKey: string) =>
    call<{ parentPageId: string; childPageIds: string[]; updated: boolean }>(
      "publishToConfluence",
      { scanId, spaceKey },
    ),

  saveProjectConfig: (projectId: string, disabledRuleIds: string[]) =>
    call<{ projectConfig: ProjectConfig }>("saveProjectConfig", {
      projectId,
      disabledRuleIds,
    }),

  requestExport: (
    scanId: string,
    format: "json" | "markdown" | "csv" | "gh-script",
  ) =>
    call<{ artifactId: string; sizeBytes: number }>("requestExport", {
      scanId,
      format,
    }),

  getExport: (artifactId: string) =>
    call<{ url: string; format: string; sizeBytes: number }>("getExport", {
      artifactId,
    }),

  getPlanForView: (scanId: string) =>
    call<{ plan: MigrationPlan }>("getPlanForView", { scanId }),

  getPlanForSpace: (spaceKey: string) =>
    call<{ plan: MigrationPlan }>("getPlanForSpace", { spaceKey }),

  getAppHealth: () =>
    call<{
      version: string;
      runtime: string;
      catalogVersion: string;
      ruleCount: number;
    }>("getAppHealth", {}),

  getSiteConfig: () =>
    call<{
      config: {
        telemetryOptIn: boolean;
        ingestMode: "objectstore" | "chunked";
        ruleCatalogVersion: string;
      };
    }>("getSiteConfig", {}),

  updateSiteConfig: (patch: {
    telemetryOptIn?: boolean;
    ingestMode?: "objectstore" | "chunked";
  }) =>
    call<{
      config: {
        telemetryOptIn: boolean;
        ingestMode: "objectstore" | "chunked";
        ruleCatalogVersion: string;
      };
    }>("updateSiteConfig", { patch }),

  getRuleCatalog: () =>
    call<{
      version: string;
      count: number;
      rules: Array<{ id: string; title: string; category: string }>;
    }>("getRuleCatalog", {}),
};
