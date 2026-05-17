import { describe, it, expect } from "vitest";
import { badWorkItems } from "../helpers/items";
import {
  buildDescription,
  createJiraIssues,
  type JiraClient,
} from "../../src/jira/issueCreator";

class FakeJira implements JiraClient {
  issues = new Map<string, { fields: Record<string, unknown> }>();
  ids = new Map<string, string>();
  private n = 0;
  failOn?: string;

  async getProjectMeta() {
    return { storyPointsFieldId: "customfield_10016", priorityAvailable: true };
  }
  async findIssueKeyByCartographerId(scanId: string, cid: string) {
    return this.ids.get(`${scanId}:${cid}`) ?? null;
  }
  async createIssue(input: { fields: Record<string, unknown> }) {
    if (this.failOn && input.fields.summary === this.failOn) {
      throw new Error("simulated Jira failure");
    }
    const key = `PROJ-${++this.n}`;
    this.issues.set(key, input);
    return { key };
  }
  async setCartographerId(key: string, scanId: string, cid: string) {
    this.ids.set(`${scanId}:${cid}`, key);
  }
}

const noSleep = async () => {};

describe("Jira issue creation (brief 11)", () => {
  const items = badWorkItems();

  it("builds an epic per phase and one issue per work item", async () => {
    const client = new FakeJira();
    const res = await createJiraIssues({
      client,
      projectId: "10001",
      scanId: "scan-1",
      workItems: items,
      sleep: noSleep,
    });
    const phases = new Set(items.map((w) => w.phase));
    expect(Object.keys(res.epics).length).toBe(phases.size);
    expect(res.created.length).toBe(items.length + phases.size);
    expect(res.failed).toEqual([]);

    const epicKeys = new Set(Object.values(res.epics));
    for (const wi of items) {
      const key = client.ids.get(`scan-1:${wi.id}`);
      const issue = client.issues.get(key ?? "");
      expect(issue).toBeDefined();
      const f = issue?.fields ?? {};
      expect((f.issuetype as { name: string }).name).toBe(wi.jiraIssueType);
      expect((f.parent as { key: string }).key).toBe(res.epics[wi.phase]);
      expect(epicKeys.has((f.parent as { key: string }).key)).toBe(true);
      expect(f.labels).toContain("cartographer");
      expect(f.labels).toContain("boxlang-migration");
      expect(f.labels).toContain(wi.category);
      expect(f).toHaveProperty("customfield_10016", wi.effort.storyPoints);
      expect((f.priority as { name: string }).name).toBeDefined();
    }
  });

  it("maps security to Bug and others to Story", () => {
    for (const wi of items) {
      expect(wi.jiraIssueType).toBe(
        wi.category === "security" ? "Bug" : "Story",
      );
    }
  });

  it("is idempotent on re-run", async () => {
    const client = new FakeJira();
    const a = await createJiraIssues({
      client,
      projectId: "10001",
      scanId: "scan-1",
      workItems: items,
      sleep: noSleep,
    });
    const b = await createJiraIssues({
      client,
      projectId: "10001",
      scanId: "scan-1",
      workItems: items,
      sleep: noSleep,
    });
    expect(b.created).toEqual([]);
    expect(b.skipped.length).toBe(a.created.length);
  });

  it("reports per-item failures without aborting the batch", async () => {
    const client = new FakeJira();
    client.failOn = items[0]?.title.slice(0, 254) ?? "";
    const res = await createJiraIssues({
      client,
      projectId: "10001",
      scanId: "scan-1",
      workItems: items,
      sleep: noSleep,
    });
    expect(res.failed.length).toBe(1);
    expect(res.failed[0]?.id).toBe(items[0]?.id);
    expect(res.created.length).toBeGreaterThan(0);
  });

  it("renders a structured ADF description", () => {
    const wi = items[0];
    if (!wi) throw new Error("no fixture work items");
    const adf = buildDescription(wi);
    expect(adf.version).toBe(1);
    expect(adf.type).toBe("doc");
    const headings = adf.content
      .filter((n) => n.type === "heading")
      .map((n) => n.content?.[0]?.text);
    expect(headings).toEqual([
      "Rationale",
      "Recommendation",
      "Code location",
      "References",
      "Effort",
    ]);
    const code = adf.content.find((n) => n.type === "codeBlock");
    expect(code?.attrs?.language).toBe("cfml");
  });
});
