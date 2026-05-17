import { describe, it, expect } from "vitest";
import {
  RULES,
  RULE_CATALOG,
  BOXLANG_MODULES,
  COLDBOX8_PATTERNS,
  ORTUS_DOCS,
  ESTIMATION,
  resolveReferences,
} from "../../src/catalog";
import {
  CATEGORIES,
  SEVERITIES,
  CONFIDENCES,
  type Category,
} from "../../src/types";

const MODULE_SLUGS = new Set(BOXLANG_MODULES.map((m) => m.slug));
const DOC_KEYS = new Set(Object.keys(ORTUS_DOCS));

/** Slugs the brief named that do not exist or were renamed (DECISIONS.md). */
const FORBIDDEN_SLUGS = [
  "bx-jdbc",
  "bx-quick",
  "bx-chart",
  "bx-cbwire",
  "bx-orm-compat",
  "bx-compat",
];

const EM_DASH = /—/;
const BANNED_SOFTENERS =
  /\b(seamlessly|leverage|empower|unlock|elevate|robust|journey)\b/i;

describe("rule catalog shape", () => {
  it("declares a schema version and 32 or more rules (brief 6.1)", () => {
    expect(RULE_CATALOG.schemaVersion).toBe("1.0");
    expect(RULES.length).toBeGreaterThanOrEqual(32);
  });

  it("has unique rule ids", () => {
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every category at least once", () => {
    const seen = new Set<Category>(RULES.map((r) => r.category));
    for (const c of CATEGORIES) expect(seen.has(c)).toBe(true);
  });
});

describe("each rule is fully and validly populated", () => {
  for (const rule of RULES) {
    describe(rule.id, () => {
      it("uses valid enum values", () => {
        expect(CATEGORIES).toContain(rule.category);
        expect(SEVERITIES).toContain(rule.severity);
        expect(CONFIDENCES).toContain(rule.confidence);
        expect(["Bug", "Story"]).toContain(rule.jiraIssueType);
      });

      it("has required non-empty text fields", () => {
        expect(rule.id).toMatch(/^CFML-/);
        expect(rule.title.length).toBeGreaterThan(3);
        expect(rule.subcategory.length).toBeGreaterThan(0);
        expect(rule.rationale.length).toBeGreaterThan(20);
        expect(rule.recommendation.length).toBeGreaterThan(40);
        expect(rule.appliesTo.length).toBeGreaterThan(0);
        for (const ext of rule.appliesTo) {
          expect(["cfm", "cfc", "cfml"]).toContain(ext);
        }
      });

      it("compiles every detection pattern as a RegExp", () => {
        const flags = rule.detect.ignoreCase ? "gi" : "g";
        expect(() => new RegExp(rule.detect.preFilterPattern, flags)).not.toThrow();
        if (rule.detect.antiPattern) {
          expect(
            () => new RegExp(rule.detect.antiPattern as string, flags),
          ).not.toThrow();
        }
        if (rule.detect.exclusion) {
          expect(
            () => new RegExp(rule.detect.exclusion as string, flags),
          ).not.toThrow();
        }
      });

      it("maps jiraIssueType from category (brief 6.1, 11.1)", () => {
        const expected = rule.category === "security" ? "Bug" : "Story";
        expect(rule.jiraIssueType).toBe(expected);
      });

      it("flags security as migration-blocking", () => {
        if (rule.category === "security") {
          expect(rule.blocksMigration).toBe(true);
        }
        if (rule.category === "compat-adobe") {
          expect(rule.blocksMigration).toBe(true);
        }
      });

      it("orders effort low <= expected <= high, all positive", () => {
        const e = rule.estimatedEffortHours;
        expect(e.low).toBeGreaterThan(0);
        expect(e.low).toBeLessThanOrEqual(e.expected);
        expect(e.expected).toBeLessThanOrEqual(e.high);
      });

      it("references only known docs keys", () => {
        expect(rule.references.length).toBeGreaterThan(0);
        for (const ref of rule.references) {
          expect(DOC_KEYS.has(ref.key)).toBe(true);
        }
      });

      it("names only modules that exist in the corrected catalog", () => {
        for (const slug of rule.ortusModules) {
          expect(MODULE_SLUGS.has(slug)).toBe(true);
          expect(FORBIDDEN_SLUGS).not.toContain(slug);
        }
      });

      it("names a specific Ortus module or BoxLang feature (anti-pattern 2)", () => {
        const namesFeature =
          rule.ortusModules.length > 0 ||
          /BoxLang core|getSystemSetting|queryExecute|ternary operator|invoke\(\)|serializeJSON|asyncManager|executors|struct dispatch/.test(
            rule.recommendation,
          );
        expect(namesFeature).toBe(true);
      });

      it("uses no em dash and no banned softeners (brief 17.1, 23)", () => {
        for (const text of [rule.title, rule.rationale, rule.recommendation]) {
          expect(EM_DASH.test(text)).toBe(false);
          expect(BANNED_SOFTENERS.test(text)).toBe(false);
        }
      });
    });
  }
});

