# Decisions

A running log of build decisions and every place the implementation departs from
`BUILD_BRIEF.md`. Each correction was verified against live documentation before it was
applied. The brief pre-authorizes this (brief anti-patterns §23 #3, #11, #12, and §22
"verify against live docs"). Newest entries at the bottom of each section.

## 2026-05-17 — Platform pivot and fresh build

The working directory contained a prior, scaffold-only build of Cartographer as a Claude
Code plugin. The operator chose to remove it and build fresh as the Atlassian Forge app
described in the pasted brief, in a new `cartographer-forge/` subdirectory, with no
Atlassian account available (offline build and verification), running all 11 phases to
completion without gate pauses. The prior work's only durable asset was Ortus slug
verification, which was independently re-verified live (see below), so nothing was lost.

## 2026-05-17 — Forge platform corrections (verified against developer.atlassian.com)

1. **Runtime `nodejs24.x`.** Brief §4 specifies `nodejs22.x`. Node.js 22.x is deprecated
   on Forge as of 2026-05-06; `nodejs24.x` is current. `app.runtime` keys `memoryMB`
   (128–1024) and `architecture` (`arm64` | `x86_64`) are valid. Local Node is v24.

2. **Storage value limits force a redesign of brief §6.** Forge KVS values are capped at
   240 KiB per key. The brief's single-key arrays (`scans:<p>:<s>:candidates`,
   `…:workitems`) overflow for large scans (target 5,000 files). Replaced with the Custom
   Entity Store (≤20 entity types, ≤7 indexes/entity, 240 KiB/record, cursor-only
   pagination, ≤100 results/query). Entity types: `scan`, `candidate`, `workItem`,
   `exportArtifact`, `chunkState`, `blobPart`.

3. **Static catalog is bundled, not loaded into Storage on install.** Brief §6.5 has an
   install hook copy the reference JSON into Forge Storage. Instead the rule/module/docs/
   estimation catalogs ship as bundled typed TypeScript modules under `src/catalog/`
   (`export const RULES = [...] as const`). This version-locks the catalog to the engine,
   removes an install lifecycle hook, removes per-scan read latency, and sidesteps the
   240 KiB KVS limit entirely. Per-project rule *overrides* (small) still use KVS.

4. **Zip ingestion cannot pass through a resolver.** Forge resolver request payload is
   capped at 500 KB; brief §10.1 implies a 10 MB zip through the backend. The browser
   uploads directly to Forge Object Store via a presigned URL minted by an `@forge/os`
   function (`objectStore.upload(functionKey, [blob])` from `@forge/bridge`).

5. **Object Store is EAP, not GA.** The live doc
   (developer.atlassian.com/platform/forge/storage-reference/object-store/) states apps
   using Object Store cannot be deployed to production. Brief/initial research assumed GA.
   Mitigation: dual ingestion mode behind a `forge variables` flag `INGEST_MODE`.
   `objectstore` (development/staging) uses the presigned-URL flow; `chunked` (production
   and Marketplace until Object Store GA) has the browser slice the zip into ≤200 KiB
   base64 parts posted to a resolver (<500 KB/call) and stored as `blobPart` entities,
   reassembled by the consumer. Re-verify Object Store GA status at deploy time.

6. **Resolver response cap 5 MB.** Work-item reads are cursor-paginated (page size 50);
   exports are written to Object Store and the resolver returns only a presigned GET URL
   string. `chunked` fallback returns ≤4 MB cursor segments the browser concatenates.

