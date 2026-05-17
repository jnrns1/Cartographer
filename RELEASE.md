# Release

Exact ordered commands the operator runs. This build has no Atlassian account,
so nothing past step 0 has been executed here. Cartographer does not deploy to
production or submit to the Marketplace autonomously (brief 23 #8, #9).

## 0. Prerequisites (no account needed)

```
node -v            # 22 or 24 line
npm ci             # reproducible install from the committed lockfile
npm run verify     # tsc + tests + manifest validation, all green
```

## 1. CLI and authentication (first account-requiring step)

```
npm i -g @forge/cli
forge login        # email + API token from id.atlassian.com
# CI alternative: export FORGE_EMAIL and FORGE_API_TOKEN, skip forge login
```

## 2. Register the app id

```
forge register     # name: "Cartographer for Atlassian"
# This rewrites app.id in manifest.yml. Commit the change.
```

## 3. Pre-deploy sanity

```
npm run verify
forge lint         # now that credentials exist
```

## 4. Deploy and install (development)

```
forge deploy --environment=development
forge install --environment=development   # Jira site
forge install --environment=development   # repeat for a Confluence site
```

Object Store is EAP, so the objectstore ingest mode is development and staging
only. Run the manual test matrix in `marketplace/submission-checklist.md`.

## 5. Promote

```
forge deploy --environment=staging
forge install --upgrade --environment=staging
# Object Store cannot deploy to production. Use the chunked ingest fallback:
forge variables set --environment=production INGEST_MODE chunked
forge deploy --environment=production
forge install --upgrade --environment=production
```

## 6. Marketplace (production only)

Complete the listing in the partner portal at
https://marketplace.atlassian.com/manage using `marketplace/listing.md`,
`marketplace/screenshots-brief.md`, and `marketplace/submission-checklist.md`,
then submit for review. Production must not use any EAP feature.

## Already deploy-ready

The entire `src/` tree, `manifest.yml` (only `app.id` is filled by
`forge register`), `package.json` with its committed lockfile, and the bundled
catalogs. There is no separate build step to pre-stage: `forge deploy` runs the
bundler. The only post-account mutations are `app.id` (step 2) and the
production `INGEST_MODE` variable (step 5).
