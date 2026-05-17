Cartographer for Atlassian — Full Build Brief
What this file is: the complete, opinionated, single-artifact build brief for Cartographer, an Atlassian Forge app that scans CFML and ColdFusion codebases and produces a structured BoxLang migration backlog directly inside Jira and Confluence.
How to use it: save this file as `BUILD_BRIEF.md` at the root of an empty working directory. Open Claude Code in that directory. Paste the exact kickoff prompt in §0.1. Gate every phase.
Table of contents

1. Kickoff: how to start, what to expect
2. Identity, posture, and hard rules
3. Product summary
4. Architecture: Forge, UI Kit, modules
5. Forge manifest
6. Storage schema (Forge Storage)
7. Reference data files (the rule catalog is the spine)
8. UI surfaces
9. Resolvers (backend functions)
10. Async scan worker
11. Code source integrations (zip, GitHub, Bitbucket)
12. Jira integration (auto-create issues)
13. Confluence integration (plan and report pages)
14. Detection methodology end to end
15. Work item schema
16. Estimation and phasing
17. Output formats (within Atlassian + export)
18. Visual and copy standards
19. Marketplace listing
20. Pricing decision (deferred to operator)
21. Build phases with exit gates
22. Testing strategy
23. References Claude Code must consult live
24. Anti-patterns
25. Definition of done
0. Kickoff: how to start, what to expect
0.1 The exact prompt to paste into Claude Code

```
Read BUILD_BRIEF.md cover to cover before doing anything. Confirm you have read it by summarizing each section header in one line.

Then begin Phase 0 from §20. Do not move to Phase 1 until I confirm the gate.

Maintain a running TODO list. At every phase gate, post a three-paragraph status: what shipped, what is tested, what is deferred.

If anything in the brief is wrong, missing, contradictory, or impossible, stop and ask before deviating. The Forge platform changes; verify against live docs (§22) before writing manifest, module declarations, or API calls.

No em dashes anywhere in user-facing text. No generic recommendations. No emojis except where the brief explicitly allows.

Required prerequisites before starting: confirm you have Node.js 22 or higher available, npm installed, and the Forge CLI installable (`npm install -g @forge/cli`). If any is missing, list what the operator must install, then wait.

```

0.2 What this build produces
When Phase 11 completes:

1. A working Atlassian Forge app source tree, deployable with `forge deploy`.
2. A complete rule catalog (32+ rules) for CFML to BoxLang migration analysis.
3. A scan engine that handles up to 5,000 files via chunked async events.
4. Three UI surfaces: Jira project page (main app), Jira admin page (settings), Confluence space page (report viewer).
5. One-click "Create Jira issues from work items" with full epic, story, subtask hierarchy.
6. One-click "Publish migration plan to Confluence" creating a structured plan page.
7. Code source integrations: zip upload, Bitbucket repo, GitHub repo (read-only via PAT).
8. Marketplace listing draft: name, description, screenshots brief, pricing-tier-agnostic copy.
9. Testing: unit tests for rule engine, integration test for one full scan, fixtures.
10. A release commands cheatsheet you run yourself.
1. Identity, posture, and hard rules
You are Claude Code building an Atlassian Marketplace app. The end user is an enterprise developer or tech lead running aging ColdFusion in Jira-managed projects, planning a BoxLang migration.
Posture rules:

1. Ship-grade, not demo-grade. Every artifact would pass a marketplace reviewer's first look.
2. Verify Forge platform behavior live. Forge changes frequently. Module names, manifest schema, runtime versions, async event quotas, and permissions evolve. Always consult the live docs before writing dependent code.
3. The rule catalog is the product. Every rule names a specific Ortus module or BoxLang feature that resolves it. No "consider modernizing this" filler.
4. Phases are gated. Wait for operator confirmation between phases.
5. Forge constraints are real. Function timeouts (25s sync, 15min async), 200KB manifest, memory caps, no persistent disk. Design within them; do not pretend they don't exist.
6. No em dashes. Commas, parentheses, new sentences.
7. Code reads like a product. TypeScript everywhere. Types declared. No `any` unless justified in a comment.
8. Stop and ask on ambiguity. No silent improvisation.
9. No deploy or marketplace submit without operator confirmation. Print the commands and wait.
2. Product summary
Name: Cartographer for Atlassian Type: Atlassian Forge app (Jira + Confluence) Distribution: Atlassian Marketplace License (code): Apache-2.0 Initial version: 0.1.0 Runtime: Node.js 22.x UI framework: Forge UI Kit (`@forge/react`) Tagline: Scan ColdFusion codebases. Get a BoxLang migration backlog in Jira.
Core promise: install Cartographer on a Jira Cloud site. Upload a zip of a CFML codebase, or connect a Bitbucket or GitHub repo. Within minutes Cartographer produces a prioritized backlog of migration work items, ready to convert into Jira epics, stories, and subtasks with effort estimates, plus a published Confluence page containing the executive summary and phased roadmap.
Anti-promise: Cartographer does not transform code, does not auto-fix, does not pretend to be a transpiler. v0.1 is read-only against the source tree, produces work items as data, and writes only into Atlassian (Jira issues, Confluence pages, Forge Storage).
Three users in priority order:

1. Enterprise tech lead running aging ColdFusion who needs a defensible inventory and estimate to fund the migration through the standard project intake (which lives in Jira).
2. Consultant or systems integrator running a fixed-bid CFML audit, who can install Cartographer on a client's Jira instance and walk away with a working backlog.
3. Ortus partner or community contributor evaluating a project before recommending Ortus's paid services.
Build for user 1 first.
3. Architecture: Forge, UI Kit, modules
3.1 Why Forge (not Connect, not Data Center)

* Forge is Atlassian's cloud-native platform. Hosted runtime. No infrastructure to manage. Modern manifest-driven. Required for new marketplace cloud apps.
* Connect is the older cloud framework. Requires self-hosted backend. Legacy.
* Data Center apps are Java + P2 plugin framework. Different audience (on-prem enterprise). Out of scope for v0.1.
This build is Forge cloud only. Data Center support is a v1.0+ consideration.
3.2 UI Kit vs Custom UI
Forge offers two UI approaches:

