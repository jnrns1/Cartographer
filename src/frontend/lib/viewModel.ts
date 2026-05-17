import type {
  MigrationPlan,
  ScanProgress,
  ScanSummary,
  Severity,
  WorkItem,
} from "../../types";
import type { WorkItemFacet } from "../../lib/entities";

/**
 * Pure presentation logic for the project page. All view shaping lives here so
 * it is unit-tested with Vitest; the .tsx components stay thin declarative
 * shells (DECISIONS.md: UI Kit renders to a Forge tree, not the DOM).
 */
export interface Lozenge {
  text: string;
  appearance: "default" | "inprogress" | "success" | "removed" | "moved";
}

export function statusLozenge(status: string): Lozenge {
  switch (status) {
    case "complete":
      return { text: "Complete", appearance: "success" };
    case "failed":
      return { text: "Failed", appearance: "removed" };
    case "queued":
      return { text: "Queued", appearance: "default" };
    default:
      return { text: status, appearance: "inprogress" };
  }
}

export function severityLozenge(sev: Severity): Lozenge {
  switch (sev) {
    case "critical":
      return { text: "Critical", appearance: "removed" };
    case "high":
      return { text: "High", appearance: "moved" };
    case "medium":
      return { text: "Medium", appearance: "inprogress" };
    default:
      return { text: "Low", appearance: "default" };
  }
}

export interface SummaryCards {
  totalWorkItems: number;
  blocksMigration: number;
  estimatedHours: number;
  byCategory: Array<{ category: string; count: number }>;
}

/** Dashboard cards computed from the loaded work items of one scan. */
export function summarize(items: WorkItem[]): SummaryCards {
  const byCategory = new Map<string, number>();
  let blocks = 0;
  let hours = 0;
  for (const wi of items) {
    byCategory.set(wi.category, (byCategory.get(wi.category) ?? 0) + 1);
    if (wi.blocksMigration) blocks++;
    hours += wi.effort.estimatedHours.expected;
  }
  return {
    totalWorkItems: items.length,
    blocksMigration: blocks,
    estimatedHours: Math.round(hours * 10) / 10,
    byCategory: [...byCategory.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export interface TableRow {
  key: string;
  cells: Array<{ key: string; content: string }>;
}

export function toTableRows(items: WorkItem[]): TableRow[] {
  return items.map((wi) => ({
    key: wi.id,
    cells: [
      { key: "id", content: wi.id },
      { key: "title", content: wi.title },
      { key: "category", content: wi.category },
      { key: "severity", content: wi.severity },
      { key: "effort", content: `${wi.effort.storyPoints} pts` },
      { key: "jira", content: wi.jiraIssueKey ?? "-" },
    ],
  }));
}

export const WORK_ITEM_COLUMNS = [
  "ID",
  "Title",
  "Category",
  "Severity",
  "Effort",
  "Jira",
];

/** Map a UI filter selection to the single guided-facet route (DECISIONS.md). */
export function facetFromFilter(filter: {
  primary: "all" | "phase" | "category" | "severity";
  value?: string | number;
}): WorkItemFacet {
  switch (filter.primary) {
    case "phase":
      return { type: "phase", value: Number(filter.value ?? 1) };
    case "category":
      return { type: "category", value: String(filter.value ?? "security") };
    case "severity":
      return { type: "severity", value: String(filter.value ?? "critical") };
    default:
      return { type: "all" };
  }
}

export function progressLabel(p: ScanProgress): string {
  return `${p.currentStep} (${p.percentComplete}%)`;
}

export interface PhaseColumn {
  phase: number;
  name: string;
  workItemCount: number;
  totalHours: number;
  sprints: number;
}

/** PhaseColumn data for the Plan tab (brief 8 Plan view). */
export function planColumns(plan: MigrationPlan): PhaseColumn[] {
  return plan.phases.map((p) => ({
    phase: p.phase,
    name: p.name,
    workItemCount: p.workItemCount,
    totalHours: p.totalHours,
    sprints: p.sprintRecommendation.sprints,
  }));
}

export function planRows(plan: MigrationPlan): TableRow[] {
  return planColumns(plan).map((c) => ({
    key: `phase-${c.phase}`,
    cells: [
      { key: "phase", content: `Phase ${c.phase}: ${c.name}` },
      { key: "items", content: String(c.workItemCount) },
      { key: "hours", content: String(c.totalHours) },
      { key: "sprints", content: String(c.sprints) },
    ],
  }));
}

export const PLAN_COLUMNS = ["Phase", "Work items", "Hours", "Sprints"];

export function recentScanRows(scans: ScanSummary[]): TableRow[] {
  return scans.map((s) => ({
    key: s.scanId,
    cells: [
      { key: "scan", content: s.scanId },
      { key: "status", content: statusLozenge(s.status).text },
      { key: "items", content: String(s.workItemCount) },
      { key: "source", content: s.sourceKind },
      {
        key: "when",
        content: new Date(s.createdAt).toISOString().slice(0, 10),
      },
    ],
  }));
}
