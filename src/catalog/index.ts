/**
 * Bundled reference catalogs. Imported directly by the rule engine and
 * resolvers (not loaded into Forge Storage on install, see DECISIONS.md), so
 * the catalog version is locked to the engine version.
 */
import type { DocReference } from "../types";
import { ORTUS_DOCS } from "./ortusDocs";

export { RULES, RULE_CATALOG, getRule } from "./rules";
export { BOXLANG_MODULES, getModule, modulesExist } from "./modules";
export { COLDBOX8_PATTERNS } from "./coldbox8";
export { ORTUS_DOCS } from "./ortusDocs";
export { ESTIMATION } from "./estimation";
export { RULE_DEPENDENCIES, type RuleDependency } from "./dependencies";

import { RULE_CATALOG } from "./rules";

/** Catalog version surfaced in the admin page and app config. */
export const CATALOG_VERSION = RULE_CATALOG.schemaVersion;

/** Resolve a docs key to its URL, or undefined when the key is unknown. */
export function resolveDocUrl(key: string): string | undefined {
  return ORTUS_DOCS[key];
}

/** Resolve a reference list to {key, title, url} for rendering. */
export function resolveReferences(
  refs: DocReference[],
): Array<{ key: string; title: string; url: string }> {
  return refs.map((r) => ({
    key: r.key,
    title: r.title ?? r.key,
    url: ORTUS_DOCS[r.key] ?? "",
  }));
}