* UI Kit (`@forge/react`) renders Atlassian Design System components natively. Limited to the component set Atlassian provides. Best when the app should feel native and the UI is form-and-table heavy.
* Custom UI runs your HTML/CSS/JS in a sandboxed iframe. Full visual freedom. Higher build complexity and review scrutiny.
Cartographer uses UI Kit for all primary views. The reasons: scan dashboards, work item tables, settings forms, and result viewers are all native fits for ADS components (DynamicTable, Form, Button, Spinner, Tabs). The reports we generate are emitted as Confluence pages using Atlassian markup, not as custom HTML, so we get native-feeling output without leaving the platform.
3.3 Module composition
Modules to declare in `manifest.yml`:

* `jira:projectPage` — Main app surface inside any Jira project. Houses the dashboard, scan launcher, work item list, and "create issues" action.
* `jira:adminPage` — Site-level admin settings (default rule catalog, code source defaults, license info if commercial).
* `confluence:spacePage` — Confluence-side viewer for the published migration plan and report.
* `confluence:globalPage` — Confluence-side dashboard (optional in v0.1, included if time allows).
* `consumer` — Async event consumers for long-running scan jobs.
* `function` — Backend resolvers for UI Kit pages.
* `scheduledTrigger` — Periodic re-scan if user opts in (v0.2 feature, declared but disabled in v0.1).
* `webtrigger` — One inbound webhook for code-source-side push notifications (v0.2, not enabled in v0.1).
3.4 High-level data flow

1. User opens the Cartographer project page in Jira.
2. User chooses code source: zip upload, GitHub repo URL (with PAT), Bitbucket repo (with native OAuth via Forge `providers`).
3. UI calls a resolver to register a scan job. Resolver writes a scan record to Forge Storage and enqueues an async event.
4. Async consumer processes the code source in chunks, applies the rule catalog to each file, writes candidate matches, then rolls them up into work items with effort estimates.
5. UI polls scan status. When complete, the work items table renders.
6. User clicks "Create Jira issues" or "Publish Confluence plan." Resolver calls Jira REST API or Confluence REST API via `@forge/api`.
3.5 Runtime constraints to design within

* Sync resolver timeout: 25 seconds. Used for UI-facing calls. Never run scan logic here.
* Async consumer timeout: 15 minutes per invocation. Used for scan workers. For codebases over what fits in one invocation, chunk the work and re-enqueue.
* Manifest size limit: 200 KB.
* Memory: roughly 256 MB per invocation, not configurable.
* No persistent disk. Use Forge Storage (key-value, custom entities) for state.
* Outbound HTTP: allowed but must declare external domains in `permissions.external.fetch`.
* Cold starts happen. Keep dependencies lean.
4. Forge manifest
`manifest.yml` (verify schema and module names live before committing):

```yaml
app:
  id: 'ari:cloud:ecosystem::app/<generated-uuid>'
  runtime:
    name: nodejs22.x
    memoryMB: 256
    architecture: arm64
modules:
  jira:projectPage:
    - key: cartographer-project-page
      resource: main
      resolver:
        function: project-resolver
      title: Cartographer
      icon: resource:icons/icon-jira.svg
  jira:adminPage:
    - key: cartographer-admin-page
      resource: admin
      resolver:
        function: admin-resolver
      title: Cartographer Settings
  confluence:spacePage:
    - key: cartographer-confluence-space-page
      resource: confluence-space
      resolver:
        function: confluence-resolver
      title: Cartographer Migration Plan
  function:
    - key: project-resolver
      handler: src/resolvers/project.handler
    - key: admin-resolver
      handler: src/resolvers/admin.handler
    - key: confluence-resolver
      handler: src/resolvers/confluence.handler
    - key: scan-worker
      handler: src/workers/scan.handler
  consumer:
    - key: scan-job-consumer
      queue: scan-jobs
      resolver:
        function: scan-worker
        method: process
resources:
  - key: main
    path: static/main/build
  - key: admin
    path: static/admin/build
  - key: confluence-space
    path: static/confluence-space/build
  - key: icons
    path: static/icons
permissions:
  scopes:
    - storage:app
    - read:project:jira
    - read:issue:jira
    - write:issue:jira
    - write:project:jira
    - read:issue-type:jira
    - read:user:jira
    - read:status:jira
    - read:page:confluence
    - write:page:confluence
    - read:space:confluence
  external:
    fetch:
      backend:
        - api.github.com
        - api.bitbucket.org

```

Confirm every scope and module name against:

* https://developer.atlassian.com/platform/forge/manifest-reference/
* https://developer.atlassian.com/platform/forge/manifest-reference/modules/
If a scope name has changed (Atlassian periodically renames), use the current one and log the change in `DECISIONS.md`.
5. Storage schema (Forge Storage)
Forge Storage is key-value with optional custom entities for structured query. v0.1 uses the simple `@forge/api storage` interface.
Storage keys (all under app scope unless noted):

```
config:default                          # AppConfig
rules:catalog                           # RuleCatalog (full rules.json contents)
rules:overrides:<projectId>             # Per-project rule overrides
modules:catalog                         # BoxLangModuleCatalog
docs:index                              # OrtusDocsIndex
heuristics:estimation                   # EstimationHeuristics
scans:<projectId>:list                  # array of ScanSummary
scans:<projectId>:<scanId>:meta         # ScanMeta
scans:<projectId>:<scanId>:source       # ScanSource (zip ref, repo ref)
scans:<projectId>:<scanId>:candidates   # CandidateMatch[]
scans:<projectId>:<scanId>:workitems    # WorkItem[]
scans:<projectId>:<scanId>:plan         # MigrationPlan
scans:<projectId>:<scanId>:progress     # ScanProgress

```

Each TypeScript type is defined in `src/types/` and exported. Schemas in §6 and §14 are the canonical shapes.
For large blobs (uploaded zip contents pre-extraction), use Forge custom entities or store an external blob URL. Forge Storage has size limits per value (currently 240 KB for simple keys, larger for custom entities). Verify current limits at https://developer.atlassian.com/platform/forge/runtime-reference/storage-api/ before writing the zip upload flow.
6. Reference data files
The rule catalog and module catalog are the product's spine. Build them in Phase 1 before any UI. Source data lives in `src/data/` and is loaded into Forge Storage on first run by an install handler.
6.1 `src/data/rules.json`
Schema (every field required for every rule):

