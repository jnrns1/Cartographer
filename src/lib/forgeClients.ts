import type { Kvs } from "./ports";
import type { JiraClient } from "../jira/issueCreator";
import type { ConfluenceClient } from "../confluence/pagePublisher";

/**
 * Forge-backed Jira and Confluence clients. The @forge/api request shapes are
 * NEEDS VERIFICATION AT BUILD TIME (DECISIONS.md) and are exercised on the
 * operator's deploy; the offline gate uses in-memory fakes. Jira idempotency
 * is KVS-backed (robust, avoids fragile issue-property JQL).
 */
type Api = any; // external SDK surface resolved at deploy; justified per anti-pattern 6

async function api(): Promise<Api> {
  return import("@forge/api");
}

export function createForgeJiraClient(kvs: Kvs): JiraClient {
  const idKey = (s: string, c: string) => `jira:${s}:${c}`;
  return {
    async getProjectMeta() {
      try {
        const { requestJira } = await api();
        const res = await requestJira("/rest/api/3/field");
        const fields = (await res.json()) as Array<{
          id: string;
          name: string;
        }>;
        const sp = fields.find((f) => /story point/i.test(f.name));
        return {
          ...(sp ? { storyPointsFieldId: sp.id } : {}),
          priorityAvailable: true,
        };
      } catch {
        return { priorityAvailable: false };
      }
    },
    async findIssueKeyByCartographerId(scanId, cid) {
      return (await kvs.get<string>(idKey(scanId, cid))) ?? null;
    },
    async createIssue(input) {
      const { requestJira, route } = await api();
      const res = await requestJira(route`/rest/api/3/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = (await res.json()) as { key: string };
      if (!body.key) throw new Error(`Jira createIssue failed (${res.status})`);
      return { key: body.key };
    },
    async setCartographerId(key, scanId, cid) {
      await kvs.set(idKey(scanId, cid), key);
      try {
        const { requestJira, route } = await api();
        await requestJira(
          route`/rest/api/3/issue/${key}/properties/cartographer`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scanId, cartographerId: cid }),
          },
        );
      } catch {
        // The KVS mapping is the source of truth for idempotency.
      }
    },
  };
}

export function createForgeConfluenceClient(): ConfluenceClient {
  return {
    async findPageByTitle(spaceKey, title) {
      try {
        const { requestConfluence } = await api();
        const res = await requestConfluence(
          `/wiki/api/v2/pages?title=${encodeURIComponent(title)}&limit=1`,
        );
        const body = (await res.json()) as {
          results?: Array<{ id: string; version?: { number: number } }>;
        };
        const p = body.results?.[0];
        return p ? { id: p.id, version: p.version?.number ?? 1 } : null;
      } catch {
        return null;
      }
    },
    async createPage(input) {
      const { requestConfluence, route } = await api();
      const res = await requestConfluence(route`/wiki/api/v2/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaceId: input.spaceKey,
          status: "current",
          title: input.title,
          ...(input.parentId ? { parentId: input.parentId } : {}),
          body: {
            representation: "atlas_doc_format",
            value: JSON.stringify(input.adf),
          },
        }),
      });
      const body = (await res.json()) as { id: string };
      return { id: body.id };
    },
    async updatePage(input) {
      const { requestConfluence, route } = await api();
      const res = await requestConfluence(
        route`/wiki/api/v2/pages/${input.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: input.id,
            status: "current",
            title: input.title,
            version: { number: input.version },
            body: {
              representation: "atlas_doc_format",
              value: JSON.stringify(input.adf),
            },
          }),
        },
      );
      const body = (await res.json()) as { id: string };
      return { id: body.id };
    },
  };
}
