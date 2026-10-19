# Continuity

## Snapshot

- 2026-10-18 [USER] Requested workflow optimization in six areas: CI duplication, verification scope, skill routing, resource checks, workspace lifecycle and responsibility-based extraction.

- 2026-10-18 [USER] Job Intelligence is a compact continuous research terminal; all job, CV and company sections render without reveal controls.
- 2026-10-18 [CODE] Public mode uses generic newest-first jobs. Personalisation requires an explicit loopback-only local qualification profile; no candidate facts enter public releases.
- 2026-10-18 [CODE] Canonical job/company resolution, the frozen SCB compliance cohort and independent legal publication gates remain in use.
- 2026-10-18 [TOOL] Current observed source projection contains 600 Swedish ads; 599 were unexpired at the latest local check, with 25 local recommendations.

## Done / current / next

- 2026-10-18 [CODE] Local workflow-efficiency branch implements the six areas; full local verification passed. User has now authorized branch publication and merge to main; deployment verification is outside this task.

- 2026-10-18 [CODE] Added fulltext delivery, conservative extraction, deterministic local ranking, continuous company sections and private development access controls.
- 2026-10-18 [TOOL] Python: 662 passed, two skipped. Frontend: 129 unit tests; Playwright: 173 passed, two skipped; security: three passed. Build, format, TypeScript and publication checks passed after module split.
- 2026-10-18 [USER] No automatic deployment. Missing financial/workforce/contracts/repository/issuer data must remain absent; named legal findings still require human approval.

## Working set

- 2026-10-18 [CODE] `.github/workflows/ci.yml`, `.github/workflows/security.yml`, `CLAUDE.md`, `docs/development.md`
- 2026-10-18 [CODE] `scripts/verify.mjs`, `scripts/preflight.py`, `scripts/workspaces.py`, `platform/tests/architecture/test_development_workflow.py`
- 2026-10-18 [CODE] `frontend/src/tech/`, `frontend/playwright.config.ts`, `.gitattributes`, `package.json`

## Receipts

- 2026-10-18 [TOOL] Private real-data browser check: 25 ads, nine company sections, full source text, no render errors; public build contains no private profile fingerprint.
- 2026-10-18 [TOOL] Earlier complete test attempts encountered disk exhaustion and transient Windows directory locks; disk space was recovered with non-destructive test-artifact compression.

- 2026-10-18 [TOOL] Final receipts and task file inventory: `docs/job-intelligence-report.md`. Idea Lineage extraction failed on the existing journal missing `created_at`; no entries were written.

- 2026-10-18 [USER] Explicitly authorised committing the Job Intelligence work, merging with latest main and pushing to main. Other dirty workspace changes remain separate.
- 2026-10-18 [TOOL] A 54-file feature branch merged without conflicts into an isolated checkout of latest origin/main; upstream projects were retained. Merged verification passed: 680 Python tests, 141 unit tests, 180 browser tests and three security tests; type, format, build and publication checks passed.

- 2026-10-18 [USER] Requested the Graphify refresh before completing the branch/main merge. Local graph caches remain ignored; no private profile is published.
- 2026-10-18 [TOOL] The earlier PR #66 open-state receipt is superseded: origin/main includes its merge at e31fb2c. Remote site/dependency checks passed; Linux test isolation and two exact reviewed public-taxonomy scanner fingerprints were corrected. Local CI-parity Python rerun: 680 passed, two skipped; full history scan passed.

- 2026-10-18 [TOOL] Graphify caches refreshed in both worktrees: 7,477 nodes, 18,394 edges, 661 communities. Source queries pass; 25 self-loops and bounded scope are disclosed in `docs/job-intelligence-graph-update.md`. Graph files remain ignored.

- 2026-10-18 [TOOL] Workflow regression cases pass; TypeScript, formatting, unit tests and production build pass. Worker/script LF checkout rules fix Windows format failures. Final local receipts: 686 Python tests and two skips, 141 unit tests, 180 browser tests and two skips, three security tests. Quick verification passed in about 23 seconds. All 33 original TechPanel declarations match after extraction; cached graph locations predate that extraction.