```json
{
  "schemaVersion": "1.0",
  "rules": [
    {
      "id": "CFML-SEC-001",
      "title": "Unparameterized cfquery with dynamic value",
      "category": "security",
      "subcategory": "sql-injection",
      "severity": "critical",
      "appliesTo": ["cfm", "cfc", "cfml"],
      "detect": {
        "strategy": "regex-then-validate",
        "preFilterPattern": "<cfquery[^>]*>[\\s\\S]*?</cfquery>",
        "antiPattern": "#[a-zA-Z_][a-zA-Z0-9_.]*#",
        "exclusion": "<cfqueryparam"
      },
      "rationale": "A cfquery body that interpolates a variable directly into SQL without cfqueryparam is vulnerable to SQL injection. BoxLang's bx-jdbc module enforces parameterized queries by default, but the legacy code must be fixed before migration regardless.",
      "recommendation": "Wrap every dynamic value in <cfqueryparam value=\"#var#\" cfsqltype=\"...\"> or convert the call to BoxLang's queryExecute() with the params array. In a ColdBox 8 application, prefer Quick ORM (bx-quick) which parameterizes by default.",
      "references": [
        { "key": "boxlang.queryexecute" },
        { "key": "forgebox.bx-quick" }
      ],
      "ortusModules": ["bx-jdbc", "bx-quick"],
      "estimatedEffortHours": { "low": 0.5, "expected": 1, "high": 2 },
      "fixComplexity": "low",
      "blocksMigration": true,
      "confidence": "high",
      "jiraIssueType": "Bug"
    }
  ]
}

```

Note the new field `jiraIssueType` (Bug for security, Story for everything else by default). The Jira issue creator uses this when bulk-creating.
Full v0.1 rule list (write each rule fully, all fields populated):
Security (critical or high, `blocksMigration: true`, `jiraIssueType: "Bug"`)

* `CFML-SEC-001` Unparameterized cfquery
* `CFML-SEC-002` evaluate() or de() usage
* `CFML-SEC-003` cfinclude with non-literal template
* `CFML-SEC-004` cffile upload without accept attribute
* `CFML-SEC-005` Hard-coded credentials
* `CFML-SEC-006` cfheader with user-controlled value
* `CFML-SEC-007` Unscoped variable writes in Application.cfc
Legacy UI (high, `jiraIssueType: "Story"`)

* `CFML-UI-001` cfgrid
* `CFML-UI-002` cflayout
* `CFML-UI-003` cfwindow
* `CFML-UI-004` cfajaxproxy
* `CFML-UI-005` cftree / cfmenu
* `CFML-UI-006` cfform format flash or xml
* `CFML-UI-007` cfinput type datefield and rich types
Deprecated (medium)

* `CFML-DEP-001` cfwddx
* `CFML-DEP-002` cfreport
* `CFML-DEP-003` cfregistry
* `CFML-DEP-004` cfcollection / cfsearch / cfindex
* `CFML-DEP-005` iif()
Compat Adobe (high, blocking)

* `CFML-COMPAT-ADOBE-001` cfdocument Adobe-specific attrs
* `CFML-COMPAT-ADOBE-002` cfpdf actions not in bx-pdf
* `CFML-COMPAT-ADOBE-003` cfpresentation*
* `CFML-COMPAT-ADOBE-004` cfexchange*
* `CFML-COMPAT-ADOBE-005` cfspreadsheet Adobe-only options
Compat Lucee (medium)

* `CFML-COMPAT-LUCEE-001` Lucee-only cfdump attrs
* `CFML-COMPAT-LUCEE-002` Component metadata differences
* `CFML-COMPAT-LUCEE-003` Lucee-only built-in functions
Architecture (medium)

* `CFML-ARCH-001` CFC over 800 LOC
* `CFML-ARCH-002` Mixed presentation and business logic
* `CFML-ARCH-003` Custom tag that should be a ColdBox module
* `CFML-ARCH-004` Direct request scope cross-request state
Modernization opportunity (low)

* `CFML-MOD-001` Manual SQL eligible for Quick ORM
* `CFML-MOD-002` Synchronous loop eligible for virtual threads
* `CFML-MOD-003` Search eligible for bx-meilisearch
* `CFML-MOD-004` Long-polling eligible for SocketBox
* `CFML-MOD-005` Manual JSON eligible for BoxLang AI structured outputs
AI-readiness (informational)

* `CFML-AI-001` Service-shaped CFC for CB-MCP exposure
* `CFML-AI-002` Data model for RAG indexing
* `CFML-AI-003` Workflow for BoxLang AI agent tooling
Tests (low)

* `CFML-TEST-001` Public CFC method without TestBox spec
* `CFML-TEST-002` Logic in .cfm files
Config (low)

* `CFML-CFG-001` Application.cfc settings needing translation
* `CFML-CFG-002` Hard-coded environment values
Verify every Ortus module slug against the live ForgeBox catalog before commit.
6.2 `src/data/boxlang-modules.json`

```json
{
  "modules": [
    {
      "slug": "bx-quick",
      "name": "Quick ORM",
      "category": "data",
      "purpose": "Modern fluent ORM for BoxLang",
      "replaces": ["manual cfquery", "Hibernate ORM"],
      "boxlangMinVersion": "1.10",
      "docsUrl": "...",
      "forgeboxUrl": "..."
    }
  ]
}

```

Cover at minimum: bx-jdbc, bx-quick, bx-pdf, bx-chart, bx-meilisearch, bx-cbwire, bx-mail, bx-ai, bx-csv, bx-markdown, bx-redis, bx-orm-compat, bx-compat.
6.3 `src/data/coldbox8-patterns.json`
Modern ColdBox 8 patterns: AI routing, virtual thread executors, CB-MCP, CBWire reactive components, Quick ORM, Hyper HTTP client, async tasks. Each: name, when to apply, code-shape signature, doc URL.
6.4 `src/data/ortus-docs-index.json`
Flat key-to-URL lookup. Rules reference by `key`. One file to fix when an Ortus URL changes.
6.5 `src/data/estimation-heuristics.json`

