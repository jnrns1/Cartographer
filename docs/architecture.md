# Architecture

Cartographer is a Forge app (UI Kit, `nodejs24.x`) for Jira and Confluence
Cloud. The pipeline is deliberately split so the migration logic is pure and
fully testable offline, with Forge bindings only at the edges.

## Flow

1. The Jira project page (`src/frontend`) calls a resolver to register a scan.
   The browser uploads a zip to the Object Store via a presigned URL, or posts
   the zip in `<=200 KiB` base64 parts (chunked mode), or supplies a GitHub or
   Bitbucket repository and a token.
2. `startScan` writes a `scan` entity and enqueues one bootstrap async event.
3. The `scan-queue` consumer (`src/workers/scan.ts`) plans chunks, processes
   each chunk (regex rule engine, candidate upserts), re-enqueues
   linear-breadth, then synthesizes work items.
4. The project page polls progress, lists work items by guided facet (cursor
   paginated), builds a phased plan, creates Jira issues, publishes a
   Confluence plan, and exports JSON, Markdown, CSV, or a GitHub script.

## Layers

| Layer | Path | Forge-free | Tested with |
| --- | --- | --- | --- |
| Catalog | `src/catalog` | yes | unit |
| Domain (engine, synthesizer, plan, ids, chunking) | `src/domain` | yes | unit |
| Sources (zip, GitHub, Bitbucket) | `src/sources` | yes | mocked HTTP |
| Storage ports + DAOs + ingest | `src/lib` | yes | in-memory fakes |
| Worker | `src/workers` | yes | integration |
| Resolvers | `src/resolvers` | yes (core) | unit |
| Jira / Confluence | `src/jira`, `src/confluence` | yes | mock clients |
| Forge bindings | `src/lib/forge*.ts` | no | deploy only |
| UI | `src/frontend` | declarative | typecheck + presenter unit |

## Storage

Custom Entity Store (`scan`, `candidate`, `workitem`, `exportartifact`,
`chunkstate`, `blobpart`) with single-attribute partition and range indexes;
derived `scanPhase` / `scanCategory` / `scanSeverity` attributes back the
guided-facet table. Small singletons (config, project overrides, file pages,
source descriptors, plans) use KVS. Everything that crosses an at-least-once
boundary is keyed deterministically and upserted.

See `DECISIONS.md` for every place the implementation departs from the brief
and why, including the Object Store EAP constraint and the dual ingest mode.
