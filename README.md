# Cartographer for Atlassian

Scan ColdFusion code. Get a BoxLang migration backlog in Jira and Confluence.

Cartographer is an Atlassian Forge app for Jira and Confluence Cloud. Point it
at a ColdFusion or CFML codebase (zip upload, GitHub repo, or Bitbucket repo)
and within minutes it produces a prioritized backlog of BoxLang migration work
items with effort estimates, then turns that backlog into Jira epics, stories,
and bugs and a published Confluence migration plan.

Cartographer does not transform code. v0.1 is read-only against the source
tree, produces work items as data, and writes only into Atlassian.

## What it does

- Applies a catalog of 43 CFML to BoxLang rules across security, legacy UI,
  deprecated tags, Adobe and Lucee compatibility, architecture, modernization,
  AI readiness, tests, and configuration. Every recommendation names a
  specific Ortus module or BoxLang feature.
- Synthesizes deduplicated work items with t-shirt sizes, story points, an
  hours range, and a risk-first four phase plan (Stabilize, Compatibility,
  Modernize, then the forward-looking phase) with sprint suggestions.
- Creates a Jira epic per phase with stories and bugs underneath, idempotently.
- Publishes a Confluence parent page plus one child page per phase, updating in
  place on re-publish.
- Exports JSON, Markdown, a Jira-import CSV, and an idempotent GitHub CLI script.

## How it works

A scan registers a job and runs in a chunked async worker so large codebases
(up to 5,000 files) stay within Forge limits. The regex rule engine writes
candidates, the synthesizer rolls them into work items, and the project page
renders them with cursor pagination and a guided facet filter. See
[docs/architecture.md](docs/architecture.md).

## Build and verify (offline, no Atlassian account required)

```
npm ci
npm run verify        # tsc + unit/integration tests + manifest validation
```

Deployment requires an Atlassian developer account; the exact ordered
commands are in [RELEASE.md](RELEASE.md).

## Repository layout

| Path | Purpose |
| --- | --- |
| `src/catalog/` | Rule, module, ColdBox-pattern, docs-index, estimation catalogs |
| `src/domain/` | Rule engine, synthesizer, effort, phasing, plan, ids, chunking |
| `src/sources/` | Zip, GitHub, Bitbucket adapters and ignore handling |
| `src/lib/` | Storage ports, in-memory fakes, entity DAOs, ingest, Forge bindings |
| `src/workers/` | Async scan worker |
| `src/resolvers/` | UI Kit resolver cores (project, admin) |
| `src/jira/`, `src/confluence/` | Issue creation and page publishing |
| `src/frontend/` | UI Kit pages and pure view models |
| `test/` | Unit and integration tests, CFML fixtures |
| `marketplace/` | Listing draft, screenshots brief, submission checklist |
| `docs/` | Architecture, large codebases, v0.2 LLM enrichment design |
| `BUILD_BRIEF.md`, `DECISIONS.md` | Specification and decision log |

## Status

Version 0.1.0. Runtime `nodejs24.x`. Distribution: Atlassian Marketplace.
Roadmap items are tracked in `docs/llm-enrichment-design.md` and `CHANGELOG.md`.

Apache-2.0. See `LICENSE`.
