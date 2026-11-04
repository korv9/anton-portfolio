# Projects

What each project is, what question it answers, how it is built, where it stands and what
comes next, in the owner's words. A reader should understand a project from this file alone.
Only projects whose code lives in this repository are listed; the site also presents work kept
elsewhere (the degree project, Homie API), which the registry describes. This file
is Anton's: an agent reads it first and changes it only when Anton asks for the change in the
conversation. If the code disagrees with a line here, the agent reports the difference and leaves
the line alone. Status here is development status; `status` in
`frontend/src/projects/projectRegistry.ts` only controls how the site shows a project.

What was decided and why: `DECISIONS.md`. Where the last session stopped: `CONTINUITY.md`.
Per-project history: `docs/idea-lineage/`.

First written 2026-11-03 from the registry, the old `CONTINUITY.md` and `docs/`, and reviewed by Anton the same day.

## Flagships

### replik · Riksdag debates and roll calls
33 years of Riksdag party-leader debates and roll calls, read by machine. The question: what do Sweden's parties talk about when they face each other, and does talking alike mean voting alike? Built from 108 debates 1993–2026 split into 33,023 passages, embedded and clustered into 33 topics (UMAP and HDBSCAN, consensus over 12 seeds), 23,024 roll calls over 33 sessions, and a classifier with party names masked and a person-grouped split. It shows what each party talks about, who sets the agenda, and who votes together.

- Status: live on the site. Champion clustering b33f92b1 decided on the runner (2026-10-30). `polarization` passed its gate; `government_defeat` and `reply` failed theirs and are off Cluster Visuals. The "Place a sentence" demo lives on this page only (2026-11-04).
- Code and data: `frontend/src/replik/`, `ml/mlkit/`, `ml/experiments/`, `docs/cluster-experiments-debates.md`, `docs/ml-gate-amendments.md`.
- Next: not recorded.
- Verified: 2026-11-03, from CONTINUITY and docs.

### jobs · Job assistant and job-ad analyses
Job ads from JobTech, fetched continuously and matched against the owner's CV, with status buttons, a wishes editor and an owner-only draft. The same ad corpus (about 4.9 million ads 2020–2026) feeds the labour-market analyses in `ai-act-clock` and the SWEDEN track. The question: can a public job feed be turned into a personal, honest shortlist without hiding the misses? Built as a Python pipeline (collect, analyse, build, publish), a cluster model register with promote and rollback, and a page that shows when the ads were last fetched and published.

- Status: second flagship, refreshed hourly by GitHub Actions with an 8 h SLA; engine `job-match-v4`. Airflow polling every ten minutes is proven on a runner but not the production scheduler. Listed under Engineering in the rail (2026-11-04).
- Code and data: `platform/job_assistant/`, `infra/airflow/`, `ml/jobs/registry.json` (cluster model efd2e318dc1621b2), `docs/job-assistant.md`, `docs/job-ads-airflow.md`.
- Blocked: live owner functions (D1 token permission, setup workflow, secret, CV upload). Raw objects with recruiter contact details in the public bucket await deletion.
- Next: an always-on Airflow host before switching `JOB_ADS_SCHEDULER=airflow`; host budget not approved.
- Verified: 2026-11-03, from CONTINUITY.

## Labs

### symbolic-atlas · Symbol Lab
An unsupervised exploration of recurring symbolic contexts in mythology, folklore and literature. The question: can symbolic meaning emerge from the data without defining the categories first? Built from 101 public-domain books across 12 traditions indexed by 20 symbol words; Sentence Transformers embeds the passages, UMAP projects them and HDBSCAN forms clusters, with dbt and DuckDB holding the data. The experiments showed that the baseline clustered books, not symbols, so embeddings are centred by book and paratext is removed first, and only a person's review may name a cluster.

- Status: experimental. Published atlas on all-MiniLM-L6-v2 with book-centring and paratext removal (October 2026 lineage). Champion a224a175 from the runner; three later candidates rejected. Listed under Experiments on the site (2026-11-04).
- Code and data: `platform/nlp/symbolic/`, `ml/cluster_lab/`, `docs/cluster-experiments-symbolic.md`, `docs/idea-lineage/symbolic-atlas.md`.
- Open: which v4 clusters survive a person's review; how often a symbol word is literal.
- Next: not recorded.
- Verified: 2026-11-03, from the journal.

