import Resolver from "@forge/resolver";
import { createForgeStorage, createForgeQueue } from "../lib/forge";
import {
  createForgeJiraClient,
  createForgeConfluenceClient,
} from "../lib/forgeClients";
import { createProjectResolver } from "./project";
import { createAdminResolver } from "./admin";

/**
 * UI Kit backend resolver. One Resolver serves all three surfaces; each
 * method delegates to a pure resolver core (unit-tested with in-memory fakes)
 * bound to the live Forge storage, queue, and product clients.
 */
const resolver = new Resolver();

function projectCore() {
  const ports = createForgeStorage();
  return createProjectResolver({
    ports,
    queue: createForgeQueue(),
    jira: createForgeJiraClient(ports.kvs),
    confluence: createForgeConfluenceClient(),
  });
}

function adminCore() {
  return createAdminResolver({ ports: createForgeStorage() });
}

type Req = { payload?: Record<string, unknown> };
const arg = (req: Req): Record<string, unknown> => req?.payload ?? {};

resolver.define("health", async () => ({
  ok: true as const,
  service: "cartographer",
  version: "0.1.0",
}));

const PROJECT_METHODS = [
  "getProjectState",
  "presignZip",
  "putZipPart",
  "startScan",
  "getScanProgress",
  "getWorkItems",
  "getWorkItemDetail",
  "getPlan",
  "getPlanForView",
  "getPlanForSpace",
  "createJiraIssues",
  "publishToConfluence",
  "requestExport",
  "getExport",
  "saveProjectConfig",
] as const;

for (const method of PROJECT_METHODS) {
  resolver.define(method, async (req: Req) => {
    const c = projectCore() as unknown as Record<
      string,
      (input: unknown) => Promise<unknown>
    >;
    return c[method]?.(arg(req));
  });
}

const ADMIN_METHODS = [
  "getSiteConfig",
  "updateSiteConfig",
  "getRuleCatalog",
  "getAppHealth",
] as const;

for (const method of ADMIN_METHODS) {
  resolver.define(method, async (req: Req) => {
    const c = adminCore() as unknown as Record<
      string,
      (input: unknown) => Promise<unknown>
    >;
    return c[method]?.(arg(req));
  });
}

export const handler = resolver.getDefinitions();
