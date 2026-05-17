import type { BoxLangModule } from "../types";

/**
 * BoxLang / Ortus module catalog. Slugs are the corrected, live-verified set
 * (DECISIONS.md): `bx-jdbc` does not exist (BoxLang core ships JDBC and
 * `queryExecute`), `bx-quick` -> `quick`, `bx-chart` -> `bx-charts`,
 * `bx-cbwire` -> `cbwire`, `bx-orm-compat` -> `bx-orm`/`cborm`, `bx-compat` ->
 * `bx-compat-cfml`, `SocketBox` -> `socketbox`. Every slug a rule names in
 * `ortusModules` resolves to an entry here (enforced by the catalog test).
 */
export const BOXLANG_MODULES: BoxLangModule[] = [
  {
    slug: "bx-compat-cfml",
    name: "BoxLang Compat Module for CFML",
    category: "compatibility",
    purpose:
      "Adobe ColdFusion and Lucee compatibility layer for near zero-change migration of legacy CFML onto the BoxLang runtime.",
    replaces: ["Adobe ColdFusion engine", "Lucee engine"],
    boxlangMinVersion: "1.13.0",
    docsUrl: "https://boxlang.ortusbooks.com/boxlang-framework/modularity/compat-cfml",
    forgeboxUrl: "https://forgebox.io/view/bx-compat-cfml",
  },
  {
    slug: "quick",
    name: "Quick ORM",
    category: "data",
    purpose:
      "Fluent ActiveRecord ORM that parameterizes queries by default and runs on the BoxLang runtime.",
    replaces: ["manual cfquery", "Hibernate-backed cfml ORM"],
    boxlangMinVersion: "1.13.0",
    docsUrl: "https://quick.ortusbooks.com/",
    forgeboxUrl: "https://forgebox.io/view/quick",
  },
  {
    slug: "bx-orm",
    name: "BoxLang ORM",
    category: "data",
    purpose:
      "Native Hibernate-style ORM for BoxLang, the lift-and-shift target for existing cfml ORM entities.",
    replaces: ["Adobe/Lucee Hibernate ORM"],
    boxlangMinVersion: "1.13.0",
    docsUrl: "https://forgebox.io/view/bx-orm",
    forgeboxUrl: "https://forgebox.io/view/bx-orm",
  },
  {
    slug: "cborm",
    name: "cborm",
    category: "data",
    purpose:
      "ColdBox ORM service layer (virtual entity services, criteria builder) over BoxLang ORM.",
    replaces: ["hand-rolled ORM service CFCs"],
    boxlangMinVersion: "1.13.0",
    docsUrl: "https://forgebox.io/view/cborm",
    forgeboxUrl: "https://forgebox.io/view/cborm",
  },
  {
    slug: "bx-mysql",
    name: "BoxLang MySQL Driver",
    category: "data",
    purpose: "MySQL/MariaDB JDBC driver module for BoxLang datasources.",
    replaces: ["engine-bundled MySQL driver"],
    boxlangMinVersion: "1.13.0",
    docsUrl: "https://forgebox.io/view/bx-mysql",
    forgeboxUrl: "https://forgebox.io/view/bx-mysql",
  },
  {
    slug: "bx-postgresql",
    name: "BoxLang PostgreSQL Driver",
    category: "data",
    purpose: "PostgreSQL JDBC driver module for BoxLang datasources.",
    replaces: ["engine-bundled PostgreSQL driver"],
    boxlangMinVersion: "1.13.0",
    docsUrl: "https://forgebox.io/view/bx-postgresql",
    forgeboxUrl: "https://forgebox.io/view/bx-postgresql",
  },
  {
    slug: "cbwire",
    name: "CBWire",
    category: "ui",
    purpose:
      "Reactive server-rendered UI components (HTML over the wire) for ColdBox on BoxLang, the replacement path for cfgrid/cflayout/cfwindow/cfajaxproxy.",
    replaces: ["cfgrid", "cflayout", "cfwindow", "cfajaxproxy", "cftree"],
    boxlangMinVersion: "1.13.0",
    docsUrl: "https://cbwire.ortusbooks.com/",
    forgeboxUrl: "https://forgebox.io/view/cbwire",
  },
  {
    slug: "bx-pdf",
    name: "BoxLang PDF Module",
    category: "documents",
    purpose:
      "PDF generation and manipulation for BoxLang, the target for cfdocument and supported cfpdf actions.",
    replaces: ["cfdocument", "cfpdf"],
    boxlangMinVersion: "1.13.0",
    docsUrl: "https://boxlang.ortusbooks.com/boxlang-framework/modularity/pdf",
    forgeboxUrl: "https://forgebox.io/view/bx-pdf",
  },
  {
    slug: "bx-charts",
    name: "BoxLang Charts",
    category: "ui",
    purpose: "Server-side chart rendering for BoxLang, the target for cfchart.",
    replaces: ["cfchart"],
    boxlangMinVersion: "1.13.0",
    docsUrl: "https://forgebox.io/view/bx-charts",
    forgeboxUrl: "https://forgebox.io/view/bx-charts",
  },
  {
    slug: "bx-meilisearch",
    name: "BoxLang Meilisearch",
    category: "search",
    purpose:
      "Fast full-text search via Meilisearch, the modern replacement for cfsearch/cfindex/cfcollection (Solr).",
    replaces: ["cfcollection", "cfindex", "cfsearch", "Verity/Solr"],
    boxlangMinVersion: "1.13.0",
    docsUrl: "https://forgebox.io/view/bx-meilisearch",
    forgeboxUrl: "https://forgebox.io/view/bx-meilisearch",
  },
  {
    slug: "bx-mail",
    name: "BoxLang Mail Module",
    category: "messaging",
    purpose: "Email sending with attachments and signing for BoxLang.",
    replaces: ["cfmail engine internals"],
    boxlangMinVersion: "1.13.0",
    docsUrl: "https://boxlang.ortusbooks.com/boxlang-framework/modularity/mail",
    forgeboxUrl: "https://forgebox.io/view/bx-mail",
  },
  {
    slug: "bx-ai",
    name: "BoxLang AI",
    category: "ai",
    purpose:
      "Unified multi-provider LLM API with structured outputs and tool calling for BoxLang.",
    replaces: ["hand-rolled LLM HTTP calls", "manual JSON assembly"],
    boxlangMinVersion: "1.13.0",
    docsUrl: "https://boxlang.ortusbooks.com/boxlang-framework/modularity/ai",
    forgeboxUrl: "https://forgebox.io/view/bx-ai",
  },
  {
    slug: "bx-csv",
    name: "BoxLang CSV",
    category: "data",
    purpose: "Streaming CSV parsing and generation for BoxLang.",
    replaces: ["manual string-split CSV parsing"],
    boxlangMinVersion: "1.13.0",
    docsUrl: "https://forgebox.io/view/bx-csv",
    forgeboxUrl: "https://forgebox.io/view/bx-csv",
  },
  {
    slug: "bx-markdown",
    name: "BoxLang Markdown",
    category: "documents",
    purpose: "Markdown to HTML conversion for BoxLang.",
    replaces: ["hand-rolled markdown rendering"],
    boxlangMinVersion: "1.13.0",
    docsUrl: "https://boxlang.ortusbooks.com/boxlang-framework/modularity/markdown",
    forgeboxUrl: "https://forgebox.io/view/bx-markdown",
  },
  {
    slug: "bx-redis",
    name: "BoxLang Redis",
    category: "caching",
    purpose: "Redis caching, pub/sub, and distributed locking for BoxLang.",
    replaces: ["in-process application-scope caches", "cflock-based coordination"],
    boxlangMinVersion: "1.13.0",
    docsUrl: "https://forgebox.io/view/bx-redis",
    forgeboxUrl: "https://forgebox.io/view/bx-redis",
  },
  {
    slug: "socketbox",
    name: "SocketBox",
    category: "realtime",
    purpose:
      "WebSocket library for BoxLang/CFML, the replacement for long-polling and cfajaxproxy push patterns.",
    replaces: ["long-polling loops", "cfajaxproxy polling"],
    boxlangMinVersion: "1.13.0",
    docsUrl:
      "https://www.ortussolutions.com/blog/introducing-socketbox-a-new-websocket-library",
    forgeboxUrl: "https://forgebox.io/view/socketbox",
  },
  {
    slug: "hyper",
    name: "Hyper",
    category: "http",
    purpose:
      "Fluent HTTP client builder for BoxLang/CFML, the replacement for raw cfhttp service calls.",
    replaces: ["cfhttp service integration code"],
    boxlangMinVersion: "1.13.0",
    docsUrl: "https://forgebox.io/view/hyper",
    forgeboxUrl: "https://forgebox.io/view/hyper",
  },
  {
    slug: "cbmcp",
    name: "cbMCP",
    category: "ai",
    purpose:
      "Exposes a ColdBox application to AI agents over the Model Context Protocol; service-shaped CFCs become MCP tools.",
    replaces: ["bespoke AI integration endpoints"],
    boxlangMinVersion: "1.13.0",
    docsUrl:
      "https://www.ortussolutions.com/blog/introducing-cbmcp-your-coldbox-app-live-to-every-ai-agent",
    forgeboxUrl: "https://forgebox.io/view/cbmcp",
  },
  {
    slug: "testbox",
    name: "TestBox",
    category: "testing",
    purpose:
      "BDD and xUnit testing framework for BoxLang/CFML, the home for specs covering migrated code.",
    replaces: ["untested public CFC methods", "logic embedded in .cfm files"],
    boxlangMinVersion: "1.13.0",
    docsUrl: "https://testbox.ortusbooks.com/",
    forgeboxUrl: "https://forgebox.io/view/testbox",
  },
];

const SLUGS = new Set(BOXLANG_MODULES.map((m) => m.slug));

/** True when every slug is present in the module catalog. */
export function modulesExist(slugs: string[]): boolean {
  return slugs.every((s) => SLUGS.has(s));
}

export function getModule(slug: string): BoxLangModule | undefined {
  return BOXLANG_MODULES.find((m) => m.slug === slug);
}