```json
{
  "baseHoursPerOccurrence": {
    "security": 2, "legacy-ui": 4, "deprecated": 1,
    "compat-adobe": 2, "compat-lucee": 1, "architecture": 8,
    "modernization": 3, "ai-readiness": 4, "tests": 1, "config": 0.5
  },
  "maxRollupPerFile": {
    "security": 16, "legacy-ui": 24, "deprecated": 8,
    "compat-adobe": 12, "compat-lucee": 8, "architecture": 32,
    "modernization": 16, "ai-readiness": 16, "tests": 8, "config": 4
  },
  "multipliers": {
    "fileSizeOver500Loc": 1.25,
    "fileSizeOver1500Loc": 1.5,
    "fileTouchedBy5PlusRules": 1.2,
    "fileHasTests": 0.8,
    "fileInLegacyPath": 1.3
  },
  "capacity": {
    "productiveHoursPerDevPerWeek": 25
  }
}

```

7. UI surfaces
All UI built with `@forge/react` (UI Kit). Three resource entry points: `main` (project page), `admin`, `confluence-space`. Each is a small React app under `static/<resource>/src/`.
7.1 Jira project page (`static/main/`)
The main surface. Tabs at the top.
Tab: Dashboard

* Empty state: explanation, "Start a scan" button.
* After first scan: summary cards (total work items, total estimated hours, items by category bar, blocksMigration count).
* Recent scans table with status badges.
Tab: New Scan

* Code source selector (radio): Zip upload, GitHub repo, Bitbucket repo.
* Form fields per source type.
* Optional scan settings (advanced collapse): which categories to include, depth, ignore patterns.
* "Start scan" button. Triggers `startScan` resolver.
Tab: Work Items

* Filter bar: category checkboxes, severity checkboxes, search.
* DynamicTable: id, title, category, severity, file, effort (story points), Jira issue link if created.
* Row-click opens a detail drawer with full rationale, recommendation, references, and "Create as Jira issue" button.
* Bulk action: "Create issues for all filtered" with a confirmation modal that previews the epic and story structure that will be created.
Tab: Plan

* Phased plan view: four phase columns (Stabilize, Compatibility, Modernize, Elevate).
* Per phase: work item count, total hours, sprint recommendations (with team-size and sprint-length inputs).
* "Publish to Confluence" button.
Tab: Settings (project-scoped)

* Override rule enabled/disabled state for this project.
* Configure code source defaults.
7.2 Jira admin page (`static/admin/`)
Site-level settings. Visible to Jira site admins only.

