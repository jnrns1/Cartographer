import type { OrtusDocsIndex } from "../types";

/**
 * Flat key to URL lookup. Rules and modules reference documentation by key so
 * that a changed Ortus URL is a one-line edit here. URLs point at stable
 * canonical pages (ForgeBox entries, ortusbooks roots, the BoxLang CFML
 * migration guide) rather than deep anchors that churn. Verified 2026-05-17;
 * `modules.ortussolutions.com` is offline so ForgeBox is the registry of
 * record (see DECISIONS.md).
 */
export const ORTUS_DOCS: OrtusDocsIndex = {
  // BoxLang language and migration
  "boxlang.home": "https://boxlang.ortusbooks.com/",
  "boxlang.running.cfml":
    "https://boxlang.ortusbooks.com/getting-started/overview/running-coldfusion-cfml-apps",
  "boxlang.migrating.lucee":
    "https://boxlang.ortusbooks.com/getting-started/overview/running-coldfusion-cfml-apps/migrating-from-lucee-cfml",
  "boxlang.compat.cfml":
    "https://boxlang.ortusbooks.com/boxlang-framework/modularity/compat-cfml",
  "boxlang.syntax.cfml":
    "https://boxlang.ortusbooks.com/getting-started/overview/syntax-style-guide/cfml",
  "boxlang.queryexecute":
    "https://boxlang.ortusbooks.com/getting-started/overview/running-coldfusion-cfml-apps",
  "boxlang.ai":
    "https://boxlang.ortusbooks.com/boxlang-framework/modularity/ai",
  "boxlang.pdf":
    "https://boxlang.ortusbooks.com/boxlang-framework/modularity/pdf",
  "boxlang.mail":
    "https://boxlang.ortusbooks.com/boxlang-framework/modularity/mail",
  "boxlang.markdown":
    "https://boxlang.ortusbooks.com/boxlang-framework/modularity/markdown",

  // ForgeBox module entries (https://forgebox.io/view/<slug>)
  "forgebox.bx-compat-cfml": "https://forgebox.io/view/bx-compat-cfml",
  "forgebox.bx-pdf": "https://forgebox.io/view/bx-pdf",
  "forgebox.bx-charts": "https://forgebox.io/view/bx-charts",
  "forgebox.bx-meilisearch": "https://forgebox.io/view/bx-meilisearch",
  "forgebox.bx-mail": "https://forgebox.io/view/bx-mail",
  "forgebox.bx-ai": "https://forgebox.io/view/bx-ai",
  "forgebox.bx-csv": "https://forgebox.io/view/bx-csv",
  "forgebox.bx-markdown": "https://forgebox.io/view/bx-markdown",
  "forgebox.bx-redis": "https://forgebox.io/view/bx-redis",
  "forgebox.bx-orm": "https://forgebox.io/view/bx-orm",
  "forgebox.quick": "https://forgebox.io/view/quick",
  "forgebox.cborm": "https://forgebox.io/view/cborm",
  "forgebox.cbwire": "https://forgebox.io/view/cbwire",
  "forgebox.socketbox": "https://forgebox.io/view/socketbox",
  "forgebox.hyper": "https://forgebox.io/view/hyper",
  "forgebox.cbmcp": "https://forgebox.io/view/cbmcp",
  "forgebox.bx-mysql": "https://forgebox.io/view/bx-mysql",
  "forgebox.bx-postgresql": "https://forgebox.io/view/bx-postgresql",

  // Ortus framework documentation roots
  "coldbox.home": "https://coldbox.ortusbooks.com/",
  "coldbox.executors":
    "https://coldbox.ortusbooks.com/digging-deeper/promises-async-programming/executors",
  "coldbox.modules":
    "https://coldbox.ortusbooks.com/hmvc/modules",
  "cbwire.home": "https://cbwire.ortusbooks.com/",
  "quick.home": "https://quick.ortusbooks.com/",
  "testbox.home": "https://testbox.ortusbooks.com/",
  "testbox.bdd":
    "https://testbox.ortusbooks.com/in-depth/bdd-primer",

  // Ortus blog references for newer products
  "ortus.socketbox":
    "https://www.ortussolutions.com/blog/introducing-socketbox-a-new-websocket-library",
  "ortus.cbmcp":
    "https://www.ortussolutions.com/blog/introducing-cbmcp-your-coldbox-app-live-to-every-ai-agent",
  "ortus.coldbox81":
    "https://www.ortussolutions.com/blog/coldbox-810-released-ai-routing-mcp-and-boxlang-first-power",
};
