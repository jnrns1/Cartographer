import type { Rule, RuleCatalog } from "../types";

/**
 * The CFML to BoxLang migration rule catalog. This is the product spine.
 *
 * Every rule names a specific Ortus module or BoxLang feature that resolves it
 * (no generic "consider modernizing" filler, brief anti-pattern 2). Ortus
 * slugs are the corrected, live-verified set (DECISIONS.md): no `bx-jdbc`
 * (BoxLang core ships `queryExecute`), `quick` not `bx-quick`, `bx-charts`
 * not `bx-chart`, `cbwire` not `bx-cbwire`, `bx-compat-cfml` not `bx-compat`.
 *
 * Detection is pure regex (brief 9.3). `preFilterPattern` favors recall.
 * Optional `antiPattern` must also match inside a pre-filter hit to keep it;
 * optional `exclusion` drops a hit when it matches inside the region. CFML
 * tags are case-insensitive, so most rules set `ignoreCase`. Patterns use
 * `String.raw` so backslashes read as written.
 *
 * `confidence` defaults to `medium` for regex-only validation rules and is
 * `high` only where tag presence is unambiguous (brief 13); architecture and
 * opportunity heuristics are `low`.
 */

const rules: Rule[] = [
  // ----------------------------------------------------------------------
  // Security (critical/high, blocksMigration: true, jiraIssueType: Bug)
  // ----------------------------------------------------------------------
  {
    id: "CFML-SEC-001",
    title: "Unparameterized cfquery with dynamic value",
    category: "security",
    subcategory: "sql-injection",
    severity: "critical",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex-then-validate",
      preFilterPattern: String.raw`<cfquery\b[^>]*>[\s\S]*?<\/cfquery>`,
      antiPattern: String.raw`#\s*[a-z_][\w.\[\]'"$ ]*\s*#`,
      exclusion: String.raw`<cfqueryparam\b`,
      ignoreCase: true,
    },
    rationale:
      "A cfquery body that interpolates a variable directly into SQL without cfqueryparam is open to SQL injection. The defect must be fixed before migration regardless of the target engine.",
    recommendation:
      "Wrap every dynamic value in <cfqueryparam value=\"#var#\" cfsqltype=\"...\">, or move the call to BoxLang queryExecute() with a bound params struct. For new persistence code prefer the Quick ORM (quick), which parameterizes by default. File {{file}}, {{occurrences}} query block(s).",
    references: [
      { key: "boxlang.queryexecute", title: "BoxLang queries and queryExecute" },
      { key: "forgebox.quick", title: "Quick ORM on ForgeBox" },
    ],
    ortusModules: ["quick"],
    estimatedEffortHours: { low: 0.5, expected: 1, high: 2 },
    fixComplexity: "low",
    blocksMigration: true,
    confidence: "medium",
    jiraIssueType: "Bug",
  },
  {
    id: "CFML-SEC-002",
    title: "Dynamic evaluate() or de() usage",
    category: "security",
    subcategory: "dynamic-evaluation",
    severity: "high",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`\b(?:evaluate|de)\s*\(`,
      ignoreCase: true,
    },
    rationale:
      "evaluate() executes a string as CFML at runtime, which is an injection and maintainability hazard. BoxLang supports it through bx-compat-cfml but discourages it.",
    recommendation:
      "Replace evaluate() with direct struct or array member access, or a struct dispatch map, or invoke() for dynamic method calls (all BoxLang core). Remove de() once evaluate() is gone. File {{file}}, {{occurrences}} call(s).",
    references: [
      { key: "boxlang.syntax.cfml", title: "BoxLang CFML syntax guide" },
    ],
    ortusModules: [],
    estimatedEffortHours: { low: 1, expected: 2, high: 4 },
    fixComplexity: "medium",
    blocksMigration: true,
    confidence: "high",
    jiraIssueType: "Bug",
  },
  {
    id: "CFML-SEC-003",
    title: "cfinclude with a non-literal template",
    category: "security",
    subcategory: "path-traversal",
    severity: "high",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cfinclude\b[^>]*template\s*=\s*"[^"]*#[^"]*"`,
      ignoreCase: true,
    },
    rationale:
      "A cfinclude template assembled from a variable enables local file inclusion and path traversal.",
    recommendation:
      "Replace the dynamic include with an allow-list switch over known templates, or a ColdBox event/view. bx-compat-cfml honors cfinclude; the dynamic path is the vulnerability and must be constrained. File {{file}}.",
    references: [
      { key: "boxlang.compat.cfml", title: "BoxLang CFML compatibility" },
      { key: "forgebox.bx-compat-cfml", title: "bx-compat-cfml on ForgeBox" },
    ],
    ortusModules: ["bx-compat-cfml"],
    estimatedEffortHours: { low: 1, expected: 2, high: 4 },
    fixComplexity: "medium",
    blocksMigration: true,
    confidence: "high",
    jiraIssueType: "Bug",
  },
  {
    id: "CFML-SEC-004",
    title: "cffile upload without an accept allow-list",
    category: "security",
    subcategory: "unrestricted-upload",
    severity: "high",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cffile\b(?=[^>]*\baction\s*=\s*"upload")(?![^>]*\baccept\s*=)[^>]*>`,
      ignoreCase: true,
    },
    rationale:
      "A cffile upload with no accept MIME allow-list permits arbitrary file upload, including web shells.",
    recommendation:
      "Add an accept MIME allow-list and strict=\"true\" to every cffile upload, validate the extension server-side, and store outside the webroot. bx-compat-cfml runs cffile; the missing allow-list is the defect. File {{file}}.",
    references: [
      { key: "boxlang.compat.cfml", title: "BoxLang CFML compatibility" },
      { key: "forgebox.bx-compat-cfml", title: "bx-compat-cfml on ForgeBox" },
    ],
    ortusModules: ["bx-compat-cfml"],
    estimatedEffortHours: { low: 1, expected: 2, high: 4 },
    fixComplexity: "low",
    blocksMigration: true,
    confidence: "high",
    jiraIssueType: "Bug",
  },
  {
    id: "CFML-SEC-005",
    title: "Hard-coded credentials",
    category: "security",
    subcategory: "secret-in-source",
    severity: "critical",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`\b(?:password|passwd|pwd|secret|api[_-]?key|apikey|access[_-]?key|client[_-]?secret|auth[_-]?token)\b\s*(?:=|:)\s*["'][^"'#\n]{3,}["']`,
      ignoreCase: true,
    },
    rationale:
      "Secrets committed in source leak through version control and prevent per-environment configuration on BoxLang.",
    recommendation:
      "Move every secret to environment configuration read with BoxLang getSystemSetting() or ColdBox getSetting(); never commit literals. File {{file}}, {{occurrences}} hit(s).",
    references: [
      { key: "boxlang.running.cfml", title: "Running CFML apps on BoxLang" },
      { key: "coldbox.home", title: "ColdBox documentation" },
    ],
    ortusModules: [],
    estimatedEffortHours: { low: 1, expected: 2, high: 4 },
    fixComplexity: "low",
    blocksMigration: true,
    confidence: "medium",
    jiraIssueType: "Bug",
  },
  {
    id: "CFML-SEC-006",
    title: "cfheader with a user-controlled value",
    category: "security",
    subcategory: "response-splitting",
    severity: "high",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cfheader\b[^>]*\bvalue\s*=\s*"[^"]*#(?:url|form|cgi)\.[^"]*"`,
      ignoreCase: true,
    },
    rationale:
      "A response header built from url, form, or cgi input enables HTTP response splitting and header injection.",
    recommendation:
      "Allow-list and sanitize the value, stripping CR and LF, and prefer ColdBox event.setHTTPHeader() with validated input. bx-compat-cfml runs cfheader; the unsanitized input is the defect. File {{file}}.",
    references: [
      { key: "boxlang.compat.cfml", title: "BoxLang CFML compatibility" },
    ],
    ortusModules: ["bx-compat-cfml"],
    estimatedEffortHours: { low: 1, expected: 2, high: 4 },
    fixComplexity: "medium",
    blocksMigration: true,
    confidence: "medium",
    jiraIssueType: "Bug",
  },
  {
    id: "CFML-SEC-007",
    title: "Unscoped variable writes (Application.cfc lifecycle)",
    category: "security",
    subcategory: "shared-mutable-state",
    severity: "high",
    appliesTo: ["cfc"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cfset\s+(?!(?:var|local|application|session|request|server|arguments|this|variables|attributes|caller|thread)\b)[a-z_]\w*\s*=`,
      ignoreCase: true,
    },
    rationale:
      "Unscoped writes in Application.cfc lifecycle methods become shared mutable state across requests, producing race conditions that surface differently under the BoxLang runtime threading model.",
    recommendation:
      "Scope every write explicitly (var or local for function-local, application/session/request for shared) and guard shared writes with cflock. Review Application.cfc onApplicationStart and onRequestStart. bx-compat-cfml runs Application.cfc; correct scoping is required first. File {{file}}.",
    references: [
      { key: "boxlang.compat.cfml", title: "BoxLang CFML compatibility" },
      { key: "boxlang.running.cfml", title: "Running CFML apps on BoxLang" },
    ],
    ortusModules: ["bx-compat-cfml"],
    estimatedEffortHours: { low: 2, expected: 4, high: 8 },
    fixComplexity: "medium",
    blocksMigration: true,
    confidence: "low",
    jiraIssueType: "Bug",
  },

  // ----------------------------------------------------------------------
  // Legacy UI (high, jiraIssueType: Story)
  // ----------------------------------------------------------------------
  {
    id: "CFML-UI-001",
    title: "cfgrid usage",
    category: "legacy-ui",
    subcategory: "deprecated-ajax-tag",
    severity: "high",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cfgrid\b`,
      ignoreCase: true,
    },
    rationale:
      "cfgrid is an Adobe ColdFusion AJAX UI tag backed by bundled Ext JS that is not part of the BoxLang open-source runtime.",
    recommendation:
      "Replace with a CBWire (cbwire) reactive grid component, or an HTMX-driven table backed by a ColdBox handler action. File {{file}}, {{occurrences}} grid(s).",
    references: [
      { key: "forgebox.cbwire", title: "cbwire on ForgeBox" },
      { key: "cbwire.home", title: "CBWire documentation" },
    ],
    ortusModules: ["cbwire"],
    estimatedEffortHours: { low: 2, expected: 4, high: 8 },
    fixComplexity: "medium",
    blocksMigration: false,
    confidence: "high",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-UI-002",
    title: "cflayout usage",
    category: "legacy-ui",
    subcategory: "deprecated-ajax-tag",
    severity: "high",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cflayout(?:area)?\b`,
      ignoreCase: true,
    },
    rationale:
      "cflayout and cflayoutarea render an Ext JS layout that the BoxLang core does not bundle.",
    recommendation:
      "Rebuild the layout with ColdBox layouts and view partials, adding CBWire (cbwire) components where the region needs reactivity. File {{file}}.",
    references: [
      { key: "forgebox.cbwire", title: "cbwire on ForgeBox" },
      { key: "coldbox.home", title: "ColdBox layouts" },
    ],
    ortusModules: ["cbwire"],
    estimatedEffortHours: { low: 2, expected: 4, high: 8 },
    fixComplexity: "medium",
    blocksMigration: false,
    confidence: "high",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-UI-003",
    title: "cfwindow usage",
    category: "legacy-ui",
    subcategory: "deprecated-ajax-tag",
    severity: "high",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cfwindow\b`,
      ignoreCase: true,
    },
    rationale:
      "cfwindow renders an Ext JS modal window not present in the BoxLang runtime.",
    recommendation:
      "Replace with a CBWire (cbwire) modal component, or a standard ADS-style dialog driven by a ColdBox handler. File {{file}}.",
    references: [{ key: "forgebox.cbwire", title: "cbwire on ForgeBox" }],
    ortusModules: ["cbwire"],
    estimatedEffortHours: { low: 2, expected: 4, high: 8 },
    fixComplexity: "medium",
    blocksMigration: false,
    confidence: "high",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-UI-004",
    title: "cfajaxproxy usage",
    category: "legacy-ui",
    subcategory: "deprecated-ajax-tag",
    severity: "high",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cfajaxproxy\b`,
      ignoreCase: true,
    },
    rationale:
      "cfajaxproxy generates a client proxy bound to the Adobe AJAX stack that BoxLang does not ship.",
    recommendation:
      "Expose a ColdBox JSON handler and call it with fetch or HTMX. For server push use SocketBox (socketbox) instead of proxy polling. File {{file}}.",
    references: [
      { key: "forgebox.cbwire", title: "cbwire on ForgeBox" },
      { key: "forgebox.socketbox", title: "SocketBox on ForgeBox" },
    ],
    ortusModules: ["cbwire", "socketbox"],
    estimatedEffortHours: { low: 2, expected: 4, high: 8 },
    fixComplexity: "medium",
    blocksMigration: false,
    confidence: "high",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-UI-005",
    title: "cftree or cfmenu usage",
    category: "legacy-ui",
    subcategory: "deprecated-ajax-tag",
    severity: "high",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cf(?:tree|menu)\b`,
      ignoreCase: true,
    },
    rationale:
      "cftree and cfmenu render Ext JS widgets absent from the BoxLang runtime.",
    recommendation:
      "Replace with a CBWire (cbwire) tree or menu component, or static navigation enhanced with HTMX. File {{file}}.",
    references: [{ key: "forgebox.cbwire", title: "cbwire on ForgeBox" }],
    ortusModules: ["cbwire"],
    estimatedEffortHours: { low: 2, expected: 4, high: 8 },
    fixComplexity: "medium",
    blocksMigration: false,
    confidence: "high",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-UI-006",
    title: "cfform with format flash or xml",
    category: "legacy-ui",
    subcategory: "deprecated-form-format",
    severity: "high",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cfform\b[^>]*\bformat\s*=\s*"(?:flash|xml)"`,
      ignoreCase: true,
    },
    rationale:
      "cfform format flash or xml depends on Adobe-only client runtimes that BoxLang does not provide.",
    recommendation:
      "Render a standard HTML form with ColdBox validation, adding CBWire (cbwire) where the form needs reactivity. File {{file}}.",
    references: [{ key: "forgebox.cbwire", title: "cbwire on ForgeBox" }],
    ortusModules: ["cbwire"],
    estimatedEffortHours: { low: 2, expected: 4, high: 8 },
    fixComplexity: "medium",
    blocksMigration: false,
    confidence: "high",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-UI-007",
    title: "cfinput rich types or cfcalendar",
    category: "legacy-ui",
    subcategory: "deprecated-ajax-tag",
    severity: "high",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cfinput\b[^>]*\btype\s*=\s*"(?:datefield|datetimepicker|spinner)"|<cfcalendar\b`,
      ignoreCase: true,
    },
    rationale:
      "cfinput datefield and similar rich types, and cfcalendar, render Adobe AJAX widgets not present in BoxLang.",
    recommendation:
      "Use native HTML5 input types (date, datetime-local, number) or a CBWire (cbwire) date component. File {{file}}.",
    references: [{ key: "forgebox.cbwire", title: "cbwire on ForgeBox" }],
    ortusModules: ["cbwire"],
    estimatedEffortHours: { low: 1, expected: 4, high: 8 },
    fixComplexity: "low",
    blocksMigration: false,
    confidence: "high",
    jiraIssueType: "Story",
  },

  // ----------------------------------------------------------------------
  // Deprecated (medium, jiraIssueType: Story)
  // ----------------------------------------------------------------------
  {
    id: "CFML-DEP-001",
    title: "cfwddx serialization",
    category: "deprecated",
    subcategory: "legacy-serialization",
    severity: "medium",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cfwddx\b`,
      ignoreCase: true,
    },
    rationale:
      "WDDX is a legacy XML serialization format superseded by JSON across the modern stack.",
    recommendation:
      "Replace cfwddx with serializeJSON() and deserializeJSON() (BoxLang core); use bx-compat-cfml only if a WDDX wire format must be retained transiently. File {{file}}.",
    references: [
      { key: "boxlang.compat.cfml", title: "BoxLang CFML compatibility" },
    ],
    ortusModules: ["bx-compat-cfml"],
    estimatedEffortHours: { low: 0.5, expected: 1, high: 2 },
    fixComplexity: "low",
    blocksMigration: false,
    confidence: "high",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-DEP-002",
    title: "cfreport usage",
    category: "deprecated",
    subcategory: "legacy-reporting",
    severity: "medium",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cfreport\b`,
      ignoreCase: true,
    },
    rationale:
      "cfreport depends on the Adobe ColdFusion Report Builder runtime, which BoxLang does not provide.",
    recommendation:
      "Regenerate the report as HTML rendered to PDF via bx-pdf. File {{file}}.",
    references: [
      { key: "forgebox.bx-pdf", title: "bx-pdf on ForgeBox" },
      { key: "boxlang.pdf", title: "BoxLang PDF module" },
    ],
    ortusModules: ["bx-pdf"],
    estimatedEffortHours: { low: 0.5, expected: 1, high: 2 },
    fixComplexity: "medium",
    blocksMigration: false,
    confidence: "high",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-DEP-003",
    title: "cfregistry usage",
    category: "deprecated",
    subcategory: "non-portable-io",
    severity: "medium",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cfregistry\b`,
      ignoreCase: true,
    },
    rationale:
      "cfregistry reads and writes the Windows registry, which is non-portable and unsupported on BoxLang.",
    recommendation:
      "Move the values to environment configuration read with BoxLang getSystemSetting(), or to a datasource. File {{file}}.",
    references: [
      { key: "boxlang.running.cfml", title: "Running CFML apps on BoxLang" },
    ],
    ortusModules: [],
    estimatedEffortHours: { low: 0.5, expected: 1, high: 2 },
    fixComplexity: "low",
    blocksMigration: false,
    confidence: "high",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-DEP-004",
    title: "cfcollection, cfindex, or cfsearch usage",
    category: "deprecated",
    subcategory: "legacy-search",
    severity: "medium",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cf(?:collection|index|search)\b`,
      ignoreCase: true,
    },
    rationale:
      "Verity and Solr collections behind cfcollection, cfindex, and cfsearch are a legacy search stack.",
    recommendation:
      "Migrate full-text search to bx-meilisearch, indexing the same fields and replacing cfsearch with its query API. File {{file}}, {{occurrences}} call(s).",
    references: [
      { key: "forgebox.bx-meilisearch", title: "bx-meilisearch on ForgeBox" },
    ],
    ortusModules: ["bx-meilisearch"],
    estimatedEffortHours: { low: 0.5, expected: 1, high: 2 },
    fixComplexity: "medium",
    blocksMigration: false,
    confidence: "high",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-DEP-005",
    title: "iif() usage",
    category: "deprecated",
    subcategory: "dynamic-evaluation",
    severity: "medium",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`\biif\s*\(`,
      ignoreCase: true,
    },
    rationale:
      "iif() evaluates its branches as strings via the same dynamic evaluation engine as evaluate(), which is slow and unsafe.",
    recommendation:
      "Replace iif() with the ternary operator (condition ? a : b), a BoxLang core construct. File {{file}}, {{occurrences}} call(s).",
    references: [
      { key: "boxlang.syntax.cfml", title: "BoxLang CFML syntax guide" },
    ],
    ortusModules: [],
    estimatedEffortHours: { low: 0.5, expected: 1, high: 2 },
    fixComplexity: "low",
    blocksMigration: false,
    confidence: "high",
    jiraIssueType: "Story",
  },

  // ----------------------------------------------------------------------
  // Compat Adobe (high, blocking, jiraIssueType: Story)
  // ----------------------------------------------------------------------
  {
    id: "CFML-COMPAT-ADOBE-001",
    title: "cfdocument with Adobe-specific attributes",
    category: "compat-adobe",
    subcategory: "adobe-only-attribute",
    severity: "high",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cfdocument\b[^>]*\b(?:fontembed|permissions|userpassword|ownerpassword|saveasname|proxyhost|proxyport)\s*=`,
      ignoreCase: true,
    },
    rationale:
      "These cfdocument attributes are Adobe-specific and are not all honored by the BoxLang PDF module.",
    recommendation:
      "Move PDF generation to bx-pdf and re-express the unsupported attributes through its API (encryption, fonts, and proxy options). File {{file}}.",
    references: [
      { key: "forgebox.bx-pdf", title: "bx-pdf on ForgeBox" },
      { key: "boxlang.pdf", title: "BoxLang PDF module" },
    ],
    ortusModules: ["bx-pdf"],
    estimatedEffortHours: { low: 1, expected: 2, high: 4 },
    fixComplexity: "medium",
    blocksMigration: true,
    confidence: "medium",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-COMPAT-ADOBE-002",
    title: "cfpdf actions not in bx-pdf",
    category: "compat-adobe",
    subcategory: "adobe-only-action",
    severity: "high",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cfpdf\b[^>]*\baction\s*=\s*"(?:thumbnail|extracttext|processddx|transform|removewatermark|setinfo|getinfo)"`,
      ignoreCase: true,
    },
    rationale:
      "Several cfpdf actions, especially processddx, have no direct equivalent in the BoxLang PDF module.",
    recommendation:
      "Rework these via bx-pdf supported actions; DDX processing has no BoxLang equivalent and needs a redesign of that document pipeline. File {{file}}.",
    references: [
      { key: "forgebox.bx-pdf", title: "bx-pdf on ForgeBox" },
      { key: "boxlang.pdf", title: "BoxLang PDF module" },
    ],
    ortusModules: ["bx-pdf"],
    estimatedEffortHours: { low: 1, expected: 2, high: 4 },
    fixComplexity: "high",
    blocksMigration: true,
    confidence: "medium",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-COMPAT-ADOBE-003",
    title: "cfpresentation family usage",
    category: "compat-adobe",
    subcategory: "unsupported-tag",
    severity: "high",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cfpresent(?:ation|er|slide)?\b`,
      ignoreCase: true,
    },
    rationale:
      "The cfpresentation tag family is Adobe-only and has no BoxLang equivalent.",
    recommendation:
      "Regenerate slides as HTML rendered to PDF via bx-pdf, or remove the feature if it is unused. File {{file}}.",
    references: [{ key: "forgebox.bx-pdf", title: "bx-pdf on ForgeBox" }],
    ortusModules: ["bx-pdf"],
    estimatedEffortHours: { low: 1, expected: 2, high: 4 },
    fixComplexity: "high",
    blocksMigration: true,
    confidence: "high",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-COMPAT-ADOBE-004",
    title: "cfexchange family usage",
    category: "compat-adobe",
    subcategory: "unsupported-tag",
    severity: "high",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cfexchange\w*\b`,
      ignoreCase: true,
    },
    rationale:
      "The cfexchange tags integrate with Microsoft Exchange via an Adobe-only connector absent from BoxLang.",
    recommendation:
      "Integrate with Microsoft Graph over HTTP using the Hyper (hyper) client. File {{file}}.",
    references: [{ key: "forgebox.hyper", title: "Hyper on ForgeBox" }],
    ortusModules: ["hyper"],
    estimatedEffortHours: { low: 1, expected: 2, high: 4 },
    fixComplexity: "high",
    blocksMigration: true,
    confidence: "high",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-COMPAT-ADOBE-005",
    title: "cfspreadsheet Adobe-only options",
    category: "compat-adobe",
    subcategory: "adobe-only-attribute",
    severity: "high",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cfspreadsheet\b`,
      ignoreCase: true,
    },
    rationale:
      "cfspreadsheet has Adobe-specific behaviors and option defaults that differ on BoxLang.",
    recommendation:
      "Validate each cfspreadsheet call against bx-compat-cfml support and rework any gaps with the BoxLang spreadsheet API. File {{file}}, {{occurrences}} call(s).",
    references: [
      { key: "boxlang.compat.cfml", title: "BoxLang CFML compatibility" },
      { key: "forgebox.bx-compat-cfml", title: "bx-compat-cfml on ForgeBox" },
    ],
    ortusModules: ["bx-compat-cfml"],
    estimatedEffortHours: { low: 1, expected: 2, high: 4 },
    fixComplexity: "medium",
    blocksMigration: true,
    confidence: "medium",
    jiraIssueType: "Story",
  },

  // ----------------------------------------------------------------------
  // Compat Lucee (medium, jiraIssueType: Story)
  // ----------------------------------------------------------------------
  {
    id: "CFML-COMPAT-LUCEE-001",
    title: "Lucee-only cfdump attributes",
    category: "compat-lucee",
    subcategory: "lucee-only-attribute",
    severity: "medium",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cfdump\b[^>]*\b(?:keys|metainfo|showudfs|hide|expand)\s*=`,
      ignoreCase: true,
    },
    rationale:
      "Several cfdump attributes are Lucee extensions that behave differently or are absent on BoxLang.",
    recommendation:
      "Remove debug cfdump from production paths and rely on the common cfdump attribute set supported by bx-compat-cfml. File {{file}}.",
    references: [
      { key: "boxlang.compat.cfml", title: "BoxLang CFML compatibility" },
    ],
    ortusModules: ["bx-compat-cfml"],
    estimatedEffortHours: { low: 0.5, expected: 1, high: 2 },
    fixComplexity: "low",
    blocksMigration: false,
    confidence: "low",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-COMPAT-LUCEE-002",
    title: "Component metadata shape differences",
    category: "compat-lucee",
    subcategory: "metadata-shape",
    severity: "medium",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`\bget(?:Component)?MetaData\s*\(`,
      ignoreCase: true,
    },
    rationale:
      "getMetaData() and getComponentMetaData() return structures whose shape differs between Lucee and BoxLang.",
    recommendation:
      "Audit every metadata consumer and adapt to the BoxLang getMetadata() shape, using bx-compat-cfml for the documented compatibility surface. File {{file}}.",
    references: [
      { key: "boxlang.compat.cfml", title: "BoxLang CFML compatibility" },
    ],
    ortusModules: ["bx-compat-cfml"],
    estimatedEffortHours: { low: 0.5, expected: 1, high: 2 },
    fixComplexity: "medium",
    blocksMigration: false,
    confidence: "low",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-COMPAT-LUCEE-003",
    title: "Lucee-only built-in functions",
    category: "compat-lucee",
    subcategory: "lucee-only-bif",
    severity: "medium",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`\b(?:queryColumnData|queryGetRow|cacheRegionNew|systemOutput|javaProxy)\s*\(`,
      ignoreCase: true,
    },
    rationale:
      "These built-in functions are Lucee extensions and are not part of the portable CFML surface BoxLang implements.",
    recommendation:
      "Replace each with the portable BoxLang equivalent and verify coverage against bx-compat-cfml. File {{file}}, {{occurrences}} call(s).",
    references: [
      { key: "boxlang.compat.cfml", title: "BoxLang CFML compatibility" },
      { key: "boxlang.migrating.lucee", title: "Migrating from Lucee CFML" },
    ],
    ortusModules: ["bx-compat-cfml"],
    estimatedEffortHours: { low: 0.5, expected: 1, high: 2 },
    fixComplexity: "medium",
    blocksMigration: false,
    confidence: "low",
    jiraIssueType: "Story",
  },

  // ----------------------------------------------------------------------
  // Architecture (medium, jiraIssueType: Story)
  // ----------------------------------------------------------------------
  {
    id: "CFML-ARCH-001",
    title: "CFC over 800 lines",
    category: "architecture",
    subcategory: "oversized-component",
    severity: "medium",
    appliesTo: ["cfc"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`(?:[^\n]*\n){800,}`,
    },
    rationale:
      "A CFC over 800 lines concentrates too many responsibilities to migrate and test as a single unit safely.",
    recommendation:
      "Split into cohesive services and handlers, introduce ColdBox modules for the seams, and add TestBox (testbox) specs around them before refactoring. File {{file}}.",
    references: [
      { key: "coldbox.modules", title: "ColdBox modules" },
      { key: "testbox.home", title: "TestBox documentation" },
    ],
    ortusModules: ["testbox"],
    estimatedEffortHours: { low: 4, expected: 8, high: 16 },
    fixComplexity: "high",
    blocksMigration: false,
    confidence: "low",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-ARCH-002",
    title: "Mixed presentation and business logic",
    category: "architecture",
    subcategory: "separation-of-concerns",
    severity: "medium",
    appliesTo: ["cfm", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cfoutput\b[^>]*>[\s\S]*?<cfquery\b[\s\S]*?<\/cfquery>[\s\S]*?<\/cfoutput>`,
      ignoreCase: true,
    },
    rationale:
      "Data access interleaved with HTML output cannot be unit tested and is risky to port.",
    recommendation:
      "Separate into a ColdBox handler, a service, and a view, moving queries into Quick (quick) models. File {{file}}.",
    references: [
      { key: "forgebox.quick", title: "Quick ORM on ForgeBox" },
      { key: "coldbox.home", title: "ColdBox HMVC" },
    ],
    ortusModules: ["quick"],
    estimatedEffortHours: { low: 4, expected: 8, high: 16 },
    fixComplexity: "high",
    blocksMigration: false,
    confidence: "low",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-ARCH-003",
    title: "Custom tag that should be a ColdBox module",
    category: "architecture",
    subcategory: "outdated-reuse",
    severity: "medium",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cf_[a-z][\w-]*|<cfmodule\b`,
      ignoreCase: true,
    },
    rationale:
      "cf_ custom tags and cfmodule are an outdated reuse mechanism; ColdBox modules and CBWire components are the modern units of reuse.",
    recommendation:
      "Convert the recurring custom tag into a ColdBox module, or a CBWire (cbwire) component when it renders UI. File {{file}}, {{occurrences}} site(s).",
    references: [
      { key: "coldbox.modules", title: "ColdBox modules" },
      { key: "forgebox.cbwire", title: "cbwire on ForgeBox" },
    ],
    ortusModules: ["cbwire"],
    estimatedEffortHours: { low: 4, expected: 8, high: 16 },
    fixComplexity: "medium",
    blocksMigration: false,
    confidence: "low",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-ARCH-004",
    title: "Server-scope cross-request mutable state",
    category: "architecture",
    subcategory: "shared-mutable-state",
    severity: "medium",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`\bserver\.[a-z_]\w+\s*=(?!=)`,
      ignoreCase: true,
    },
    rationale:
      "Writing application-wide mutable state into the server scope without locking causes cross-request races that behave differently under BoxLang threading.",
    recommendation:
      "Move shared mutable state to bx-redis or a properly locked, scoped cache, and treat the server scope as read-only configuration. File {{file}}, {{occurrences}} write(s).",
    references: [{ key: "forgebox.bx-redis", title: "bx-redis on ForgeBox" }],
    ortusModules: ["bx-redis"],
    estimatedEffortHours: { low: 4, expected: 8, high: 16 },
    fixComplexity: "medium",
    blocksMigration: false,
    confidence: "low",
    jiraIssueType: "Story",
  },

  // ----------------------------------------------------------------------
  // Modernization opportunity (low, jiraIssueType: Story)
  // ----------------------------------------------------------------------
  {
    id: "CFML-MOD-001",
    title: "Manual SQL eligible for Quick ORM",
    category: "modernization",
    subcategory: "orm-opportunity",
    severity: "low",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cfquery\b[\s\S]*?\b(?:insert\s+into|update\s+\w+\s+set|delete\s+from|select\s+[\s\S]*?\bfrom)\b[\s\S]*?<\/cfquery>`,
      ignoreCase: true,
    },
    rationale:
      "Hand-built CRUD cfquery blocks are an opportunity to adopt a parameterized ActiveRecord model.",
    recommendation:
      "Model the table as a Quick (quick) entity and replace the CRUD cfquery with ActiveRecord calls, which are parameterized by default. File {{file}}, {{occurrences}} query block(s).",
    references: [
      { key: "forgebox.quick", title: "Quick ORM on ForgeBox" },
      { key: "quick.home", title: "Quick documentation" },
    ],
    ortusModules: ["quick"],
    estimatedEffortHours: { low: 1.5, expected: 3, high: 6 },
    fixComplexity: "medium",
    blocksMigration: false,
    confidence: "low",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-MOD-002",
    title: "Synchronous loop eligible for virtual threads",
    category: "modernization",
    subcategory: "concurrency-opportunity",
    severity: "low",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cfloop\b[\s\S]*?<cf(?:http|query|invoke|file)\b[\s\S]*?<\/cfloop>`,
      ignoreCase: true,
    },
    rationale:
      "A loop performing independent blocking work per iteration can run in parallel under the BoxLang virtual-thread model.",
    recommendation:
      "Parallelize independent iterations with ColdBox virtual-thread executors or asyncManager.allApply(). File {{file}}.",
    references: [
      { key: "coldbox.executors", title: "ColdBox async executors" },
    ],
    ortusModules: [],
    estimatedEffortHours: { low: 1.5, expected: 3, high: 6 },
    fixComplexity: "medium",
    blocksMigration: false,
    confidence: "low",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-MOD-003",
    title: "Search eligible for bx-meilisearch",
    category: "modernization",
    subcategory: "search-opportunity",
    severity: "low",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cfquery\b[\s\S]*?\blike\s+['"]?%[\s\S]*?<\/cfquery>`,
      ignoreCase: true,
    },
    rationale:
      "Leading-wildcard LIKE queries scan the table and deliver poor relevance; this is a search-engine opportunity.",
    recommendation:
      "Move free-text search to bx-meilisearch for relevance ranking and speed, keeping SQL for exact lookups. File {{file}}.",
    references: [
      { key: "forgebox.bx-meilisearch", title: "bx-meilisearch on ForgeBox" },
    ],
    ortusModules: ["bx-meilisearch"],
    estimatedEffortHours: { low: 1.5, expected: 3, high: 6 },
    fixComplexity: "medium",
    blocksMigration: false,
    confidence: "low",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-MOD-004",
    title: "Long-polling eligible for SocketBox",
    category: "modernization",
    subcategory: "realtime-opportunity",
    severity: "low",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cfloop\b[^>]*\bcondition\s*=[\s\S]*?<cfflush\b[\s\S]*?<\/cfloop>`,
      ignoreCase: true,
    },
    rationale:
      "A condition loop that flushes output is a server-push workaround that ties up a request thread.",
    recommendation:
      "Replace the poll-and-flush loop with a SocketBox (socketbox) WebSocket channel. File {{file}}.",
    references: [
      { key: "forgebox.socketbox", title: "SocketBox on ForgeBox" },
      { key: "ortus.socketbox", title: "Introducing SocketBox" },
    ],
    ortusModules: ["socketbox"],
    estimatedEffortHours: { low: 1.5, expected: 3, high: 6 },
    fixComplexity: "high",
    blocksMigration: false,
    confidence: "low",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-MOD-005",
    title: "Manual LLM JSON eligible for BoxLang AI",
    category: "modernization",
    subcategory: "ai-opportunity",
    severity: "low",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`https?:\/\/(?:api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com)`,
      ignoreCase: true,
    },
    rationale:
      "Hand-rolled LLM HTTP calls with manual JSON assembly are brittle and provider-locked.",
    recommendation:
      "Replace the hand-rolled call with bx-ai structured outputs and tool calling, which abstracts the provider. File {{file}}.",
    references: [
      { key: "forgebox.bx-ai", title: "bx-ai on ForgeBox" },
      { key: "boxlang.ai", title: "BoxLang AI module" },
    ],
    ortusModules: ["bx-ai"],
    estimatedEffortHours: { low: 1.5, expected: 3, high: 6 },
    fixComplexity: "medium",
    blocksMigration: false,
    confidence: "low",
    jiraIssueType: "Story",
  },

  // ----------------------------------------------------------------------
  // AI-readiness (informational, severity low, jiraIssueType: Story)
  // ----------------------------------------------------------------------
  {
    id: "CFML-AI-001",
    title: "Service-shaped CFC for cbMCP exposure",
    category: "ai-readiness",
    subcategory: "mcp-candidate",
    severity: "low",
    appliesTo: ["cfc"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`\bcomponent\b[\s\S]*?\b(?:remote|public)\s+\w+\s+function\s+\w+\s*\(`,
      ignoreCase: true,
    },
    rationale:
      "A cohesive service CFC with public methods is a natural candidate to expose to AI agents once migrated.",
    recommendation:
      "After migration, expose this service to AI agents via cbMCP (cbmcp), annotating the public methods as Model Context Protocol tools. File {{file}}.",
    references: [
      { key: "forgebox.cbmcp", title: "cbMCP on ForgeBox" },
      { key: "ortus.cbmcp", title: "Introducing cbMCP" },
    ],
    ortusModules: ["cbmcp"],
    estimatedEffortHours: { low: 2, expected: 4, high: 8 },
    fixComplexity: "medium",
    blocksMigration: false,
    confidence: "low",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-AI-002",
    title: "Data model for retrieval indexing",
    category: "ai-readiness",
    subcategory: "rag-candidate",
    severity: "low",
    appliesTo: ["cfc"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`\bpersistent\s*=\s*["']?true|<cfproperty\b`,
      ignoreCase: true,
    },
    rationale:
      "A persistent entity with text columns is a candidate for retrieval-augmented answers after migration.",
    recommendation:
      "Index this entity's text columns into bx-meilisearch, or a vector store fed through bx-ai, to support retrieval-augmented generation. File {{file}}.",
    references: [
      { key: "forgebox.bx-meilisearch", title: "bx-meilisearch on ForgeBox" },
      { key: "forgebox.bx-ai", title: "bx-ai on ForgeBox" },
    ],
    ortusModules: ["bx-meilisearch", "bx-ai"],
    estimatedEffortHours: { low: 2, expected: 4, high: 8 },
    fixComplexity: "medium",
    blocksMigration: false,
    confidence: "low",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-AI-003",
    title: "Multi-step workflow for AI agent tooling",
    category: "ai-readiness",
    subcategory: "agent-tool-candidate",
    severity: "low",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cfthread\b`,
      ignoreCase: true,
    },
    rationale:
      "A threaded multi-step process is a candidate to expose as an AI agent tool after migration.",
    recommendation:
      "Model the process as a bx-ai agent tool reachable through ColdBox 8.1 AI routing (router.toAi()). File {{file}}.",
    references: [
      { key: "forgebox.bx-ai", title: "bx-ai on ForgeBox" },
      { key: "ortus.coldbox81", title: "ColdBox 8.1 AI routing and MCP" },
    ],
    ortusModules: ["bx-ai"],
    estimatedEffortHours: { low: 2, expected: 4, high: 8 },
    fixComplexity: "high",
    blocksMigration: false,
    confidence: "low",
    jiraIssueType: "Story",
  },

  // ----------------------------------------------------------------------
  // Tests (low, jiraIssueType: Story)
  // ----------------------------------------------------------------------
  {
    id: "CFML-TEST-001",
    title: "Public CFC method without a TestBox spec",
    category: "tests",
    subcategory: "missing-coverage",
    severity: "low",
    appliesTo: ["cfc"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`\b(?:public|remote)\s+\w+\s+function\s+\w+\s*\(`,
      ignoreCase: true,
    },
    rationale:
      "Public methods without specs are a migration risk because behavior changes cannot be caught.",
    recommendation:
      "Add TestBox (testbox) BDD specs covering each public method before refactoring it for BoxLang. File {{file}}, {{occurrences}} method(s).",
    references: [
      { key: "testbox.home", title: "TestBox documentation" },
      { key: "testbox.bdd", title: "TestBox BDD primer" },
    ],
    ortusModules: ["testbox"],
    estimatedEffortHours: { low: 0.5, expected: 1, high: 2 },
    fixComplexity: "low",
    blocksMigration: false,
    confidence: "low",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-TEST-002",
    title: "Business logic in .cfm files",
    category: "tests",
    subcategory: "untestable-logic",
    severity: "low",
    appliesTo: ["cfm", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`<cffunction\b`,
      ignoreCase: true,
    },
    rationale:
      "Function definitions inside .cfm views are logic that cannot be unit tested where it lives.",
    recommendation:
      "Move the logic into ColdBox handlers or services and cover it with TestBox (testbox) specs. File {{file}}.",
    references: [{ key: "testbox.home", title: "TestBox documentation" }],
    ortusModules: ["testbox"],
    estimatedEffortHours: { low: 0.5, expected: 1, high: 2 },
    fixComplexity: "medium",
    blocksMigration: false,
    confidence: "low",
    jiraIssueType: "Story",
  },

  // ----------------------------------------------------------------------
  // Config (low, jiraIssueType: Story)
  // ----------------------------------------------------------------------
  {
    id: "CFML-CFG-001",
    title: "Application.cfc settings needing translation",
    category: "config",
    subcategory: "application-settings",
    severity: "low",
    appliesTo: ["cfc"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`\bthis\.(?:datasource|sessionmanagement|setclientcookies|customtagpaths|mappings|javasettings|ormsettings|ormenabled|clientmanagement)\b\s*=`,
      ignoreCase: true,
    },
    rationale:
      "Several Application.cfc settings have different defaults or translation needs on BoxLang.",
    recommendation:
      "Translate these settings to the BoxLang Application configuration and bx-compat-cfml options, verifying datasource and ORM settings explicitly. File {{file}}, {{occurrences}} setting(s).",
    references: [
      { key: "boxlang.compat.cfml", title: "BoxLang CFML compatibility" },
      { key: "forgebox.bx-compat-cfml", title: "bx-compat-cfml on ForgeBox" },
    ],
    ortusModules: ["bx-compat-cfml"],
    estimatedEffortHours: { low: 0.5, expected: 1, high: 2 },
    fixComplexity: "low",
    blocksMigration: false,
    confidence: "low",
    jiraIssueType: "Story",
  },
  {
    id: "CFML-CFG-002",
    title: "Hard-coded environment values",
    category: "config",
    subcategory: "environment-coupling",
    severity: "low",
    appliesTo: ["cfm", "cfc", "cfml"],
    detect: {
      strategy: "regex",
      preFilterPattern: String.raw`https?:\/\/(?:localhost|127\.0\.0\.1)|[A-Za-z]:\\[^"'\s]+|\/var\/www\/|\/opt\/[a-z]|\/usr\/local\/`,
      ignoreCase: true,
    },
    rationale:
      "Environment-specific hosts and filesystem paths embedded in source break across environments and the migration.",
    recommendation:
      "Externalize these values via BoxLang getSystemSetting() or ColdBox per-environment configuration. File {{file}}, {{occurrences}} value(s).",
    references: [
      { key: "boxlang.running.cfml", title: "Running CFML apps on BoxLang" },
      { key: "coldbox.home", title: "ColdBox environment configuration" },
    ],
    ortusModules: [],
    estimatedEffortHours: { low: 0.5, expected: 1, high: 2 },
    fixComplexity: "low",
    blocksMigration: false,
    confidence: "low",
    jiraIssueType: "Story",
  },
];

export const RULE_CATALOG: RuleCatalog = {
  schemaVersion: "1.0",
  rules,
};

export const RULES: Rule[] = rules;

export function getRule(id: string): Rule | undefined {
  return rules.find((r) => r.id === id);
}