* App version, runtime, build SHA.
* Default rule catalog version (read-only display, with a "view rule catalog" link that opens a modal with the full catalog).
* Default code source credentials (encrypted in storage, never displayed back).
* Telemetry opt-in toggle (off by default; if on, anonymized scan counts go to the publisher).
* License info (deferred to operator's pricing decision in §19).
7.3 Confluence space page (`static/confluence-space/`)
Read-only viewer for a published migration plan. Opens by scan ID via URL param.

* Header: project name, scan date, summary stats.
* Executive summary (rendered from plan markdown).
* Phasing table.
* Per-phase work item list with links back to Jira issues if created.
* Print-friendly styling (no app chrome on print).
7.4 Shared UI components (`static/_shared/src/`)
Extracted components reused across surfaces:

* `WorkItemTable`
* `WorkItemDetailDrawer`
* `PhaseColumn`
* `ScanStatusBadge`
* `CategoryChip`
Each component is a TypeScript file with explicit prop types.
8. Resolvers (backend functions)
All backend logic lives in `src/resolvers/` and `src/workers/`. TypeScript only. One file per resolver group.
8.1 `src/resolvers/project.ts`
UI Kit resolver for the Jira project page. Methods:

* `getProjectState({ projectId })` returns `{ recentScans, currentScan?, projectConfig }`.
* `startScan({ projectId, source, options })` validates, persists scan record, enqueues async event, returns `scanId`.
* `getScanProgress({ projectId, scanId })` returns `{ status, percentComplete, currentStep, eta }`.
* `getWorkItems({ projectId, scanId, filters })` returns paginated work items.
* `getWorkItemDetail({ projectId, scanId, workItemId })` returns full detail with references resolved.
* `createJiraIssues({ projectId, scanId, workItemIds, parentEpicKey? })` calls Jira REST API to create issues, returns created issue keys.
* `getPlan({ projectId, scanId, options })` returns the generated migration plan.
* `publishToConfluence({ projectId, scanId, spaceKey, parentPageId? })` calls Confluence REST API to create or update the plan page.
Every method has explicit input and output TypeScript types. Inputs validated with a small runtime schema check before touching storage.
8.2 `src/resolvers/admin.ts`

* `getSiteConfig()` returns site-level config.
* `updateSiteConfig({ patch })` writes config (admin-only, scope check enforced).
* `getRuleCatalog()` returns the full catalog (read-only at this surface).
* `getAppHealth()` returns runtime, version, storage usage, last scan timestamp.
8.3 `src/resolvers/confluence.ts`

* `getPlanForView({ scanRef })` returns the plan for read-only Confluence display.
8.4 Common middleware
`src/lib/withAuth.ts`: every resolver method wrapped in an auth check using `useProductContext` data (Jira project permissions for project resolver, admin permission for admin resolver). Unauthorized calls return a structured error, never throw raw.
`src/lib/withLogging.ts`: structured log lines with `scanId`, `projectId`, `methodName`, `durationMs`. Forge `console.log` is captured in Forge's developer console.
9. Async scan worker
`src/workers/scan.ts` is the consumer handler for the `scan-jobs` queue.
9.1 Lifecycle

1. UI calls `startScan` resolver.
2. Resolver writes `scans:<projectId>:<scanId>:meta` with `status: queued`.
3. Resolver enqueues an async event with payload `{ projectId, scanId, chunk: 0 }`.
4. Consumer receives event. Loads scan meta. Sets `status: running`.
5. Consumer fetches the chunk of files (chunked by file count to fit within 15-minute invocation).
6. For each file: run the rule catalog's pre-filters, capture matches, write to `scans:<projectId>:<scanId>:candidates` (appended).
7. If more chunks remain, consumer enqueues the next chunk event and returns.
8. If all chunks processed, consumer runs the synthesizer (dedup, rollup, effort estimation), writes `scans:<projectId>:<scanId>:workitems`, sets `status: complete`.
9. Throughout, the consumer updates `scans:<projectId>:<scanId>:progress` so the UI poller can render progress.
9.2 Chunking strategy
Default chunk size: 200 files. If average per-file processing time exceeds 100ms during the scan, drop chunk size adaptively. Track per-chunk timings in the progress record so subsequent chunks can adjust.
Worst-case codebase target for v0.1: 5,000 files. That's 25 chunks. Even at the higher end of per-file processing time, this completes in well under an hour of total wall clock.
For codebases over 5,000 files: the UI shows a warning and offers two options. Continue (risky, may degrade) or split the scan (manual ignore patterns to scope the first run). Document in `docs/large-codebases.md`.
9.3 Rule engine
`src/engine/RuleEngine.ts` loads `rules.json` from storage on first call, caches in memory for the invocation lifetime.
For each file:

1. Get list of rules whose `appliesTo` includes the file extension.
2. For each candidate rule, apply `detect.preFilterPattern` to the file content.
3. For each pre-filter match, check `detect.antiPattern` and `detect.exclusion`. If a positive match remains, record a `CandidateMatch`.
4. Capture line number, 3-line context window, occurrence count.
Pure regex. No AST parser in v0.1. False positives are accepted and surfaced via the work item `confidence` field (default `medium` for regex-only detection, `high` only for rules where the regex has been verified against the realistic fixture).
9.4 Work item synthesis
`src/engine/Synthesizer.ts`:

1. Group candidates by `(ruleId, file)`.
2. For each group, produce one work item with `occurrences: <count>` rather than N separate items.
3. Resolve cross-rule dependencies (`blocks`, `blockedBy`) using a small static graph in `src/data/rule-dependencies.json`.
4. Apply effort estimation per §15.
5. Apply phasing per §15.
6. Assign sequential IDs `WI-0001`, `WI-0002`, etc.
9.5 Recommendation rendering
Each rule has a `recommendation` template string. At synthesis time, render the template with context (file path, occurrence count, related work items). For v0.1, templating is simple string substitution (no LLM call).
v0.2 plan: optional LLM enrichment via Atlassian Rovo or external LLM call (with operator-provided API key). Document in `docs/llm-enrichment-design.md`.
10. Code source integrations
10.1 Zip upload
UI: file input accepting `.zip`. Max size (v0.1): 25 MB extracted, 10 MB compressed. Show clear errors above limits.
Backend: zip is uploaded via Forge's storage entity for binary blobs (verify current pattern at https://developer.atlassian.com/platform/forge/runtime-reference/storage-api/). The async worker unpacks files one at a time, applies rules, discards file content after processing. Never persists code content past one invocation.
10.2 GitHub repo
UI: repo URL field, Personal Access Token field (token stored encrypted in Forge Storage, scoped to this project).
Backend: uses GitHub REST API to list files (recursive tree) and fetch contents. Honors `.cartographerignore` if present at repo root.
Outbound domain `api.github.com` must be declared in `permissions.external.fetch.backend`.
10.3 Bitbucket repo
UI: workspace and repo selector. OAuth via Forge `providers` block (preferred) or PAT (fallback).
For OAuth, declare a Bitbucket provider per https://developer.atlassian.com/platform/forge/manifest-reference/providers/. Verify the current syntax live.
Backend: Bitbucket REST API for repo file listing.
10.4 Source abstraction
`src/sources/SourceAdapter.ts` interface:

```typescript
interface SourceAdapter {
  listFiles(opts: { ignorePatterns: string[] }): AsyncIterable<FileRef>;
  readFile(ref: FileRef): Promise<string>;
  getMetadata(): SourceMetadata;
}

```

Three implementations: `ZipSource`, `GitHubSource`, `BitbucketSource`. The worker only depends on the interface.
11. Jira integration (auto-create issues)
`src/jira/IssueCreator.ts`.
11.1 Hierarchy
Default hierarchy when bulk-creating from a scan:

* One Epic per migration Phase (Stabilize, Compatibility, Modernize, Elevate). Epic summary "BoxLang Migration: Phase N — <PhaseName>." Epic description holds the phase summary.
* One Story per work item where `category` is in `architecture`, `modernization`, `ai-readiness`, `tests`, `config`, `legacy-ui`, `deprecated`, or `compat-*`.
* One Bug per work item where `category` is `security`.
* For work items with `occurrences > 1` per file: one parent issue, plus optional Subtasks if user enables that toggle in the create-issues modal (off by default to avoid spam).
11.2 Field mapping
For each work item, the created issue's:

* `summary` = work item `title`.
* `description` (Atlassian Document Format): structured. Sections: Rationale, Recommendation, Code location (file + line range + snippet block), References (links from `ortus-docs-index.json`), Effort details.
* `priority` = mapped from work item `priority` (P0 → Highest, P1 → High, P2 → Medium, P3 → Low). Verify Jira priority field exists in the target project; if not, skip the field with a warning.
* `labels` = work item `tags` plus `cartographer`, `boxlang-migration`, and the work item `category`.
* `customfield_storyPoints` if the project has a story points field (auto-detected); value from work item `effort.storyPoints`.
* `issuetype` = work item `ruleId` lookup in `rules.json` `jiraIssueType` field.
* `parent` = the relevant phase Epic.
11.3 Rate limiting and idempotency
Jira REST API has rate limits. Batch issue creation in chunks of 10 with a 200ms delay between batches.
Idempotency: each created issue stores a remote link back to the work item with a stable URL pattern `cartographer:work-item:<scanId>:<workItemId>`. Before creating, check if an issue with that remote link already exists; if so, skip and report.
11.4 Failure handling
If an issue creation fails midway through a batch, the creator returns the list of successes and failures. UI shows both. Failed items can be retried individually.
12. Confluence integration (plan and report pages)
`src/confluence/PagePublisher.ts`.
12.1 Page structure
When the user clicks "Publish to Confluence," the publisher creates a parent page and three child pages:

* Parent page: "BoxLang Migration Plan: <Project Name> (scanned YYYY-MM-DD)"
   * Executive summary (3 to 5 sentences)
   * Phasing roadmap (table)
   * Stats panel (total work items, total hours, blocksMigration count)
   * Links to the four child pages
* Child page: Phase 1 — Stabilize, listing all Phase 1 work items with full details (collapsible per-item)
* Child page: Phase 2 — Compatibility
* Child page: Phase 3 — Modernize
* Child page: Phase 4 — Elevate
12.2 Rendering
Use Atlassian Document Format (ADF). Build ADF nodes via `@atlaskit/adf-utils` or hand-rolled (verify which is appropriate for Forge backend usage).
Tables with proper column widths. Code blocks with `cfml` language hint (Confluence supports a curated list of languages; if `cfml` is not recognized, fall back to `plaintext` and document in DECISIONS).
12.3 Re-publish behavior
If a page with the same title exists in the space, update it (new version). Don't create duplicates. Surface the existing version count in the success message.
13. Detection methodology end to end

1. Trigger: user clicks "Start scan" in the New Scan tab.
2. Pre-flight: resolver validates source config, writes scan meta, enqueues async event.
3. Worker invocation 1: consumer loads rules and modules catalog from storage into memory, opens the source adapter, iterates chunk 0 (files 0 to 199), applies rules, writes candidates. Updates progress. Enqueues next chunk event.
4. Worker invocations 2 through N: continue until all files processed.
5. Synthesis invocation (final chunk + 1): worker runs synthesizer, applies effort estimation, writes work items, sets status to `complete`.
6. UI: poller picks up `complete`, renders work items table.
7. Action: user clicks "Create Jira issues" or "Publish to Confluence."
False positive control: pre-filter regex favors recall. `confidence` field defaults to `medium` for regex-only matches; rules where the regex has been verified against the realistic fixture get `confidence: high`. The work items table has a default filter "confidence: high or medium" with a checkbox to show low-confidence matches.
14. Work item schema
Canonical contract. All consumers (Jira creator, Confluence publisher, exporters) render from this.

```json
{
  "id": "WI-0007",
  "title": "Replace cfgrid usage in views/admin/users.cfm",
  "category": "legacy-ui",
  "subcategory": "deprecated-tag",
  "severity": "high",
  "priority": "P2",
  "ruleId": "CFML-UI-001",
  "confidence": "high",
  "jiraIssueType": "Story",
  "effort": {
    "tshirt": "M",
    "storyPoints": 5,
    "estimatedHours": { "low": 4, "expected": 8, "high": 16 },
    "notes": "Base 4h x 2 occurrences, file in legacy path (multiplier 1.3)"
  },
  "location": {
    "file": "views/admin/users.cfm",
    "startLine": 42,
    "endLine": 67,
    "snippet": "<cfgrid name=\"users\" ...>"
  },
  "occurrences": 2,
  "rationale": "cfgrid is an Adobe ColdFusion AJAX UI tag deprecated in CF2018 and unsupported in BoxLang's open-source core. It relies on bundled Ext JS that is not part of BoxLang's runtime.",
  "recommendation": "Replace with a CBWire reactive grid component or an HTMX-driven table backed by a BoxLang controller action. For the lift-and-shift path, bx-cbwire provides a grid component compatible with BoxLang 1.13+.",
  "references": [
    { "key": "boxlang.compat.cfml", "title": "BoxLang CFML Compatibility" },
    { "key": "forgebox.bx-cbwire", "title": "bx-cbwire on ForgeBox" }
  ],
  "ortusModules": ["bx-cbwire"],
  "blocksMigration": false,
  "blocks": ["WI-0023"],
  "blockedBy": [],
  "phase": 2,
  "tags": ["ui", "frontend", "deprecated"],
  "jiraIssueKey": null,
  "confluencePageId": null,
  "detectedAt": "2026-05-17T10:14:00Z"
}

```

`jiraIssueKey` and `confluencePageId` start null. They populate when a user creates the issue or publishes the page, providing a back-link from work item to created content.
15. Estimation and phasing
Effort formula

```
expectedHours = baseHoursPerOccurrence[category] * occurrences
expectedHours = min(expectedHours, maxRollupPerFile[category])
expectedHours *= compounding multipliers
low = expectedHours * 0.5
high = expectedHours * 2

```

T-shirt: XS (≤2h), S (≤8h), M (≤16h), L (≤32h), XL (>32h). Story points (Fibonacci): 1h→1, 2h→2, 4h→3, 8h→5, 16h→8, 32h→13, 40h+→21.
Every multiplier applied appears in `effort.notes`.
Phasing (risk-first default)

* Phase 1, Stabilize: all `security`; all `compat-adobe`/`compat-lucee` with `blocksMigration: true`.
* Phase 2, Compatibility: remaining `deprecated`, `legacy-ui`.
* Phase 3, Modernize: `architecture`, `modernization`, `tests`.
* Phase 4, Elevate: `ai-readiness` and forward-looking.
Sprint capacity: `team-size * productiveHoursPerDevPerWeek * sprint-length-weeks`.
`value-first` and `dependency-first` strategies declared in UI but disabled in v0.1 (show "Coming in v0.2" tooltip).
16. Output formats
Cartographer produces output in three places:

1. In-app, Jira project page: work items table, plan view, scan summary.
2. In Atlassian: created Jira issues, published Confluence pages.
3. External export: downloaded files (JSON, markdown, CSV, GitHub-issues-script).
16.1 In-app rendering
Native ADS components via UI Kit. DynamicTable for work items. PhaseColumn custom component for plan view.
16.2 Jira issues
Hierarchy and field mapping per §11.
16.3 Confluence pages
Structure per §12.
16.4 Export downloads
Implemented via a small `Download` resolver method that streams a generated file as a blob the UI Kit Button triggers as a download (verify the current pattern at https://developer.atlassian.com/platform/forge/runtime-reference/).
Formats: JSON (canonical), Markdown (report), CSV (Jira-import-compatible for users who want to import into another instance), GitHub issues bash script (idempotent `gh issue create` wrapper).
17. Visual and copy standards
17.1 Tone

* Direct, plain English. "Cartographer scans CFML codebases and produces migration work items." Not "Cartographer empowers teams to streamline their modernization journey."
* Banned softeners: seamlessly, leverage, empower, unlock, elevate, robust, journey, solution (as marketing noun), transform (as marketing verb).
* No em dashes. Commas, parens, new sentences.
* No emojis in app UI, in Jira issue descriptions, in Confluence pages, in marketplace listing body. Marketplace listing title and one tagline line may use a single emoji if it earns its place. Default zero.
* Sentence case headings.
17.2 UI Kit usage
Follow Atlassian Design System defaults. Do not override Atlassian colors, spacing, or typography. The app should feel like part of Jira and Confluence, not a custom skin.
Component choices for common patterns:

* Tables: `DynamicTable` with sortable columns.
* Forms: ADS `Form`, `TextField`, `Select`, `Toggle`.
* Buttons: `Button` (primary), `Button` (subtle for secondary actions). One primary per view.
* Loading: `Spinner`. Skeleton states for tables while scan is in progress.
* Empty states: `EmptyState` component with one clear next action.
* Errors: `SectionMessage` (warning or error variant).
No custom CSS in resolvers. No inline styles beyond what ADS components accept.
17.3 Atlassian Document Format conventions for issues and pages

* Code blocks use `cfml` language hint when available, `plaintext` otherwise.
* Tables for structured data (work item fields), not bullet lists.
* Links use `inlineCard` for URLs that Atlassian can preview, regular `link` for others.
* Reference lists: bullet list with linked titles.
18. Marketplace listing
`marketplace/listing.md` contains all draft copy. Real listing fields are submitted through the Atlassian Marketplace partner portal at https://marketplace.atlassian.com/manage.
18.1 Listing fields

* App name: Cartographer
* Tagline (one line, ~80 chars): "Scan ColdFusion code. Get a BoxLang migration backlog in Jira and Confluence."
* Summary (~150 words): plain-English description of what the app does, who it's for, and what they get out of it. No marketing language. Lead with the user's problem.
* Description (~500 to 800 words): longer-form. Three sections: What it does, How it works, What's in v0.1. End with a sentence about roadmap.
* Categories: select from Atlassian's category taxonomy (likely Developer Tools, Code Review, IT Asset Management; verify current options).
* Compatibility: Jira Cloud, Confluence Cloud.
* Pricing: see §19.
18.2 Screenshots brief
Capture six screenshots after Phase 9 against the realistic fixture:

1. Project page Dashboard tab showing summary cards after a fresh scan.
2. New Scan tab with GitHub repo selected, scan options expanded.
3. Work Items tab with the table filtered to security category, a row drawer open.
4. Plan tab showing phased columns.
5. A created Jira issue with the structured description rendered.
6. The published Confluence parent page.
Each screenshot: 1280 x 800 minimum, taken in a Jira sandbox site with a believable project name and dummy data. No real customer data.
18.3 App icon
512 x 512 SVG. Distinctive, restrained. Not a generic compass or map icon (every dev tool reaches for those). Suggest a stylized trail or path shape rendered in a duotone. Operator approves the icon before marketplace submission.
19. Pricing decision (deferred to operator)
The build does not enforce a pricing model. Three paths the operator can choose at marketplace submission:

1. Free. Fastest to install, broadest distribution, no revenue. Best for awareness and lead generation.
2. Freemium. Free tier with scan limits (e.g., 1,000 files per scan, 5 scans per month). Paid tier unlocks unlimited + GitHub/Bitbucket integrations + LLM-enriched recommendations (v0.2). Standard Atlassian per-user-per-month pricing.
3. Paid only. Per-user-per-month. Best when the publisher has a clear ICP and a sales motion.
The build leaves the door open by:

* Tracking scan file counts and storing them in Forge Storage (for future enforcement).
* Putting GitHub and Bitbucket integrations behind a feature flag in `src/lib/features.ts` (currently always-on, but trivially gateable).
* Keeping the rule catalog versioned so a "paid tier with weekly rule updates" model is feasible.
If the operator chooses freemium or paid: enforcement logic ships in v0.2. The v0.1 build assumes free.
20. Build phases with exit gates
Gate every phase. Three-paragraph status update at each: shipped / tested / deferred.
Phase 0 — Workspace, manifest, scaffold

* `forge create` a new app, confirm template choice (UI Kit custom).
* Configure runtime `nodejs22.x`, architecture `arm64`.
* Write the full manifest per §4.
* Set up TypeScript build pipeline for all three static resources.
* LICENSE (Apache-2.0), README skeleton, `DECISIONS.md` first entry.
* Gate: `forge deploy` succeeds to development environment. App installs on operator's sandbox site. Empty project page renders.
Phase 1 — Reference data

* Build all five data files in `src/data/`.
* Verify every Ortus module slug against live ForgeBox.
* Write install hook that loads data files into Forge Storage on first deploy.
* Gate: every rule complete. Admin page renders the rule catalog. Storage initialized correctly on fresh install.
Phase 2 — Rule engine and synthesizer

* Implement `RuleEngine` and `Synthesizer` in `src/engine/`.
* Unit tests for each (Jest or Vitest, whichever Forge templates use; verify).
* Fixtures: `tests/fixtures/good/`, `tests/fixtures/bad/`.
* Gate: unit tests pass. Running the engine against the bad fixture produces at least one candidate per rule. No false positives on the good fixture.
Phase 3 — Source adapters

* Implement `ZipSource`, `GitHubSource`, `BitbucketSource`.
* Wire GitHub and Bitbucket auth flows.
* Unit tests for each adapter against mocked source data.
* Gate: each adapter can list and read files for a fixture repo.
Phase 4 — Async scan worker

* Implement `src/workers/scan.ts` with chunking.
* Wire consumer module and queue.
* End-to-end test: enqueue a scan, observe progress updates, get final work items in storage.
* Gate: scan against the bad fixture completes successfully, work items in storage are well-formed.
Phase 5 — Project page UI

* Build all five tabs (Dashboard, New Scan, Work Items, Plan, Settings).
* Wire resolvers.
* Add loading, error, and empty states.
* Gate: operator can install, start a scan, see progress, view work items in the table, open detail drawer.
Phase 6 — Plan and phasing

* Build `Plan` resolver method and PhaseColumn UI.
* Implement migration architect synthesis.
* Gate: plan view shows four phases with correct work item assignment and sensible sprint suggestions.
Phase 7 — Jira issue creation

* Build `IssueCreator` with hierarchy, batching, idempotency.
* UI: create-issues modal with preview, bulk action button.
* Gate: clicking "Create Jira issues" on a scan creates the correct epic / story / subtask hierarchy. Re-running is idempotent.
Phase 8 — Confluence publishing

* Build `PagePublisher` with ADF rendering.
* UI: "Publish to Confluence" with space selector.
* Build Confluence space page viewer.
* Gate: clicking "Publish to Confluence" creates the parent and four child pages with proper content. Republish updates existing pages, doesn't duplicate.
Phase 9 — Admin page and settings

* Build the admin page UI.
* Settings: rule overrides, default code source, telemetry opt-in.
* Gate: admin page works, settings persist.
Phase 10 — Exports and polish

* Implement JSON, markdown, CSV, GitHub script exports.
* Final README, full `docs/` folder, screenshots draft.
* Realistic fixture scan saved as a demo.
* Gate: all exports produce valid output. Realistic fixture renders a publishable plan page in Confluence.
Phase 11 — Marketplace prep and release commands

* Build `marketplace/listing.md` with all draft copy.
* Build `marketplace/screenshots-brief.md` (the shot list).
* Build `marketplace/submission-checklist.md`.
* Print exact `forge deploy --environment=production`, `forge install`, and marketplace submission steps the operator runs.
* Do NOT deploy to production, do NOT submit autonomously.
* Gate: final status with three honest weaknesses for v0.2.
21. Testing strategy
21.1 Unit tests
Framework: Vitest (verify against Forge templates; some templates ship with Jest).
Coverage targets:

* `RuleEngine`: every rule has a passing test against bad fixture and a passing non-match test against good fixture.
* `Synthesizer`: dedup, rollup, effort calculation, phase assignment.
* `IssueCreator`: hierarchy generation, field mapping (mock Jira API).
* `PagePublisher`: ADF generation snapshot tests.
21.2 Integration test
`tests/integration/full-scan.test.ts`:

1. Mock source adapter returning the realistic fixture files.
2. Run worker end to end (chunking included).
3. Assert work items are produced.
4. Run `IssueCreator` against mock Jira client; assert correct issue structure.
5. Run `PagePublisher` against mock Confluence client; assert correct ADF.
21.3 Manual testing matrix
Before marketplace submission, run through:

* Fresh install on a clean Jira sandbox.
* Scan via zip upload.
* Scan via GitHub repo.
* Scan via Bitbucket repo.
* Create Jira issues from a subset of work items.
* Re-run create-issues (verify idempotency).
* Publish to Confluence in a clean space.
* Re-publish to Confluence (verify update, not duplicate).
* Uninstall and reinstall (verify data cleanup behavior).
* Test on Jira Software, Jira Service Management, Jira Work Management projects (each has different default issue types).
Document each pass/fail in `tests/manual/test-log.md`.
21.4 Fixtures

* `tests/fixtures/good/`: clean CFML, zero work items expected.
* `tests/fixtures/bad/`: one instance of every rule.
* `tests/fixtures/realistic/`: 30 to 50 files, mixed quality, used for screenshots and the demo plan.
Each file header lists the rule IDs it triggers.
22. References Claude Code must consult live
Forge platform:

* https://developer.atlassian.com/platform/forge/
* https://developer.atlassian.com/platform/forge/manifest-reference/
* https://developer.atlassian.com/platform/forge/manifest-reference/modules/
* https://developer.atlassian.com/platform/forge/manifest-reference/permissions/
* https://developer.atlassian.com/platform/forge/runtime-reference/
* https://developer.atlassian.com/platform/forge/runtime-reference/storage-api/
* https://developer.atlassian.com/platform/forge/runtime-reference/async-events-api/
* https://developer.atlassian.com/platform/forge/manifest-reference/providers/
* https://developer.atlassian.com/platform/forge/ui-kit/components/
* https://developer.atlassian.com/platform/forge/build-a-custom-ui-app-in-jira/
* https://developer.atlassian.com/platform/forge/changelog/
Atlassian REST APIs:

* Jira Cloud REST: https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/
* Confluence Cloud REST: https://developer.atlassian.com/cloud/confluence/rest/v2/
* Atlassian Document Format: https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/
Marketplace:

* https://developer.atlassian.com/platform/marketplace/
* https://marketplace.atlassian.com/manage
BoxLang and Ortus ecosystem:

* https://boxlang.ortusbooks.com/
* https://modules.ortussolutions.com/
* https://forgebox.io/
* https://coldbox.ortusbooks.com/
* https://testbox.ortusbooks.com/
* https://www.ortussolutions.com/blog
23. Anti-patterns

1. No em dashes anywhere in user-facing text.
2. No generic recommendations. Name a specific Ortus module or BoxLang feature.
3. No invented Forge module names, scope names, BoxLang functions, or Ortus modules. Verify live or mark `STATUS: needs verification`.
4. No persisting customer code content past one async invocation.
5. No Forge scope creep. Add a scope only when a specific call needs it. Every scope shipped requires admin approval at install time.
6. No `any` types in TypeScript without a justifying comment.
7. No inline styles overriding Atlassian Design System defaults.
8. No production deploys autonomous. Operator runs `forge deploy --environment=production`.
9. No marketplace submit autonomous. Operator submits.
10. No real customer data in screenshots or fixtures.
11. No silent improvisation when the brief is wrong. Stop and ask.
12. No "Welcome to..." or "I'm excited to..." openings on any marketing copy.
13. Banned softeners across all copy: seamlessly, leverage, empower, unlock, elevate, robust, journey, transform (as marketing verb).
24. Definition of done
All true at end of Phase 11:

* `forge deploy --environment=development` succeeds.
* Install on a fresh Jira Cloud sandbox: project page renders.
* Scan against the realistic fixture completes end to end.
* Work items in the table look concrete and useful; every recommendation names a specific Ortus module or BoxLang feature.
* Create Jira issues from the scan: correct epic / story / bug hierarchy. Idempotent on re-run.
* Publish to Confluence: parent plus four child pages render cleanly with proper ADF.
* Admin page renders. Settings persist.
* Unit tests pass. Integration test passes. Manual test matrix log shows all passes.
* App icon designed and approved by operator.
* Marketplace listing draft (`marketplace/listing.md`) complete.
* Screenshots brief and submission checklist complete.
* README, DECISIONS, CHANGELOG, LICENSE all present.
* Final status message names:
   * What shipped.
   * Where artifacts live.
   * Exact commands to deploy to production and submit to marketplace.
   * Three honest weaknesses for v0.2: typical set is (a) no LLM enrichment of recommendations, (b) regex-only detection produces some false positives on architecture rules, (c) Data Center support not yet available.
Final note
This brief is opinionated. The opinions are intentional. If you disagree with one strongly enough that the product would be worse for following it, raise the disagreement before you start building. Once you start, follow the brief. Revisions land in v0.2.
Begin with Phase 0. Verify Forge manifest schema, current runtime requirements (Node.js version), and current UI Kit component names live before writing any manifest or component code.