- 2026-10-18 [USER] Authorised committing and pushing workflow-efficiency changes to a branch, then merging to main after required CI passes.

## SWEDEN research platform (branch korv9/sweden-research-platform)

- 2026-10-19 [CODE] Phase 1 audit done. #sweden moved: Wellbeing Observatory now #wellbeing*, old #sweden-* tabs redirect. SWEDEN routes in router.ts SWEDEN_PATHS; frontend/src/sweden/ (template, products, hub, A page); docs/sweden-design.md.
- 2026-10-19 [CODE] Phase 2 A Politics of Measurement: ingest platform/ingest/catalogue (SCB API v2 tables + metadata, Kolada KPI catalogue), seeds/sweden, gold mart_sweden_measurement_{items,coverage}, export platform/publish/sweden/export_measurement.py, subject `sweden` in group baseline. dbt 16/16 pass. 4,270 SCB tables, 5,860 Kolada KPIs.
- 2026-10-19 [TOOL] PR #70 (routes, template, A) merged to main at 198bac5 after the four required GitHub checks passed. Cloudflare Workers branch builds fail on every PR branch (also earlier ones); not required.
- 2026-10-20 [CODE] B The Ideal Human:
  - `platform/ingest/jobtech/ad_language.py` uses the lexicon in `seeds/sweden_language/ad_language_terms.csv` (9 categories) and counts distinct texts.
  - Archives without ids or occupations are handled. Legacy AMS ids map to fields through the JobTech taxonomy. The 2006 archive records no occupation (99.99 % id 0).
  - Marts `mart_sweden_job_language(_trends)` give shares, per-1,000-word rates, and occupation-standardised rates. A year without occupations gets null.
  - Export: `export_language.py`. Subject `sweden_language` runs with `--max-new 4` per week.
- 2026-10-20 [TOOL] B counted locally:
  - archives 2006 and 2010
  - corpus folders 2023, 2024 and 2025
  - 2,000,000 distinct texts in total
- 2026-10-20 [TOOL] B results: ads grew from 132 to 445 words. Per 1,000 words with the occupation mix fixed, 2010 to 2025:
  - passion +72 %
  - creativity +21 %
  - competence −19 %
  - stress −34 %
- 2026-10-20 [CODE] C The Invisible Sweden: `export_similarity.py` reuses `warehouse/cluster_lab/public-consensus-2026-10-13`, adds nearest neighbours, and adds SCB boundaries (CC0, fetched by `platform/ingest/scb/boundaries.py`). 208 of 280 municipalities have their most similar municipality in another county; median 180 km. Site text and docs now give the right exclusion reasons (7 lack social assistance, 3 lack turnout).
- 2026-10-20 [CODE] D Belonging: `platform/ingest/kb/libraries.py` fetches Biblioteksdatabasen (open API, no licence named; no contact data) and bibstat terms (CC0): BemanService01, Besok01, Publ199, Aktiv99. `export_belonging.py` writes the results.
- 2026-10-20 [TOOL] D results, 2014 to 2025: staffed service points fell from 1,171 to 1,054; reported visits fell from 63.6 to 48.7 million.
- 2026-10-20 [CODE] SWEDEN has its own delivery group `sweden` (`configs/delivery/sweden.json`); baseline excludes `sweden/*`. Shared map: `frontend/src/sweden/map.ts`.
- 2026-10-20 [TOOL] Checks:
  - `sweden.spec.ts`: 8 passed, desktop and mobile, axe clean.
  - `verify:quick` passes.
  - Architecture pytest: 8 environment-only failures, because the tests expect `C:/Program Files/Git/mingw64/bin/bash.exe`.
- NEXT:
  - E The Lost Futures: a lexicon over Riksdag speeches from 2016/17 and DiVA abstracts, corpora kept apart.
  - Connections.
  - Other Projects and the SWEDEN-first homepage listing.
  - three.js scenes.
  - Remaining B archive years, through the weekly build or `workflow_dispatch` of build-warehouse on main.