describe("module catalog", () => {
  it("contains none of the forbidden slugs (DECISIONS.md)", () => {
    for (const m of BOXLANG_MODULES) {
      expect(FORBIDDEN_SLUGS).not.toContain(m.slug);
    }
  });

  it("gives every module a ForgeBox and docs URL", () => {
    for (const m of BOXLANG_MODULES) {
      expect(m.forgeboxUrl).toMatch(/^https:\/\//);
      expect(m.docsUrl).toMatch(/^https:\/\//);
      expect(m.slug.length).toBeGreaterThan(1);
    }
  });

  it("includes the corrected replacements", () => {
    for (const slug of ["quick", "cbwire", "bx-compat-cfml", "bx-charts"]) {
      expect(BOXLANG_MODULES.some((m) => m.slug === slug)).toBe(true);
    }
  });
});

describe("docs index", () => {
  it("maps every key to an https URL", () => {
    for (const [key, url] of Object.entries(ORTUS_DOCS)) {
      expect(key.length).toBeGreaterThan(0);
      expect(url).toMatch(/^https:\/\//);
    }
  });

  it("does not reference the offline modules.ortussolutions.com host", () => {
    for (const url of Object.values(ORTUS_DOCS)) {
      expect(url).not.toContain("modules.ortussolutions.com");
    }
  });

  it("resolves rule references to non-empty URLs", () => {
    for (const rule of RULES) {
      for (const resolved of resolveReferences(rule.references)) {
        expect(resolved.url).toMatch(/^https:\/\//);
      }
    }
  });
});

describe("estimation heuristics (brief 6.5)", () => {
  it("defines base hours and rollup caps for every category", () => {
    for (const c of CATEGORIES) {
      expect(typeof ESTIMATION.baseHoursPerOccurrence[c]).toBe("number");
      expect(typeof ESTIMATION.maxRollupPerFile[c]).toBe("number");
      expect(ESTIMATION.maxRollupPerFile[c]).toBeGreaterThanOrEqual(
        ESTIMATION.baseHoursPerOccurrence[c],
      );
    }
  });

  it("keeps the brief's multiplier and capacity values", () => {
    expect(ESTIMATION.multipliers.fileInLegacyPath).toBe(1.3);
    expect(ESTIMATION.multipliers.fileHasTests).toBe(0.8);
    expect(ESTIMATION.capacity.productiveHoursPerDevPerWeek).toBe(25);
  });
});

describe("ColdBox 8 patterns (brief 6.3)", () => {
  it("provides patterns with doc URLs", () => {
    expect(COLDBOX8_PATTERNS.length).toBeGreaterThanOrEqual(5);
    for (const p of COLDBOX8_PATTERNS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.whenToApply.length).toBeGreaterThan(0);
      expect(p.docUrl).toMatch(/^https:\/\//);
    }
  });
});