### philosophy-atlas · Philosophy Lab
A semantic atlas of public-domain philosophy, corrected for each work's own voice. The question: how do recurring moral and philosophical tensions organise texts across thinkers and traditions? Built from thirteen works from Plato to Nietzsche, stripped of translators' introductions and notes, cut into passages, embedded with a multilingual model, mapped with UMAP and HDBSCAN and read through tensions such as freedom ↔ control. Track 1 adds a moral-foundations tagger (bge-m3 and logistic regression) that reaches the human agreement ceiling on English data.

- Status: experimental. Champion f367c26d on the runner. English tagger at the human ceiling (macro-F1 0.32 vs 0.27). Riksdag moral shares unpublished until the owner labels 300 passages and the gate passes. Listed under Experiments on the site (2026-11-04).
- Code and data: `ml/moral/`, `platform/publish/philosophy/`, `docs/philosophy-moral-preregistration.md`, `docs/cluster-experiments-philosophy.md`.
- Blocked: the owner's review of `tmp/mf-review.csv`.
- Next: label, run `python -m ml.moral.riksdag gate`, then `score`.
- Verified: 2026-11-03, from CONTINUITY.

### concept-constellation · Concept Lab
The same ideas followed across myth, philosophy, Riksdag speeches and the AI Act, with one model and editorially chosen concepts. The question: where do the same ideas appear as they move from stories to philosophy, politics and law? Built from a balanced sample of four corpora with full provenance, embedded with one multilingual model and read against 28 concepts with anchor sentences in Swedish and English; every relation has a stated type. Concept Journey follows one concept at a time; the atlas (77,753 passages, per-corpus whitening) is the exploring view.

- Status: experimental. Atlas v2 (77,753 passages, Ledoit-Wolf whitening, 87 of 137 clusters stable); DR benchmark rejected 2026-10-31. Listed under Experiments on the site (2026-11-04).
- Code and data: `ml/atlas/`, `docs/cluster-atlas.md`, `docs/concept-constellation.md`.
- Open: terms unreviewed.
- Next: not recorded.
- Verified: 2026-11-03, from CONTINUITY.

### ask-the-law · Allegora
Questions over a selection of Swedish statutes and the EU AI Act, where the answer is checked word for word against the legal text and then retold as an allegory with a moral. The question: can a language model answer questions on legal text without inventing quotes, on a free plan? Built with paragraphs embedded offline with bge-m3 and compressed to int8 so the search runs in the browser; a Cloudflare Worker embeds the question, checks that the passages sent are published legal text, and has a model answer with quotes that are verified before they are shown.

- Status: experimental. Worker routes refuse foreign origins and answer 503 without the limiter (2026-11-01). "Ask the platform" page removed. The page now carries the project's summary, method and the quote-check rule as text, and is listed under Experiments (2026-11-04).
- Code and data: `worker/`, `frontend/src/lawqa/`, `docs/allegora-gcp.md`, `docs/ai-act.md`.
- Next: not recorded.
- Verified: 2026-11-03, from CONTINUITY.

### drugcomb · Drug Synergy Lab
Drug fingerprints, RNA expression and cell-line data combined to predict drug synergy, with leakage prevention. The question: does a model predicting synergy still work on pairs, drugs and cell lines it has not seen? Built with drug and cell-line entity resolution, a DuckDB warehouse, LightGBM, and evaluation under four cross-validation strategies so that the answer is honest for each kind of unseen case.

- Status: live. Listed under Experiments on the site (2026-11-04).
- Code and data: `frontend/src/products/DrugCombReport.tsx`, `DrugConstellation.tsx`, `CalibrationScatter.tsx`, `DecisionTree.tsx`.
- Verified: 2026-11-03, confirmed by Anton.

### ai-act-clock · When does a law arrive?
How fast an EU law reaches Swedish working life and the Riksdag, measured by counting the AI Act's words in 4.9 million job ads and 129,000 speeches. Built with the Act's terms chosen by weighted log-odds against the Swedish statute book and reviewed by hand, dictionary matching of 4,925,716 job ads (2020–2026) and 129,110 Riksdag speeches, 266 lags each tested against 200 random dates as a pre-registered placebo test, and an article-by-article comparison of the Official Journal text with the consolidated text.

- Status: live. Pre-registration in `docs/ai-act-diffusion-preregistration.md`.
- Code and data: `platform/publish/eu_ai_act/`, `docs/ai-act.md`, `docs/ai-governance-timeline.md`.
- Next: not recorded.
- Verified: 2026-11-03, from docs.

