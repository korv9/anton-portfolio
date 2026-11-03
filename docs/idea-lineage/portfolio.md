<!-- Generated from the Idea Lineage journal. Do not edit; run npm run ideas:build. -->

# Portfolio

## Current direction
#start is about Anton, #projects is the overview and each project has its own page (docs/design-system.md). The observatories stay withdrawn.

## Active decisions
- Record why the system changes in an append-only Idea Lineage journal — 2026-10-07, `decision-2026-10-07-007`
  Ideas, decisions, experiments, findings and questions are stored as short structured events; prompts and conversations never are.
- Optimise the agent workflow in six areas — 2026-10-18, `decision-2026-11-03-001`
  CI duplication, verification scope, skill routing, resource checks, workspace lifecycle and responsibility-based extraction. Verification levels live in docs/development.md and scripts/verify.mjs.
- No automatic deployment, and missing data stays absent — 2026-10-18, `decision-2026-11-03-002`
  Financial, workforce, contracts, repository and issuer data that cannot be fetched is left out rather than filled in. Named legal findings require human approval before they are shown.
- SWEDEN has its own delivery group — 2026-10-20, `decision-2026-11-03-007`
  configs/delivery/sweden.json; the baseline group excludes sweden/*. The Wellbeing Observatory moved to #wellbeing and old #sweden-* tabs redirect.
- Library data: Biblioteksdatabasen (open API, no licence named) and bibstat (CC0) — 2026-10-20, `decision-2026-11-03-008`
  platform/ingest/kb/libraries.py fetches both; no contact data is stored. Terms used: BemanService01, Besok01, Publ199, Aktiv99.
- Withdraw the observatories from the site — 2026-10-21, `decision-2026-11-03-003`
  Politics, the labour market, Job Intelligence, wellbeing, the AI Act and the statute book are off the site. Every old address and /companies/* redirects to #what-does-it-even-mean. frontend/src/{compliance,companies,job-intelligence} stay unrouted because compliance:check and jobs:check read them.
- One fit script per clustering, and only findings may be posted — 2026-10-22, `decision-2026-11-03-005`
  Clustering batches 0-2 live in platform/publish/clusters/ under pipeline subject clusters, with run ids in cluster_lab/clusters/registry.sqlite and exports in frontend/public/data/clusters/. Results with status finding may appear on the site; the rest stay in docs/cluster-batches.md.
- docs/README.md is the documentation index — 2026-10-23, `decision-2026-11-03-004`
  28 outdated docs and 6 run-log JSON files were removed or merged; root README and folder READMEs for frontend/, configs/, scripts/ and ml/ were added.
- Old Bailey: licensed zip in R2 with attribution, trial text stays local — 2026-10-23, `decision-2026-11-03-006`
  The ORDA zip is CC BY-NC 4.0 and is stored in warehouse/raw/oldbailey/ with ATTRIBUTION.txt. Trial text is never published. ml.oldbailey.score refuses to export until all 2,000 gemma answers exist (871 on 2026-10-23, at 6,000 neurons per UTC day).
- One shared experiment core with a registry of candidate, champion and rejected runs — 2026-10-29, `decision-2026-11-03-011`
  ml/experiments/: contract, leak-free splits, shared measures, frozen acceptance rules in configs/experiments/*.yaml, embedding cache per text hash, checkpoints and a heavy lock. Promotion, rollback and reinstate are explicit commands; the weekly job never promotes.
- The GitHub runner is the deciding machine for champion promotions — 2026-10-30, `decision-2026-11-03-012`
  Stored registries for philosophy, symbolic and debates were replaced by the runner's repro registries (local ones kept as registry-local-2026-10-29.json). Champions: f367c26d, a224a175, b33f92b1; jobs unchanged.
- Anything that passes its gate may be shown on Cluster Visuals — 2026-10-31, `decision-2026-11-03-013`
  GatedModels lists mlkit targets whose pre-declared gate passed; a card whose gate failed keeps the failure and loses its data file (ml/mlkit/promote.py).
- Publication refuses a 30 % row drop on files of 100+ rows — 2026-11-01, `decision-2026-11-03-014`
  Override with PORTFOLIO_ALLOW_ROW_DROP. A partly missing dbt group blocks, --only publish keeps group completeness, and the heartbeat compares published_at.
- Every page is published, in one charcoal theme — 2026-11-01, `decision-2026-11-03-016`
  #start is about Anton, #projects is the overview and each project has its own page (docs/design-system.md). The observatories stay withdrawn.

## Latest findings
- Job-ad language 2010 to 2025: passion +72 %, creativity +21 %, competence -19 %, stress -34 % — 2026-10-20, `finding-2026-11-03-001`
  Per 1,000 words with the occupation mix held fixed, over 23 archives: 11,291,650 ads and 8,736,050 distinct texts. Ads grew from 132 to 445 words.
- Future-oriented Riksdag speeches rose from 17.8 % (1994) to 21.9 % *(tentative)* — 2026-10-20, `finding-2026-11-03-002`
  Within future talk, security rose from 27 % to 39 % (break 2017) and crisis from 10 % to 18 % (break 2008). Limitation: the first run skipped session 1999/2000 through a six-digit regex, fixed in 71761a09, and 21.9 % is the partial year 2026.
- The runner is deterministic; local versus runner is the drift — 2026-10-30, `finding-2026-11-03-004`
  Two runner finals for philosophy, symbolic and debates matched exactly (41051018576, 41051992370, 41073947884). Decisions differed from local in every domain.
- Atlas v2: Ledoit-Wolf whitening chosen by a pre-declared rule, 87 of 137 clusters stable over 5 seeds — 2026-10-31, `finding-2026-11-03-006`
  77,753 passages from six corpora in one MiniLM-L12 space with per-corpus whitening (purity 0.977 to 0.775, translation match 0.996). Links need BH q < 0.05 and a block-bootstrap lower bound above 1: 71 of 3,685.
- government_defeat failed the amended gate: 0.646 against title-procedure flags at 0.661 — 2026-11-01, `finding-2026-11-03-005`
  Difference -0.015 (-0.041 to +0.010), run 20261101-0258. It is off Cluster Visuals. polarization passed its speaker-shuffle retest: 33 of 33 sessions, mean AUC 0.649.

## Open questions
None recorded.
