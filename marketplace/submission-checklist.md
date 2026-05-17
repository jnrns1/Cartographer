# Marketplace submission checklist

Run top to bottom. The operator performs every account, deploy, and submit
step. Cartographer never deploys to production or submits autonomously
(brief 23 #8, #9).

## Pre-submission engineering

- [ ] `npm ci` clean from the committed lockfile
- [ ] `npm run verify` green (tsc, tests, manifest validation)
- [ ] `DECISIONS.md` reviewed; every brief deviation is recorded
- [ ] `BUILD_BRIEF.md`, `README.md`, `CHANGELOG.md`, `LICENSE` present
- [ ] App icon approved by the operator (`static/icons/icon.svg`)

## Account and deploy (operator)

- [ ] `npm i -g @forge/cli`
- [ ] `forge login` with an Atlassian API token
- [ ] `forge register` (writes the real `app.id` into `manifest.yml`; commit it)
- [ ] `forge lint` passes (now that credentials exist)
- [ ] `forge deploy --environment=development`
- [ ] `forge install --environment=development` onto a Jira sandbox, then a
      Confluence sandbox
- [ ] Re-verify Object Store GA status. If still EAP, set
      `forge variables set --environment=production INGEST_MODE chunked`
      before any production deploy

## Manual test matrix (brief 21.3, on the sandbox)

- [ ] Fresh install, project page renders
- [ ] Scan via zip upload
- [ ] Scan via GitHub repo
- [ ] Scan via Bitbucket repo
- [ ] Create Jira issues from a subset, then re-run (idempotent)
- [ ] Publish to Confluence, then re-publish (updates, no duplicates)
- [ ] Each export downloads and is valid
- [ ] Uninstall and reinstall
- [ ] Jira Software, Jira Service Management, Jira Work Management projects
- [ ] Record each pass or fail in `test/manual/test-log.md`

## Listing (operator, partner portal)

- [ ] App name, tagline, summary, description from `marketplace/listing.md`
- [ ] Six screenshots per `marketplace/screenshots-brief.md`
- [ ] Categories and Cloud compatibility selected
- [ ] Pricing model chosen (brief 19)
- [ ] Privacy and data residency statements completed
- [ ] Submit for Atlassian review
