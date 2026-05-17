# Marketplace listing draft

Submit these fields through the Atlassian Marketplace partner portal at
https://marketplace.atlassian.com/manage. Copy follows the brief's tone rules:
plain English, no em dashes, no banned softeners, no emojis.

## App name

Cartographer

## Tagline (about 80 characters)

Scan ColdFusion code. Get a BoxLang migration backlog in Jira and Confluence.

## Summary (about 150 words)

Teams running aging Adobe ColdFusion or Lucee need a defensible inventory and
estimate before they can fund a BoxLang migration, and that funding decision
happens in Jira. Cartographer scans a CFML codebase from a zip upload, a GitHub
repo, or a Bitbucket repo and produces a prioritized backlog of migration work
items. Each item has a category, severity, an effort estimate in points and
hours, the exact file and line, and a recommendation that names the specific
Ortus module or BoxLang feature that resolves it. One click creates the Jira
epic, story, and bug hierarchy. One click publishes a phased migration plan to
Confluence. Cartographer is read-only against the source code and writes only
into Atlassian. It is built for the tech lead who has to make the migration
case, and for consultants running a fixed-bid CFML audit.

## Description (about 600 words)

### What it does

Cartographer turns a ColdFusion codebase into a structured BoxLang migration
backlog inside the tools your team already uses. It applies a catalog of 43
rules spanning SQL injection and other security defects, deprecated Adobe AJAX
UI tags, removed tags, Adobe and Lucee compatibility gaps, oversized and
tangled components, modernization opportunities, AI readiness, missing tests,
and environment-coupled configuration. Every rule explains why the pattern is a
problem on BoxLang and recommends a concrete fix that names a real Ortus module
or BoxLang feature, such as Quick ORM, CBWire, bx-compat-cfml, bx-pdf, or
SocketBox. There is no generic advice.

### How it works

Choose a code source: upload a zip, or connect a GitHub or Bitbucket
repository with a read-only token. Cartographer registers a scan and processes
the codebase in the background, so codebases up to 5,000 files stay within the
platform limits. When the scan finishes, the project page shows summary cards,
a filterable work item table, and a four phase plan: Stabilize, Compatibility,
Modernize, and the forward-looking phase. The plan is risk first, so security
and migration-blocking compatibility work is scheduled before everything else,
with sprint suggestions based on your team size and sprint length.

From there, one action creates the Jira hierarchy: an epic per phase, a story
for most work, a bug for security work, each with a structured description that
includes the rationale, the recommendation, the code location with a snippet,
linked references, and the effort detail. Creation is idempotent, so re-running
it does not duplicate issues. Another action publishes a Confluence migration
plan: a parent page with the executive summary, the phasing roadmap, and
statistics, plus one child page per phase with the detailed work items.
Re-publishing updates the existing pages instead of creating duplicates. You
can also export the backlog as JSON, Markdown, a Jira-import CSV, or an
idempotent GitHub CLI script.

### What is in v0.1

The full rule catalog, the chunked scan engine, zip, GitHub, and Bitbucket
sources, the project page with dashboard, scan, work items, plan, and settings
tabs, the Jira admin page with the read-only rule catalog and telemetry
control, the Confluence plan viewer, Jira issue creation, Confluence
publishing, and the four exports. Cartographer is read-only against your code
and never stores source content beyond a single processing step.

### Roadmap

A later release adds optional model-enriched recommendations for the harder
architecture and modernization items, scheduled re-scans, and Data Center
support. The rule catalog is versioned so it can be updated independently of
the app.

## Categories

Select from the current Marketplace taxonomy. Best fits: Developer tools, Code
review, IT asset management. Verify the available list in the partner portal at
submission time.

## Compatibility

Jira Cloud and Confluence Cloud.

## Pricing

Deferred to the operator (brief 19). The build assumes free for v0.1 and keeps
GitHub and Bitbucket behind a feature flag and scan counts in storage so a
freemium or paid model can ship in v0.2 without rework.
