import type { Priority, WorkItem } from "../types";
import { PHASE_NAME } from "../domain";
import { resolveReferences } from "../catalog";
import {
  type AdfDoc,
  bulletList,
  codeBlock,
  doc,
  heading,
  link,
  paragraph,
  text,
} from "../lib/adf";

/**
 * Jira issue creation (brief 11). Pure builders plus a creator that batches,
 * is idempotent via a per-work-item cartographer id, and degrades when a
 * field is unavailable. The JiraClient seam keeps this unit-testable.
 */
export interface JiraProjectMeta {
  storyPointsFieldId?: string;
  priorityAvailable: boolean;
}

export interface JiraIssueInput {
  fields: Record<string, unknown>;
}

export interface JiraClient {
  getProjectMeta(projectId: string): Promise<JiraProjectMeta>;
  findIssueKeyByCartographerId(
    scanId: string,
    cartographerId: string,
  ): Promise<string | null>;
  createIssue(input: JiraIssueInput): Promise<{ key: string }>;
  setCartographerId(
    key: string,
    scanId: string,
    cartographerId: string,
  ): Promise<void>;
}

const PRIORITY_NAME: Record<Priority, string> = {
  P0: "Highest",
  P1: "High",
  P2: "Medium",
  P3: "Low",
};

export function buildDescription(wi: WorkItem): AdfDoc {
  const refs = resolveReferences(wi.references);
  return doc(
    heading(3, "Rationale"),
    paragraph(text(wi.rationale)),
    heading(3, "Recommendation"),
    paragraph(text(wi.recommendation)),
    heading(3, "Code location"),
    paragraph(
      text(
        `${wi.location.file} lines ${wi.location.startLine} to ${wi.location.endLine}, ${wi.occurrences} occurrence(s)`,
      ),
    ),
    codeBlock("cfml", wi.location.snippet),
    heading(3, "References"),
    bulletList(
      refs.length
        ? refs.map((r) => [link(r.title, r.url)])
        : [[text("No external references")]],
    ),
    heading(3, "Effort"),
    paragraph(
      text(
        `${wi.effort.tshirt}, ${wi.effort.storyPoints} points, ` +
          `${wi.effort.estimatedHours.expected}h expected ` +
          `(${wi.effort.estimatedHours.low} to ${wi.effort.estimatedHours.high}). ` +
          wi.effort.notes,
      ),
    ),
  );
}

function labelsFor(wi: WorkItem): string[] {
  return Array.from(
    new Set([...wi.tags, "cartographer", "boxlang-migration", wi.category]),
  ).map((l) => l.replace(/\s+/g, "-"));
}

export interface CreateIssuesInput {
  client: JiraClient;
  projectId: string;
  scanId: string;
  workItems: WorkItem[];
  batchSize?: number;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface CreateIssuesResult {
  created: string[];
  skipped: string[];
  failed: Array<{ id: string; message: string }>;
  epics: Record<number, string>;
}

const phaseCartographerId = (n: number) => `phase-${n}`;

export async function createJiraIssues(
  input: CreateIssuesInput,
): Promise<CreateIssuesResult> {
  const { client, projectId, scanId, workItems } = input;
  const sleep = input.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const batchSize = input.batchSize ?? 10;
  const delayMs = input.delayMs ?? 200;
  const meta = await client.getProjectMeta(projectId);

  const result: CreateIssuesResult = {
    created: [],
    skipped: [],
    failed: [],
    epics: {},
  };

  // One Epic per phase that has work items (idempotent by cartographer id).
  const phases = [...new Set(workItems.map((w) => w.phase))].sort();
  for (const phase of phases) {
    const cid = phaseCartographerId(phase);
    const existing = await client.findIssueKeyByCartographerId(scanId, cid);
    if (existing) {
      result.epics[phase] = existing;
      result.skipped.push(existing);
      continue;
    }
    const { key } = await client.createIssue({
      fields: {
        project: { id: projectId },
        issuetype: { name: "Epic" },
        summary: `BoxLang Migration: Phase ${phase} ${PHASE_NAME[phase]}`,
        description: doc(
          paragraph(
            text(
              `Phase ${phase} (${PHASE_NAME[phase]}) of the BoxLang migration backlog produced by Cartographer.`,
            ),
          ),
        ),
        labels: ["cartographer", "boxlang-migration"],
      },
    });
    await client.setCartographerId(key, scanId, cid);
    result.epics[phase] = key;
    result.created.push(key);
  }

  for (let i = 0; i < workItems.length; i += batchSize) {
    const batch = workItems.slice(i, i + batchSize);
    for (const wi of batch) {
      try {
        const existing = await client.findIssueKeyByCartographerId(
          scanId,
          wi.id,
        );
        if (existing) {
          result.skipped.push(existing);
          continue;
        }
        const fields: Record<string, unknown> = {
          project: { id: projectId },
          issuetype: { name: wi.jiraIssueType },
          summary: wi.title.slice(0, 254),
          description: buildDescription(wi),
          labels: labelsFor(wi),
        };
        const epic = result.epics[wi.phase];
        if (epic) fields.parent = { key: epic };
        if (meta.priorityAvailable) {
          fields.priority = { name: PRIORITY_NAME[wi.priority] };
        }
        if (meta.storyPointsFieldId) {
          fields[meta.storyPointsFieldId] = wi.effort.storyPoints;
        }
        const { key } = await client.createIssue({ fields });
        await client.setCartographerId(key, scanId, wi.id);
        result.created.push(key);
      } catch (e) {
        result.failed.push({ id: wi.id, message: (e as Error).message });
      }
    }
    if (i + batchSize < workItems.length) await sleep(delayMs);
  }
  return result;
}