## Engineering

### platform · The data platform
Public data fetched on a schedule, built and tested with dbt in bronze, silver and gold on DuckDB, and released to Cloudflare R2 once every check has passed; the same pattern runs on Microsoft Fabric for DiVA. The question: how do you keep many public sources fresh without publishing a wrong number? Built as Python ingestion with provenance, dbt models with contracts and tests, one registry (`pipeline.yml`) that defines every subject's steps and schedule, scheduled runs in GitHub Actions, versioned releases to R2 with delivery contracts, and a shared experiment core for the ML work.

- Status: live. 334 dbt models (2026-11-01). Publication refuses a 30 % row drop; delivery groups `baseline` and `sweden`; shared experiment core `ml/experiments/`. The case study is shown as prose on Overview, and the site no longer links the incident write-ups (2026-11-04).
- Code and data: `platform/pipeline.yml`, `platform/models/`, `platform/publish/`, `configs/delivery/`, `docs/pipeline.md`, `docs/storage-and-serving.md`.
- Open: full selection grids in Actions are unmeasured for debates and jobs peak RAM.
- Verified: 2026-11-03, from CONTINUITY.

## Tracks without a registry entry

### SWEDEN research platform (branch `korv9/sweden-research-platform`, merged in parts)
Five studies on Swedish public data under `#sweden`: A, what Sweden measures (4,270 SCB tables and 5,860 Kolada KPIs); B, the ideal human in job ads (a lexicon of nine categories over 11.3 million ads, 2006–2025); C, the invisible Sweden (which municipalities resemble each other, 208 of 280 across a county line); D, belonging (library service points and visits 2014–2025); E, the lost futures (future-oriented language in 32 Riksdag sessions and student theses). Each has its own ingest, dbt marts and export, in one delivery group.

- Status: A, B, C, D, E built with their own delivery group; 3D views for A, B and E. Findings in `DECISIONS.md` and `docs/idea-lineage/`.
- Next: remaining B archive years through the weekly build; a true 3D morph for C and travel-time accessibility need transport-network data.
- Verified: 2026-11-03, from CONTINUITY (2026-10-20).

### Old Bailey extraction (`ml/oldbailey/`)
Structured facts extracted from Old Bailey trial records (ORDA, CC BY-NC 4.0) with gemma on Workers AI, pre-registered in `docs/oldbailey-extraction-preregistration.md`; 2,000 trials are being answered within the daily free quota.
- Status: gemma answers accrue at 6,000 neurons per UTC day; export refused until all 2,000 are answered (871 on 2026-10-23).
- Next: wait for the answers, then `python -m ml.oldbailey.score`.

## Delete zone

Removed on purpose. Do not recreate without a new decision in the journal.

| Path or page | Why | Replacement | Revisit when |
|---|---|---|---|
| Observatories: politics, labour market, Job Intelligence, Compliance Intelligence, wellbeing, AI Act, taxes and budget, statute book (2026-10-21) | the site is a portfolio of projects, not a set of dashboards | `#what-does-it-even-mean`; projects above | a new decision in the journal |
| `frontend/src/{compliance,companies,job-intelligence}` kept unrouted | `compliance:check` and `jobs:check` read them | none | the checks stop reading them |
| Platform pages: quality, data model and ER, architecture, catalogue, Idea Lineage page | retired from the site | `docs/quality-and-validity.md`, `docs/data-constellation.md`, `docs/idea-lineage/` | not planned |
| RAG assistant, pump-sound CNN (MIMII), DiVA topic clustering, Allegoria page | retired from the site | project index | not planned |
| `frontend/src/ask` and the "Ask the platform" page (2026-11-01); most of `frontend/src/{hub,tech}` | trimmed in the audit | none | not planned |
| 28 docs and 6 run-log JSON files (2026-10-23) | outdated; Git history keeps them | `docs/README.md` index | never |
| `government_defeat` data file (2026-11-01) | failed its amended gate | the card keeps the failure | a model that passes its gate |
| Overview › Written up and both postmortem links (2026-11-04) | the site is a portfolio, not an incident log | the case study prose on Overview | never |
| Homie API in the rail (2026-11-04) | group project not deployed | registry entry kept | when it deploys |
| "Place a sentence" demo on Cluster Visuals (2026-11-04) | moved to Replik | the demo on `#replik`; `#cv-place` redirects there | not planned |
