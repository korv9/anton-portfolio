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
- 2026-10-21 [USER] Observatories withdrawn from the site (politics, jobs, Job Intelligence, wellbeing, AI Act, statute book); every old address and `/companies/*` redirects to `#what-does-it-even-mean`. Home card "What does it even mean?" replaces Observatories. `frontend/src/{compliance,companies,job-intelligence}` kept unrouted for the compliance release hash; `platform/architecture/registry.py` still lists deleted frontend folders.

- 2026-10-27 [CODE] Arbetsförmedla completion (branch korv9/arbetsformedla-complete): CV quotes carry `source` (employment/internship/education/project/skills_list/summary), wish `seniority` (junior|any), lazily loaded `job-assistant/texts-remaining.json` for every open ad, engine `job-match-v4`, public CV profile section, status buttons, wishes editor, owner token in localStorage, failure states, phone redaction re-applied each run.
- 2026-10-27 [TOOL] Manual evaluation (AI agent on the owner's behalf) in `docs/job-assistant-evaluation.md`: list precision 16/36 (v1) to 9/13 (v3); v4 local counts 1 strong, 18 possible, 109 stretch, 2,068 outside. Status persistence verified with wrangler dev and local D1.
- 2026-10-27 [USER-PENDING] Live owner functions still need: Cloudflare token permission Account > D1 > Edit (setup run 40580520662 failed on it), then setup workflow, D1 id in wrangler.toml, secret JOB_ASSIST_TOKEN, CV upload and approval.

## Working set

- 2026-10-18 [CODE] `.github/workflows/ci.yml`, `.github/workflows/security.yml`, `CLAUDE.md`, `docs/development.md`
- 2026-10-18 [CODE] `scripts/verify.mjs`, `scripts/preflight.py`, `scripts/workspaces.py`, `platform/tests/architecture/test_development_workflow.py`
- 2026-10-18 [CODE] `frontend/src/tech/`, `frontend/playwright.config.ts`, `.gitattributes`, `package.json`

## Receipts

- 2026-10-18 [TOOL] Private real-data browser check: 25 ads, nine company sections, full source text, no render errors; public build contains no private profile fingerprint.
- 2026-10-18 [TOOL] Earlier complete test attempts encountered disk exhaustion and transient Windows directory locks; disk space was recovered with non-destructive test-artifact compression.

- 2026-10-18 [TOOL] Final receipts and task file inventory were in `docs/job-intelligence-report.md` (removed 2026-10-23; see Git history). Idea Lineage extraction failed on the existing journal missing `created_at`; no entries were written.

- 2026-10-18 [USER] Explicitly authorised committing the Job Intelligence work, merging with latest main and pushing to main. Other dirty workspace changes remain separate.
- 2026-10-18 [TOOL] A 54-file feature branch merged without conflicts into an isolated checkout of latest origin/main; upstream projects were retained. Merged verification passed: 680 Python tests, 141 unit tests, 180 browser tests and three security tests; type, format, build and publication checks passed.

- 2026-10-18 [USER] Requested the Graphify refresh before completing the branch/main merge. Local graph caches remain ignored; no private profile is published.
- 2026-10-18 [TOOL] The earlier PR #66 open-state receipt is superseded: origin/main includes its merge at e31fb2c. Remote site/dependency checks passed; Linux test isolation and two exact reviewed public-taxonomy scanner fingerprints were corrected. Local CI-parity Python rerun: 680 passed, two skipped; full history scan passed.

- 2026-10-18 [TOOL] Graphify caches refreshed in both worktrees: 7,477 nodes, 18,394 edges, 661 communities. Source queries pass; 25 self-loops and bounded scope were disclosed in `docs/job-intelligence-graph-update.md` (removed 2026-10-23; see Git history). Graph files remain ignored.

- 2026-10-18 [TOOL] Workflow regression cases pass; TypeScript, formatting, unit tests and production build pass. Worker/script LF checkout rules fix Windows format failures. Final local receipts: 686 Python tests and two skips, 141 unit tests, 180 browser tests and two skips, three security tests. Quick verification passed in about 23 seconds. All 33 original TechPanel declarations match after extraction; cached graph locations predate that extraction.

- 2026-10-18 [USER] Authorised committing and pushing workflow-efficiency changes to a branch, then merging to main after required CI passes.

- 2026-10-22 [CODE] Clustering batches 0-2 (`platform/publish/clusters/`, pipeline subject `clusters`, schema `configs/delivery/schemas/clusters/export.json`): one fit script per clustering, run ids in `cluster_lab/clusters/registry.sqlite`, exports in `frontend/public/data/clusters/`. Only status `finding` may be posted. Results and statuses: `docs/cluster-batches.md`.
- 2026-10-23 [CODE] Docs refresh (branch korv9/docs-refresh): 28 outdated docs and 6 run-log JSON files removed or merged, `docs/README.md` is the index, new root README and folder READMEs for `frontend/`, `configs/`, `scripts/`; `ml/README.md` covers every package. Classification and evidence are in the PR body.
- 2026-10-23 [CODE] Old Bailey extraction (`ml/oldbailey/`, pre-registered in `docs/oldbailey-extraction-preregistration.md`): ORDA zip is CC BY-NC 4.0, stored in R2 `warehouse/raw/oldbailey/` with ATTRIBUTION.txt; trial text stays local. gemma answers accrue in `warehouse/features/oldbailey/gemma-sample.jsonl` at 6,000 neurons per UTC day; `python -m ml.oldbailey.score` refuses to export until all 2,000 are answered (871 on 2026-10-23).

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
  - 2,000,000 distinct texts in total (superseded below)
- 2026-10-20 [TOOL] Phase 0 audit correction: all 23 archives are now counted, 11,291,650 ads and 8,736,050 distinct texts (sum over `frontend/public/data/sweden/language/coverage.json`). The subject runs `--max-new 3`, not 4 (`platform/pipeline.yml:310`).
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
- 2026-10-20 [CODE] E The Lost Futures:
  - `platform/ingest/riksdagen/futures_language.py` uses a future marker and nine themes from `seeds/sweden_futures/future_terms.csv`.
  - The lexicon was corrected for false positives: Kristersson, Miljöpartiet, and SCB's basinkomst.
  - Marts: `mart_sweden_future_themes`, `mart_sweden_future_trends`. Export: `export_futures.py`. Subject: `sweden_futures`.
- 2026-10-20 [TOOL] E results, all 32 sessions:
  - Future-oriented speeches rose from 17.8 % (1994) to 21.9 %.
  - Within future talk, alternative arrangements fell from 2.9 % to 0.6 % (break 2002), and culture fell from 13 % to 9 %.
  - Security rose from 27 % to 39 % (break 2017), crisis from 10 % to 18 % (break 2008), and collective transformation from 6.3 % to 8.1 %.
  - The year 2000 is left out: its archive is thin. (Wrong cause, corrected below.)
- 2026-10-20 [TOOL] Phase 0 audit correction: session 1999/2000 exists (`anforande-19992000.json.zip`) but the six-digit regex at `platform/ingest/riksdagen/futures_language.py:47` never counts it. So 1999 holds only its spring sitting and 2000 only its autumn sitting, which the half-median rule drops. "17.8 % to 21.9 %" compares 1994 with the partial year 2026. Fixed in 71761a09; the audit doc was removed on 2026-10-23 (Git history).
- 2026-10-20 [CODE] Connections: `export_connections.py` computes Spearman ρ with a bootstrap CI and a partial ρ that holds log population constant.
  - Visits vs post-secondary education: ρ −0.00, partial 0.19 (uncertain).
  - Visits vs income: ρ 0.09, partial 0.17 (uncertain).
  - Service points vs population: trivial.
  - B×E and speeches×theses are rejected.
- 2026-10-20 [CODE] Other projects: the header has a SWEDEN link and its menu is titled "Other projects". Featured SWEDEN cards sit on the homepage (new classes only; the protected sections are untouched) and on #projekt.
- 2026-10-20 [CODE] E's academic corpus: `platform/ingest/diva/futures_theses.py` harvests the OAI set `studentThesis` (CC0 metadata), keeps Swedish abstracts and counts the same lexicon by publication year. All 322 months are counted. Years with at least 1,000 abstracts (2001–2026) are shown on E's page in a separate chart, never pooled with the Riksdag. Mart: `mart_sweden_future_theses`.
- NEXT:
  - 3D done for A, B and E (BarField, lazy, ?scen=3d). C stays a 2D morph and D an SVG choropleth; a true 3D morph and travel-time accessibility (needs transport-network data) are open.
  - Remaining B archive years, through the weekly build or `workflow_dispatch` of build-warehouse on main.

## Philosophy track 1 (branch korv9/philosophy-moral)

- 2026-10-22 [CODE] Pre-registered in `docs/philosophy-moral-preregistration.md`: MFRC foundation tagger (bge-m3 + logistic regression), eMFD baseline, Riksdag passages 1993-2026, ETHICS agreement. Code `ml/moral/`, marts `models/*/philosophy_moral`, export `platform/publish/philosophy/export_moral.py` -> `philosophy/moral/{foundations,ethics}.json`.
- 2026-10-23 [TOOL] English (in-domain random-hash split, not by subreddit or thread): tagger vs one annotator macro-F1 0.32 against annotator vs annotator 0.27, a weak human ceiling (alpha 0.08-0.31). The tagger sits at or just above that ceiling; gap per foundation with 95 % CI: care 0.04 (0.01 to 0.08), equality 0.06 (0.01 to 0.12), proportionality 0.09 (0.04 to 0.14), loyalty 0.01 (-0.06 to 0.07), authority 0.05 (0.01 to 0.10), purity 0.05 (0.00 to 0.10). eMFD F1 0.04-0.22. ETHICS (gemma, 200 items per subset): kappa 0.50-0.84, every subset above the shuffle null in both wordings; 40 unparsed replies.
- 2026-10-22 [USER] Riksdag shares stay unpublished until the owner labels `tmp/mf-review.csv` (300 passages) and `python -m ml.moral.riksdag gate` passes; then `score`. The gate compares the owner's single-rater F1 with the majority-gold English F1 (stricter). Unit amended to sentence passages at the first draw, committed after the review set was embedded (archive markup differs by era).
- 2026-10-23 [CODE] `warehouse/raw/philosophy_moral` (MFRC Reddit text, GPL eMFD, ETHICS) stays local; `warehouse_store.py` never pushes it, nor `features/philosophy/moral/run` (`LOCAL_ONLY`); the Riksdag passage sample now lives in `warehouse/ml/moral/run`. Only figures and derived features go to R2.

## Clustering experiments and job-ad MLOps (branch korv9/cluster-experiments)

- 2026-10-29 [CODE] Shared core `ml/experiments/` (contract, leak-free splits, shared measures, registry candidate/champion/rejected with promote/rollback/reinstate, frozen acceptance in `configs/experiments/*.yaml`, embedding cache per text hash/revision/text version, checkpoints, heavy lock, export to `frontend/public/data/cluster-experiments/` + catalog registration). Protocol and deviations: `docs/cluster-experiments.md`; per-domain results in `docs/cluster-experiments-*.md`.
- 2026-10-29 [TOOL] Final evaluations, run locally (GTX 1660 for embeddings only): Symbol Lab keeps its champion (3 candidates rejected); Philosophy registry champion K-means 10 (bge-small also passed); Replik registry champion SBERT party-centred (gain only party AMI −0.014, partly by construction); jobs champion withdrawn for redaction-marker text, original pipeline on corrected text reinstated, refresh retrain rejected on employer dominance. No site page changed; a page change needs its own review.
- 2026-10-29 [CODE] Heavy path: `cluster-jobs.yml` job `experiments` and new `job-clusters.yml` (weekly assign/monitor/retrain, never promotes). Neither has run in Actions; CPU timing there is unmeasured. Registry and checkpoints are in features/experiments (no source text); prepared text stays in `warehouse/ml/experiments/`. Not yet pushed to R2.
- 2026-10-30 [TOOL] Actions on main (#196, #197 added psutil to the ML lock): `experiments philosophy select` resumed entirely from R2 checkpoints (3 s); `job-clusters.yml` assign took 66.7 s at a 2.15 GB peak on CPU (97 changed and 42 removed ads, 44 % fits no group, flagged); retrain candidate 8fc83877 rejected on employer dominance. Full selection grids are still unmeasured in Actions.
- 2026-10-30 [TOOL] Repro `select` from scratch in Actions (#199, `repro` word, separate folders): philosophy 9 min 42 s / 3.57 GB, symbolic 16 min / 3.11 GB, debates 2 h 12 min, jobs 54 min (newer 2,843-ad snapshot). Philosophy embeddings matched local; UMAP/HDBSCAN metrics drift by a few hundredths. Debates/jobs peak RAM not recorded. Receipts in `docs/cluster-experiments.md`.
- 2026-10-30 [TOOL] Runner `final` from scratch for all four domains (#201 repro roots): philosophy 4 min / 2.16 GB, symbolic 12 min / 3.07 GB, debates 51 min / 2.82 GB, jobs select 68 min / 3.96 GB + final 31 min / 2.71 GB. Decisions differ from local in every domain (philosophy bge-small not K-means 10; symbolic all pass; debates K-means 30 not sbert-party; jobs newer snapshot). Frozen margins are within cross-machine drift; stored registry promotions are not reproducible and change no page. Symbol Lab `final` chained promotions; fixed to judge against the refitted v4 run.
- 2026-10-30 [CODE] Philosophy and Replik registry promotions rolled back to the original champions (6efd7326, e86ca4aa) because the runner rerun did not reproduce them; the demoted runs stay candidates. `Registry.rollback(to=...)` added. Every domain's registry champion is again its original pipeline; Cluster Visuals run limitations carry the rerun result.
- 2026-10-30 [TOOL] Second runner `final` for philosophy and symbolic (41051018576, 41051992370) matched the first runner run exactly: the runner is deterministic; local vs runner is the drift. On the runner bge-small (philosophy) and all symbolic candidates pass. Not promoted: picking the runner as the deciding machine is an owner decision.
