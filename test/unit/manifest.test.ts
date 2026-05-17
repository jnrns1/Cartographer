import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

// Type-loose manifest assertions. The script scripts/validate-manifest.mjs is
// the gate; this mirrors the Forge limits in `npm test` for regression cover.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw YAML doc
type Doc = any;

const manifest = yaml.load(
  readFileSync(join(process.cwd(), "manifest.yml"), "utf8"),
) as Doc;

describe("manifest app and runtime", () => {
  it("declares the current runtime", () => {
    expect(manifest.app.runtime.name).toBe("nodejs24.x");
    expect(manifest.app.runtime.memoryMB).toBeGreaterThanOrEqual(128);
    expect(manifest.app.runtime.memoryMB).toBeLessThanOrEqual(1024);
  });

  it("has an app.id placeholder for forge register", () => {
    expect(typeof manifest.app.id).toBe("string");
    expect(manifest.app.id).toMatch(/^ari:cloud:ecosystem::app\//);
  });
});

describe("custom entities within Forge limits", () => {
  const entities = manifest.app.storage.entities as Doc[];

  it("declares at most 20 entities, including the six designed", () => {
    expect(entities.length).toBeLessThanOrEqual(20);
    const names = entities.map((e) => e.name);
    for (const n of [
      "scan",
      "candidate",
      "workitem",
      "exportartifact",
      "chunkstate",
      "blobpart",
    ]) {
      expect(names).toContain(n);
    }
  });

  it("keeps each entity within attribute, index, and type limits", () => {
    const types = new Set(["string", "integer", "float", "boolean", "any"]);
    for (const e of entities) {
      const attrs = Object.keys(e.attributes);
      expect(attrs.length).toBeLessThanOrEqual(50);
      expect((e.indexes ?? []).length).toBeLessThanOrEqual(7);
      for (const a of Object.values<Doc>(e.attributes)) {
        expect(types.has(a.type)).toBe(true);
      }
      for (const idx of e.indexes ?? []) {
        if (typeof idx === "string") continue;
        for (const k of [...(idx.partition ?? []), ...(idx.range ?? [])]) {
          expect(attrs).toContain(k);
        }
      }
    }
  });

  it("indexes workitem for the guided-facet UI", () => {
    const wi = entities.find((e) => e.name === "workitem");
    const idxNames = (wi.indexes as Doc[]).map((i) => i.name);
    expect(idxNames).toEqual(
      expect.arrayContaining([
        "by-scan",
        "by-scan-phase",
        "by-scan-category",
        "by-scan-severity",
      ]),
    );
  });
});

describe("modules and wiring", () => {
  it("declares the three UI Kit surfaces with render: native", () => {
    for (const t of [
      "jira:projectPage",
      "jira:adminPage",
      "confluence:spacePage",
    ]) {
      const list = manifest.modules[t];
      expect(Array.isArray(list)).toBe(true);
      for (const m of list) {
        expect(m.render).toBe("native");
        expect(m.resource).toBe("main");
      }
    }
  });

  it("wires the consumer to a function module via queue + function", () => {
    const fnKeys = new Set(manifest.modules.function.map((f: Doc) => f.key));
    for (const c of manifest.modules.consumer) {
      expect(typeof c.queue).toBe("string");
      expect(fnKeys.has(c.function)).toBe(true);
    }
  });

  it("points the UI resource at the entry source file", () => {
    const main = manifest.resources.find((r: Doc) => r.key === "main");
    expect(main.path).toBe("src/frontend/index.tsx");
  });
});

describe("permissions", () => {
  it("includes storage:app and omits the dropped write:project:jira", () => {
    const scopes: string[] = manifest.permissions.scopes;
    expect(scopes).toContain("storage:app");
    expect(scopes).not.toContain("write:project:jira");
  });

  it("declares github and bitbucket egress", () => {
    const backend = manifest.permissions.external.fetch.backend as Doc[];
    const addrs = backend.map((b) => (typeof b === "string" ? b : b.address));
    expect(addrs).toContain("api.github.com");
    expect(addrs).toContain("api.bitbucket.org");
  });
});