7. **`write:project:jira` scope dropped.** Brief §4 lists it; the app creates issues, not
   projects. Removing it avoids scope creep (brief anti-pattern §23 #5). The exact
   granular-vs-classic scope set for `@forge/api` product calls is re-verified at build
   time against the live Jira/Confluence scope reference.

8. **`confluence:globalPage` omitted from v0.1.** Brief §3.3 lists it as optional for
   v0.1; its current module key was not confirmable, so it is deferred to v0.2.

9. **`consumer` module syntax verified at build time.** Sources disagreed on whether the
   `consumer` module takes `function:` or `resolver: { function, method }`. The manifest
   uses whichever form the current manifest reference specifies; recorded in §P2.

## 2026-05-17 — Ortus / BoxLang reference corrections (verified against forgebox.io)

The brief names modules that do not exist or were renamed. The rule and module catalogs
are the product's spine, so these are corrected in the catalog and re-verifiable.

| Brief reference | Status | Correct reference |
|---|---|---|
| `bx-jdbc` | does not exist | BoxLang core built-in JDBC and `queryExecute()` parameterization; per-database driver modules `bx-mysql`, `bx-postgresql`, `bx-mssql`, `bx-oracle`, `bx-mariadb`, `bx-sqlite` |
| `bx-quick` | wrong slug | `quick` (Quick ORM; runs on the BoxLang runtime) |
| `bx-chart` | wrong slug | `bx-charts` (plural) |
| `bx-cbwire` | wrong slug | `cbwire` |
| `bx-orm-compat` | does not exist | native `bx-orm`; ColdBox layer `cborm` |
| `bx-compat` | deprecated | `bx-compat-cfml` |
| `SocketBox` | casing | slug `socketbox` (lowercase) |
| `modules.ortussolutions.com` | host offline | canonical registry is `forgebox.io` |
| `bx-pdf`, `bx-meilisearch`, `bx-mail`, `bx-ai`, `bx-csv`, `bx-markdown`, `bx-redis` | confirmed correct | no change |

Versions confirmed current: BoxLang 1.13.0, ColdBox 8.1.0, TestBox 7.x, CommandBox 6.3.2,
`bx-compat-cfml` 1.32.1, `bx-ai` 3.2.0. Canonical CFML migration docs:
`https://boxlang.ortusbooks.com/getting-started/overview/running-coldfusion-cfml-apps`
(plus `migrating-from-lucee-cfml`, `boxlang-framework/modularity/compat-cfml`,
`getting-started/overview/syntax-style-guide/cfml`).

## 2026-05-17 — P2 manifest deviations

1. **Single-attribute partition and range keys.** The live custom-entity
   examples only demonstrate single-attribute partition and range keys. Rather
   than assume composite partitions work, the `workitem` entity carries derived
   string attributes `scanPhase` (`<scanId>#<phase>`), `scanCategory`, and
   `scanSeverity`, each backing a single-attribute partitioned index. This is
   verified-safe and still serves the guided-facet table UI (one primary facet
   routes to its index; secondary filters refine the page in memory).

2. **Bitbucket via PAT in v0.1, OAuth provider deferred.** Brief 10.3 prefers a
   Forge `providers` OAuth block for Bitbucket. A working OAuth provider needs a
   real registered Bitbucket client the operator must create, and a half
   configured `providers` block fails at deploy. v0.1 implements Bitbucket with
   a Personal Access Token (the brief's stated fallback), same as GitHub. The
   `providers.auth` block is documented in RELEASE.md as an operator add-on.
   `api.bitbucket.org` egress is declared now.

3. **Runtime memory 512 MB.** Brief 3.5 assumed a fixed 256 MB. `memoryMB` is
   configurable 128 to 1024 (verified). The scan consumer streams and
   regex-scans chunks, so 512 MB is set app-wide for headroom while staying
   cold-start friendly.

## 2026-05-17 — P5 storage layer

1. **Custom Entity + KVS API is `@forge/kvs`.** Verified live: the runtime API
   is `import kvs from "@forge/kvs"` (`kvs.set/get/delete`, `kvs.entity(name)`,
   `kvs.entity(name).query().index().partition().limit().cursor().getMany()`
   returning `{ results, nextCursor }`), not `@forge/api` `storage`. Added
   `@forge/kvs` to dependencies. Object Store EAP status reconfirmed from the
   live page ("apps using this feature can't be deployed to production").

2. **Storage behind ports.** `Kvs`, `EntityStore`, `ObjectStore` interfaces
   with in-memory fakes drive the whole pipeline offline; Forge bindings in
   `src/lib/forge.ts` are lazily imported and exercised only on deploy. `NEEDS
   VERIFICATION AT BUILD TIME`: exact `@forge/kvs` `WhereConditions` spelling
   (range conditions throw in the binding rather than silently no-op; the DAOs
   only query partition + cursor so this path is unused) and the
   `@forge/bridge` objectStore -> osPresign function payload.

3. **`candidateEntityId` includes the snippet.** Two distinct matches of the
   same rule on the same line span must be counted separately, while a
   redelivered identical match must collapse to one. Hashing the snippet into
   the key achieves both (fidelity plus at-least-once idempotency).

## 2026-05-17 — P8 brief self-contradiction: "Elevate"

The brief mandates the Phase 4 name **Elevate** (sections 12.1 and 15) and
also bans the word "elevate" as a softener (section 23 #13). Resolution: phase
names are fixed structured domain labels and are kept verbatim as the brief
mandates (the Confluence child page is "Phase 4 - Elevate"). The banned-softener
rule is enforced on prose: the executive summary avoids the word and does not
enumerate the four names. The catalog test enforces no banned softeners in rule
text (rules contain none).

## 2026-05-17 — Testing approach correction

Brief §21 / the plan referenced DOM testing-library coverage of UI. UI Kit `@forge/react`
components do not render to the DOM; they reconcile to a Forge element tree. UI components
are therefore kept thin and declarative, all logic lives in pure modules under
`src/domain/` and `src/lib/` that are unit-tested with Vitest (Node environment), and UI
is asserted with `react-test-renderer` element-tree snapshots. This is more honest than a
DOM library that cannot see UI Kit output.
