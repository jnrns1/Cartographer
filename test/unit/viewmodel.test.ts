import { describe, it, expect } from "vitest";
import {
  statusLozenge,
  severityLozenge,
  summarize,
  toTableRows,
  facetFromFilter,
  progressLabel,
  recentScanRows,
  WORK_ITEM_COLUMNS,
} from "../../src/frontend/lib/viewModel";
import type { ScanProgress, WorkItem } from "../../src/types";

function wi(over: Partial<WorkItem>): WorkItem {
  return {
    id: "WI-0001",
    title: "t",
    category: "security",
    subcategory: "x",
    severity: "critical",
    priority: "P0",
    ruleId: "CFML-SEC-001",
    confidence: "medium",
    jiraIssueType: "Bug",
    effort: {
      tshirt: "S",
      storyPoints: 3,
      estimatedHours: { low: 1, expected: 2, high: 4 },
      notes: "n",
    },
    location: { file: "a.cfm", startLine: 1, endLine: 2, snippet: "s" },
    occurrences: 1,
    rationale: "r",
    recommendation: "rec",
    references: [],
    ortusModules: [],
    blocksMigration: true,
    blocks: [],
    blockedBy: [],
    phase: 1,
    tags: [],
    jiraIssueKey: null,
    confluencePageId: null,
    detectedAt: "2026-05-17T00:00:00.000Z",
    ...over,
  };
}

describe("view model", () => {
  it("maps statuses and severities to lozenges", () => {
    expect(statusLozenge("complete").appearance).toBe("success");
    expect(statusLozenge("failed").appearance).toBe("removed");
    expect(statusLozenge("scanning").appearance).toBe("inprogress");
    expect(severityLozenge("critical").appearance).toBe("removed");
    expect(severityLozenge("low").text).toBe("Low");
  });

  it("summarizes work items into cards", () => {
    const cards = summarize([
      wi({ blocksMigration: true }),
      wi({
        category: "legacy-ui",
        blocksMigration: false,
        effort: {
          tshirt: "M",
          storyPoints: 5,
          estimatedHours: { low: 4, expected: 8, high: 16 },
          notes: "",
        },
      }),
    ]);
    expect(cards.totalWorkItems).toBe(2);
    expect(cards.blocksMigration).toBe(1);
    expect(cards.estimatedHours).toBe(10);
    expect(cards.byCategory[0]?.count).toBe(1);
  });

  it("builds table rows with the expected columns", () => {
    const rows = toTableRows([wi({})]);
    expect(WORK_ITEM_COLUMNS).toHaveLength(6);
    expect(rows[0]?.cells.map((c) => c.key)).toEqual([
      "id",
      "title",
      "category",
      "severity",
      "effort",
      "jira",
    ]);
    expect(rows[0]?.cells[4]?.content).toBe("3 pts");
  });

  it("routes UI filters to a single guided facet", () => {
    expect(facetFromFilter({ primary: "all" })).toEqual({ type: "all" });
    expect(facetFromFilter({ primary: "phase", value: 2 })).toEqual({
      type: "phase",
      value: 2,
    });
    expect(
      facetFromFilter({ primary: "category", value: "security" }),
    ).toEqual({ type: "category", value: "security" });
  });

  it("labels progress and recent scans", () => {
    const p: ScanProgress = {
      status: "scanning",
      percentComplete: 42,
      currentStep: "Scanning files",
      chunkDone: 1,
      chunkTotal: 3,
    };
    expect(progressLabel(p)).toBe("Scanning files (42%)");
    const rows = recentScanRows([
      {
        scanId: "s1",
        status: "complete",
        createdAt: 0,
        workItemCount: 7,
        sourceKind: "zip",
      },
    ]);
    expect(rows[0]?.cells[2]?.content).toBe("7");
  });
});
