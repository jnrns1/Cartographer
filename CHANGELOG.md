# Changelog

All notable changes to Cartographer for Atlassian are recorded here. The
format follows Keep a Changelog, and this project uses semantic versioning.

## [0.1.0] - 2026-05-17

First Marketplace release candidate. Built and verified offline; deploy is the
operator's per `RELEASE.md`.

### Added

- 43-rule CFML to BoxLang catalog (security, legacy UI, deprecated, Adobe and
  Lucee compatibility, architecture, modernization, AI readiness, tests,
  config), each naming a specific Ortus module or BoxLang feature.
- Pure regex rule engine and synthesizer with deterministic, idempotent ids,
  effort estimation, and risk-first four phase planning.
- Zip, GitHub, and Bitbucket source adapters with `.cartographerignore`.
- Custom Entity Store data layer with cursor pagination, dual-mode zip
  ingestion (Object Store presign and chunked fallback), and a chunked,
  idempotent async scan worker.
- Jira project page (dashboard, scan, work items, plan, settings), Jira admin
  page, and Confluence plan viewer.
- Idempotent Jira epic/story/bug creation and Confluence parent plus four
  child page publishing with re-publish updates.
- JSON, Markdown, Jira-import CSV, and idempotent GitHub script exports,
  delivered as a presigned download, never through the resolver body.
- Offline build and verification (typecheck, 541 tests, manifest validation),
  decision log, docs, marketplace draft, and release cheatsheet.

### Known limitations (v0.2)

- No model enrichment of recommendations; v0.1 is deterministic templates.
- Regex-only detection produces some false positives on the architecture
  heuristics (surfaced through the confidence field).
- Object Store is EAP, so production uses the chunked ingest fallback until it
  reaches GA.
- No Data Center support.
