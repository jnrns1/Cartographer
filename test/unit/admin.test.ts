import { describe, it, expect } from "vitest";
import { makeMemoryPorts } from "../../src/lib";
import { createAdminResolver } from "../../src/resolvers/admin";
import { RULES, CATALOG_VERSION } from "../../src/catalog";

describe("admin resolver core (brief 8.2)", () => {
  it("defaults telemetry off and objectstore ingest", async () => {
    const admin = createAdminResolver({ ports: makeMemoryPorts() });
    const res = await admin.getSiteConfig();
    expect(res.ok && res.config.telemetryOptIn).toBe(false);
    expect(res.ok && res.config.ingestMode).toBe("objectstore");
  });

  it("persists a config patch", async () => {
    const ports = makeMemoryPorts();
    const admin = createAdminResolver({ ports });
    const upd = await admin.updateSiteConfig({
      patch: { telemetryOptIn: true, ingestMode: "chunked" },
    });
    expect(upd.ok && upd.config.telemetryOptIn).toBe(true);
    expect(upd.ok && upd.config.ingestMode).toBe("chunked");
    const again = await admin.getSiteConfig();
    expect(again.ok && again.config.ingestMode).toBe("chunked");
  });

  it("rejects a malformed patch without throwing", async () => {
    const admin = createAdminResolver({ ports: makeMemoryPorts() });
    const bad = await admin.updateSiteConfig(
      {} as unknown as { patch: Record<string, never> },
    );
    expect(bad.ok).toBe(false);
  });

  it("serves the read-only rule catalog and health", async () => {
    const admin = createAdminResolver({ ports: makeMemoryPorts() });
    const cat = await admin.getRuleCatalog();
    expect(cat.ok && cat.count).toBe(RULES.length);
    expect(cat.ok && cat.version).toBe(CATALOG_VERSION);
    const h = await admin.getAppHealth();
    expect(h.ok && h.runtime).toBe("nodejs24.x");
    expect(h.ok && h.ruleCount).toBe(RULES.length);
  });
});
