import type { MigrationPlan, WorkItem } from "../types";
import { PHASE_NAME } from "../domain";
import {
  type AdfDoc,
  type AdfNode,
  doc,
  heading,
  paragraph,
  table,
  text,
} from "../lib/adf";

/**
 * Confluence plan publishing (brief 12). A parent page plus one child page
 * per phase. Re-publish updates the existing page version rather than
 * duplicating (matched by title in the space). Titles use a colon, not an em
 * dash (brief 17.1). The ConfluenceClient seam keeps this unit-testable.
 */
export interface ConfluencePageRef {
  id: string;
  version: number;
}

export interface ConfluenceClient {
  findPageByTitle(
    spaceKey: string,
    title: string,
  ): Promise<ConfluencePageRef | null>;
  createPage(input: {
    spaceKey: string;
    title: string;
    adf: AdfDoc;
    parentId?: string;
  }): Promise<{ id: string }>;
  updatePage(input: {
    id: string;
    title: string;
    adf: AdfDoc;
    version: number;
  }): Promise<{ id: string }>;
}

const expand = (title: string, content: AdfNode[]): AdfNode => ({
  type: "expand",
  attrs: { title },
  content,
});

export function parentTitle(plan: MigrationPlan): string {
  return `BoxLang Migration Plan: ${plan.projectName} (scanned ${plan.scannedAt.slice(0, 10)})`;
}

export function childTitle(plan: MigrationPlan, phase: number): string {
  return `${parentTitle(plan)} - Phase ${phase}: ${PHASE_NAME[phase as 1]}`;
}

export function buildParentPage(plan: MigrationPlan): AdfDoc {
  return doc(
    heading(2, "Executive summary"),
    paragraph(text(plan.executiveSummary)),
    heading(2, "Phasing roadmap"),
    table(
      ["Phase", "Work items", "Estimated hours", "Sprints"],
      plan.phases.map((p) => [
        `Phase ${p.phase}: ${p.name}`,
        String(p.workItemCount),
        String(p.totalHours),
        String(p.sprintRecommendation.sprints),
      ]),
    ),
    heading(2, "Statistics"),
    paragraph(
      text(
        `Total work items: ${plan.stats.totalWorkItems}. ` +
          `Migration blockers: ${plan.stats.blocksMigrationCount}. ` +
          `Total estimated effort: ${plan.stats.totalHours} hours.`,
      ),
    ),
    paragraph(
      text(
        "Each phase has its own child page with the detailed work items.",
      ),
    ),
  );
}

export function buildChildPage(
  phase: number,
  items: WorkItem[],
): AdfDoc {
  if (items.length === 0) {
    return doc(
      heading(2, `Phase ${phase}: ${PHASE_NAME[phase as 1]}`),
      paragraph(text("No work items in this phase.")),
    );
  }
  return doc(
    heading(2, `Phase ${phase}: ${PHASE_NAME[phase as 1]}`),
    ...items.map((wi) =>
      expand(`${wi.id} ${wi.title}`, [
        paragraph(
          text(
            `Category ${wi.category}, severity ${wi.severity}, ` +
              `${wi.effort.storyPoints} points, ` +
              `${wi.occurrences} occurrence(s) in ${wi.location.file}.`,
          ),
        ),
        paragraph(text(`Rationale: ${wi.rationale}`)),
        paragraph(text(`Recommendation: ${wi.recommendation}`)),
      ]),
    ),
  );
}

export interface PublishResult {
  parentPageId: string;
  childPageIds: string[];
  updated: boolean;
}

async function upsert(
  client: ConfluenceClient,
  spaceKey: string,
  title: string,
  adf: AdfDoc,
  parentId?: string,
): Promise<{ id: string; updated: boolean }> {
  const existing = await client.findPageByTitle(spaceKey, title);
  if (existing) {
    const r = await client.updatePage({
      id: existing.id,
      title,
      adf,
      version: existing.version + 1,
    });
    return { id: r.id, updated: true };
  }
  const r = await client.createPage({
    spaceKey,
    title,
    adf,
    ...(parentId ? { parentId } : {}),
  });
  return { id: r.id, updated: false };
}

export async function publishPlan(input: {
  client: ConfluenceClient;
  spaceKey: string;
  plan: MigrationPlan;
  workItems: WorkItem[];
}): Promise<PublishResult> {
  const { client, spaceKey, plan } = input;
  const parent = await upsert(
    client,
    spaceKey,
    parentTitle(plan),
    buildParentPage(plan),
  );
  let anyUpdated = parent.updated;
  const childPageIds: string[] = [];
  for (const p of plan.phases) {
    const items = input.workItems.filter((w) => w.phase === p.phase);
    const child = await upsert(
      client,
      spaceKey,
      childTitle(plan, p.phase),
      buildChildPage(p.phase, items),
      parent.id,
    );
    anyUpdated = anyUpdated || child.updated;
    childPageIds.push(child.id);
  }
  return { parentPageId: parent.id, childPageIds, updated: anyUpdated };
}
