#!/usr/bin/env node
/**
 * Offline manifest validator. Substitutes for `forge lint` (which requires an
 * Atlassian API token). Asserts the Forge platform limits and wiring that a
 * deploy would otherwise reject, all verified against the live manifest
 * reference 2026-05-17. Exits non-zero on any hard failure.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import yaml from "js-yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "manifest.yml");
const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const RUNTIMES = new Set(["nodejs24.x", "nodejs22.x", "nodejs20.x"]);
const ATTR_TYPES = new Set(["string", "integer", "float", "boolean", "any"]);
const FORBIDDEN_SCOPES = new Set(["write:project:jira"]);

if (!existsSync(manifestPath)) {
  console.error("validate-manifest: manifest.yml not found.");
  process.exit(1);
}

const sizeBytes = statSync(manifestPath).size;
if (sizeBytes > 200 * 1024) {
  fail(`manifest.yml is ${sizeBytes} bytes, over the 200 KB limit.`);
}

let doc;
try {
  doc = yaml.load(readFileSync(manifestPath, "utf8"));
} catch (err) {
  console.error("validate-manifest: manifest.yml did not parse.");
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
if (!doc || typeof doc !== "object") {
  console.error("validate-manifest: manifest.yml is not a mapping.");
  process.exit(1);
}

// --- app + runtime ---------------------------------------------------------
const app = doc.app ?? {};
if (typeof app.id !== "string" || app.id.length === 0) {
  fail("app.id is missing.");
} else if (app.id.includes("00000000-0000-0000-0000-000000000000")) {
  warn("app.id is the placeholder; `forge register` rewrites it before deploy.");
}
const runtime = app.runtime ?? {};
if (!RUNTIMES.has(runtime.name)) {
  fail(`app.runtime.name '${runtime.name}' is not a supported runtime.`);
} else if (runtime.name !== "nodejs24.x") {
  warn(`app.runtime.name is ${runtime.name}; nodejs24.x is current.`);
}
if (runtime.memoryMB !== undefined) {
  if (
    typeof runtime.memoryMB !== "number" ||
    runtime.memoryMB < 128 ||
    runtime.memoryMB > 1024
  ) {
    fail("app.runtime.memoryMB must be between 128 and 1024.");
  }
}

// --- storage entities ------------------------------------------------------
const entities = app.storage?.entities ?? [];
if (entities.length > 20) {
  fail(`app.storage.entities has ${entities.length}, over the 20 limit.`);
}
const entityNames = new Set();
for (const ent of entities) {
  const name = ent?.name;
  if (typeof name !== "string" || name.length < 3 || name.length > 60) {
    fail(`entity name '${name}' must be 3 to 60 characters.`);
    continue;
  }
  if (entityNames.has(name)) fail(`duplicate entity name '${name}'.`);
  entityNames.add(name);

  const attrs = ent.attributes ?? {};
  const attrNames = Object.keys(attrs);
  if (attrNames.length === 0) fail(`entity '${name}' has no attributes.`);
  if (attrNames.length > 50) {
    fail(`entity '${name}' has ${attrNames.length} attributes, over 50.`);
  }
  for (const [an, av] of Object.entries(attrs)) {
    if (!ATTR_TYPES.has(av?.type)) {
      fail(`entity '${name}' attribute '${an}' has invalid type '${av?.type}'.`);
    }
  }
  const indexes = ent.indexes ?? [];
  if (indexes.length > 7) {
    fail(`entity '${name}' has ${indexes.length} indexes, over the 7 limit.`);
  }
  for (const idx of indexes) {
    if (typeof idx === "string") continue; // simple single-attribute index
    if (
      typeof idx.name !== "string" ||
      idx.name.length < 3 ||
      idx.name.length > 50
    ) {
      fail(`entity '${name}' has an index with an invalid name.`);
    }
    for (const key of [...(idx.partition ?? []), ...(idx.range ?? [])]) {
      if (!attrNames.includes(key)) {
        fail(
          `entity '${name}' index '${idx.name}' references unknown attribute '${key}'.`,
        );
      }
    }
  }
}

// --- modules ---------------------------------------------------------------
const modules = doc.modules ?? {};
const functionKeys = new Set((modules.function ?? []).map((f) => f.key));

for (const fn of modules.function ?? []) {
  if (typeof fn.key !== "string") fail("a function module is missing `key`.");
  if (typeof fn.handler !== "string" || !fn.handler.includes(".")) {
    fail(`function '${fn.key}' handler '${fn.handler}' must be 'file.export'.`);
  }
}

const uiModuleTypes = [
  "jira:projectPage",
  "jira:adminPage",
  "confluence:spacePage",
];
const resourceKeys = new Set((doc.resources ?? []).map((r) => r.key));
for (const t of uiModuleTypes) {
  const list = modules[t] ?? [];
  if (list.length === 0) fail(`module ${t} is not declared.`);
  for (const m of list) {
    if (typeof m.key !== "string") fail(`${t} entry is missing \`key\`.`);
    if (m.render !== "native") {
      fail(`${t} '${m.key}' must set render: native for UI Kit.`);
    }
    if (!resourceKeys.has(m.resource)) {
      fail(`${t} '${m.key}' resource '${m.resource}' is not declared.`);
    }
    const ref = m.resolver?.function;
    if (!functionKeys.has(ref)) {
      fail(`${t} '${m.key}' resolver.function '${ref}' is not a function module.`);
    }
    if (typeof m.title !== "string" || m.title.length === 0) {
      fail(`${t} '${m.key}' is missing \`title\`.`);
    }
  }
}

// --- consumer --------------------------------------------------------------
for (const c of modules.consumer ?? []) {
  if (typeof c.key !== "string") fail("a consumer is missing `key`.");
  if (typeof c.queue !== "string") fail(`consumer '${c.key}' is missing \`queue\`.`);
  if (!functionKeys.has(c.function)) {
    fail(`consumer '${c.key}' function '${c.function}' is not a function module.`);
  }
}

// --- resources point at files that exist -----------------------------------
for (const r of doc.resources ?? []) {
  if (!existsSync(join(root, r.path))) {
    fail(`resource '${r.key}' path '${r.path}' does not exist on disk.`);
  }
}

// --- handlers resolve to real exports in src/index.ts ----------------------
const indexSrc = existsSync(join(root, "src/index.ts"))
  ? readFileSync(join(root, "src/index.ts"), "utf8")
  : "";
for (const fn of modules.function ?? []) {
  const exportName = String(fn.handler).split(".")[1];
  const exported = new RegExp(
    `export\\s+(\\{[^}]*\\b${exportName}\\b[^}]*\\}|(async\\s+)?function\\s+${exportName}\\b|const\\s+${exportName}\\b)`,
  ).test(indexSrc);
  if (!exported) {
    fail(`handler export '${exportName}' not found in src/index.ts.`);
  }
}

// --- permissions -----------------------------------------------------------
const scopes = doc.permissions?.scopes ?? [];
if (!Array.isArray(scopes) || scopes.length === 0) {
  fail("permissions.scopes is empty.");
}
if (!scopes.includes("storage:app")) {
  fail("permissions.scopes must include storage:app.");
}
for (const s of scopes) {
  if (FORBIDDEN_SCOPES.has(s)) {
    fail(`scope '${s}' is scope creep and was dropped (DECISIONS.md).`);
  }
}
const backend = doc.permissions?.external?.fetch?.backend ?? [];
const addrs = backend.map((b) => (typeof b === "string" ? b : b.address));
for (const need of ["api.github.com", "api.bitbucket.org"]) {
  if (!addrs.includes(need)) {
    fail(`permissions.external.fetch.backend is missing ${need}.`);
  }
}

// --- report ----------------------------------------------------------------
for (const w of warnings) console.warn(`warning: ${w}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`validate-manifest: ${errors.length} error(s).`);
  process.exit(1);
}
console.log(
  `validate-manifest: OK (${entities.length} entities, ${functionKeys.size} functions, ${sizeBytes} bytes, ${warnings.length} warning(s)).`,
);
process.exit(0);
