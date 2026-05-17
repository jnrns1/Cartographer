import { describe, it, expect } from "vitest";
import { badWorkItems } from "../helpers/items";
import { buildPlan } from "../../src/domain";
import {
  buildParentPage,
  buildChildPage,
  publishPlan,
  parentTitle,
  childTitle,
  type ConfluenceClient,
} from "../../src/confluence/pagePublisher";

class FakeConfluence implements ConfluenceClient {
  byTitle = new Map<string, { id: string; version: number }>();
  pages = new Map<
    string,
    { title: string; version: number; parentId?: string }
  >();
  private n = 0;

  async findPageByTitle(_space: string, title: string) {
    return this.byTitle.get(title) ?? null;
  }
  async createPage(input: {
    spaceKey: string;
    title: string;
    parentId?: string;
  }) {
    const id = `page-${++this.n}`;
    this.pages.set(id, {
      title: input.title,
      version: 1,
      ...(input.parentId ? { parentId: input.parentId } : {}),
    });
    this.byTitle.set(input.title, { id, version: 1 });
    return { id };
  }
  async updatePage(input: { id: string; title: string; version: number }) {
    this.pages.set(input.id, { title: input.title, version: input.version });
    this.byTitle.set(input.title, { id: input.id, version: input.version });
    return { id: input.id };
  }
}

const plan = (() => {
  const items = badWorkItems();
  const p = buildPlan({
    workItems: items,
    projectName: "Acme Legacy",
    scannedAt: "2026-05-17T10:00:00.000Z",
    teamSize: 3,
    sprintLengthWeeks: 2,
  });
  p.scanId = "scan-1";
  return { p, items };
})();

describe("Confluence publishing (brief 12)", () => {
  it("creates a parent page and one child page per phase", async () => {
    const client = new FakeConfluence();
    const res = await publishPlan({
      client,
      spaceKey: "ENG",
      plan: plan.p,
      workItems: plan.items,
    });
    expect(res.childPageIds).toHaveLength(4);
    expect(res.updated).toBe(false);
    expect(client.pages.size).toBe(5);
    expect(client.pages.get(res.parentPageId)?.title).toBe(
      parentTitle(plan.p),
    );
    for (let phase = 1; phase <= 4; phase++) {
      expect(client.byTitle.has(childTitle(plan.p, phase))).toBe(true);
    }
  });

  it("re-publish updates existing pages and does not duplicate", async () => {
    const client = new FakeConfluence();
    const first = await publishPlan({
      client,
      spaceKey: "ENG",
      plan: plan.p,
      workItems: plan.items,
    });
    const second = await publishPlan({
      client,
      spaceKey: "ENG",
      plan: plan.p,
      workItems: plan.items,
    });
    expect(second.updated).toBe(true);
    expect(client.pages.size).toBe(5); // no duplicates
    expect(second.parentPageId).toBe(first.parentPageId);
    expect(client.byTitle.get(parentTitle(plan.p))?.version).toBe(2);
  });

  it("titles use a colon, never an em dash (brief 17.1)", () => {
    expect(parentTitle(plan.p)).not.toMatch(/—/);
    expect(childTitle(plan.p, 4)).toContain("Phase 4: Elevate");
    expect(childTitle(plan.p, 4)).not.toMatch(/—/);
  });

  it("renders ADF for the parent and child pages", () => {
    const parent = buildParentPage(plan.p);
    expect(parent.content.some((n) => n.type === "table")).toBe(true);
    expect(parent).toMatchSnapshot();
    const child = buildChildPage(
      1,
      plan.items.filter((w) => w.phase === 1),
    );
    expect(child.content[0]?.content?.[0]?.text).toContain("Phase 1");
  });
});
