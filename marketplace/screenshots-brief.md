# Screenshots brief

Capture six screenshots after a scan of the realistic fixture
(`test/fixtures/realistic`, 32 files of mixed quality), in a Jira sandbox site
with a believable project name. No real customer data (brief 18.2, 23 #10).
Minimum 1280 x 800.

1. Project page, Dashboard tab, after a completed scan. Show the summary line
   (work items, migration blockers, estimated hours) and the recent scans
   table with a Complete status.
2. New scan tab with the GitHub repo fields filled (a fake `acme/legacy` repo)
   and the zip and Bitbucket note visible.
3. Work items tab filtered to the security category, the table showing
   id, title, category, severity, effort, and Jira columns, with the export
   row visible.
4. Plan tab after Build plan: the executive summary and the phase table
   (Phase, Work items, Hours, Sprints) for all four phases.
5. A created Jira issue opened in Jira, showing the structured description:
   Rationale, Recommendation, Code location with the cfml code block,
   References, and Effort.
6. The published Confluence parent page: executive summary, phasing roadmap
   table, statistics, and the links to the four child pages.

Naming: `cartographer-01-dashboard.png` through `cartographer-06-confluence.png`.
Store under `marketplace/screenshots/` (created at capture time on a real
sandbox; not committed in this build because it has no Atlassian account).
