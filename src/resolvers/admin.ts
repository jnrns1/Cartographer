import type { AppConfig, ResolverResult } from "../types";
import type { StoragePorts } from "../lib/ports";
import { RULES, CATALOG_VERSION } from "../catalog";

/**
 * Pure admin-page resolver core (brief 8.2). Site config, the read-only rule
 * catalog, and app health. Ports injected; unit-tested with in-memory fakes.
 */
export interface AdminResolverDeps {
  ports: StoragePorts;
}

const ok = <T extends object>(v: T): { ok: true } & T => ({ ok: true, ...v });
const err = (
  code: "unauthorized" | "invalid-input" | "internal",
  message: string,
): ResolverResult<never> => ({ ok: false, code, message });

const CONFIG_KEY = "config:default";

function defaultConfig(): AppConfig {
  return {
    telemetryOptIn: false,
    ingestMode: "objectstore",
    ruleCatalogVersion: CATALOG_VERSION,
  };
}

export function createAdminResolver(deps: AdminResolverDeps) {
  const { ports } = deps;
  return {
    async getSiteConfig() {
      const cfg =
        (await ports.kvs.get<AppConfig>(CONFIG_KEY)) ?? defaultConfig();
      return ok({ config: cfg });
    },

    async updateSiteConfig(input: {
      patch: Partial<Pick<AppConfig, "telemetryOptIn" | "ingestMode">>;
    }) {
      if (!input?.patch || typeof input.patch !== "object") {
        return err("invalid-input", "patch required");
      }
      const current =
        (await ports.kvs.get<AppConfig>(CONFIG_KEY)) ?? defaultConfig();
      const next: AppConfig = {
        ...current,
        ...(typeof input.patch.telemetryOptIn === "boolean"
          ? { telemetryOptIn: input.patch.telemetryOptIn }
          : {}),
        ...(input.patch.ingestMode === "objectstore" ||
        input.patch.ingestMode === "chunked"
          ? { ingestMode: input.patch.ingestMode }
          : {}),
        ruleCatalogVersion: CATALOG_VERSION,
      };
      await ports.kvs.set(CONFIG_KEY, next);
      return ok({ config: next });
    },

    async getRuleCatalog() {
      return ok({
        version: CATALOG_VERSION,
        count: RULES.length,
        rules: RULES.map((r) => ({
          id: r.id,
          title: r.title,
          category: r.category,
          severity: r.severity,
          confidence: r.confidence,
          jiraIssueType: r.jiraIssueType,
          blocksMigration: r.blocksMigration,
        })),
      });
    },

    async getAppHealth() {
      return ok({
        version: "0.1.0",
        runtime: "nodejs24.x",
        catalogVersion: CATALOG_VERSION,
        ruleCount: RULES.length,
      });
    },
  };
}

export type AdminResolver = ReturnType<typeof createAdminResolver>;
