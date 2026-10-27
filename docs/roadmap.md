# Roadmap

This file is the single source of truth for the build loop that started on 2026-10-22. The
coordinator updates the status column; workers read it before they start a backlog item. The
plans it draws on were written on 2026-10-22 as ignored working notes (portfolio plan, clustering
inventory, chart inventory, motion plan, job-ads ML note). Their decisions are recorded here so the
notes can be discarded.

## Goal

Anton builds the whole data path on his own, from daily ingestion of Swedish and EU public data
into a tested dbt and DuckDB warehouse on R2 to analyses that state how sure they are. Every chart
on his page can be traced to its source, its tests, its freshness and what it cost to run, and
that cost is zero.

The work below makes that visible on the start page: data errors fixed first, then provenance on
every chart, then a small number of cross-dataset charts that each carry a pre-registration and a
null model.

## Decisions taken

The owner adopted the coordinator's recommendations on 2026-10-22. Any of them can be overturned
by the owner; record the change here with a date.

| Topic | Decision |
| --- | --- |
| Order | PR #92 (home feed) merges first. Nothing else touches `frontend/src/home/**` or `frontend/src/meaning/**` until it has. |
| Merging | Agents merge to `loop` after CI and the reviewers pass (`loop` replaced `dev` on 2026-10-22). `main` changes only when the owner says yes. |
| Municipality grouping | Decided by H4's stability results. Both the k = 4 and the k = 2 posts stay offline until then. |
| Feed chapters | Chapter headings are allowed in the feed. "How it's made" is the last chapter of the home feed. |
| Pre-registrations | Each one is committed before the analysis it governs. |
| Elections | `fct_election_municipality` is built in Actions and published. |
| Workers AI | The daily neuron quota is split 50/50 between Ask the law and Ask the platform. When the quota runs out, both show precomputed answers. |
| I-7 (unemployment and the vote) | Stays a method note. It does not appear on the recruiter page. |
| Offline | The 3D SWEDEN views stay offline. At most one symbolic-atlas post. Job-cluster posts are relabelled "map of ad language". DrugComb leaves the feed and keeps its repo card. |
| Compute | At most 2 local workers at a time. All heavy compute runs in GitHub Actions. |
| Check-ins | The owner reviews at the end of each phase. |

Motion and layout decisions follow the motion plan's recommendation in each case:

| Topic | Decision |
| --- | --- |
| CV link | Added to the site header, so the CV stays reachable after About scrolls away. |
| `useSlowScroll` | Kept for mouse wheels only (`deltaMode === 1`, or integer steps of at least 100). Trackpads and touch scroll natively. |
| Cards | Paper slips: 2 px radius, `#fbf9f3` background, hairline border. Muted text is checked for 4.5:1 contrast on the new background. |
| Chapter numbers | Each chapter head shows its number in mono (`03 / 07`) and one headline figure taken from the data. |
| Hero caption | A mono caption gives the speech count from the loaded points. It is absent when the points have not loaded. |

## Roles

| Role | When | Does |
| --- | --- | --- |
| Builder | each backlog item | Works in its own worktree and branch, opens a PR against `loop`, reports through the coordinator. |
| Code reviewer | every PR | Correctness, tests, reuse, file size, the repository rules in `CLAUDE.md`. |
| Data and statistics reviewer | every PR that touches data, charts or analysis | Grain, joins, units, nulls, the pre-registration, the null model, what the caption claims. |
| Design and accessibility QA | before each merge to `main`, batched | Keyboard, axe, reduced motion, 360 px layout, contrast, the approved design direction. |
| Writer | any published prose | Writes new text only and never changes the owner's existing home-page copy unless asked. Applies `.claude/skills/de-ai-writing/SKILL.md` and runs its `scripts/check_ai_signs.py` on every changed prose file. |
| Coordinator | throughout | Dispatches items, runs reviewers, merges to `loop`, keeps this file current, asks the owner. |

Review rules:

- Findings name a file and line (`path:line`) and say what is wrong and why.
- At most two review rounds per PR. A finding still open after the second round goes to the
  coordinator, who decides or asks the owner.
- Only correctness, data and accessibility findings block a merge. Other findings are recorded and
  may become backlog items.

## Definition of done

Every item uses the standard block (STD) in section 5 of the portfolio plan, copied here once:

- Data published through the repository's export, in a delivery group in `configs/delivery/` and in
  `catalog.json`; the open data pushed to R2 with `pipeline.py push`.
- A gold model with dbt tests (unique grain, not-null keys, accepted ranges, shares that sum to 1
  where that applies); `dbt build --select <model>+` passes.
- Export JSON of at most 200 KB, with `method`, `diagnostics` where statistical, and `generated_at`.
- Python tests for the export and the statistic, including one that fails when the null or the
  bootstrap is removed.
- `npm run verify:quick` and the affected tests pass; `verify:full` for shared frontend changes;
  `verify:delivery` for publication changes; required GitHub CI passes before merge.
- Accessibility: axe clean, keyboard reachable, a text alternative that names the finding, reduced
  motion respected.
- Performance: the home page's first paint is unchanged, no new dependency, each post loads its data
  only when it is near.
- Mobile: readable at 360 px with no horizontal scroll; direct labels instead of legends.
- Copy checked with the de-ai-writing script; the caption gives units, period, source and the basis
  of comparison.
- The provenance fold shows lineage, tests, freshness and the rebuild command.
- Thirty-second test: someone new to the post can state its finding from the card and the open view.

Items without data changes drop the data and dbt points. The DoD column below lists only what an
item adds to STD.

## Backlog

Status values: `todo`, `doing`, `review`, `loop` (merged to loop), `main`, `blocked`. Statuses checked against the merge commits on `origin/loop` and `origin/main` on 2026-10-23.

### Phase 1

| Id | Title | Depends on | Owner files | Status | DoD beyond STD |
| --- | --- | --- | --- | --- | --- |
| P1.0 | Merge PR #92 (home feed) | none | `frontend/src/home/**`, `frontend/src/meaning/**` | main (#92) | Merged after CI and review. |
| P1.1 | Data-error fixes, honest KPIs, name visible at first paint, feed pause control | P1.0 | `frontend/src/meaning/posts/{wel-*,job-ai*,pol-*,txt-act*,txt-ml*}.tsx`, `pol-kit.tsx`, `kit.tsx`, `frontend/src/home/home.css`, `DebateBackdrop.tsx`, `platform/publish/` where a value is wrong at the source | main (#99) | Each data error from the chart inventory has a test or fixture assertion. No post shows a UMAP-space silhouette as quality. The name and role are visible at first paint with the debate map delayed. A pause control stops every moving card and keeps its state over a reload. |
| P1.2 | H1 trace every chart, and the feed chapters | P1.0 | `frontend/src/meaning/{kit.tsx,Feed.tsx,meaning.css,Trace.tsx}`, `platform/architecture/feed_provenance.py`, `frontend/public/data/architecture/feed-provenance.json`, `frontend/src/meaning/posts/how-*.tsx` | loop (#111) | Every feed post declares `sources`; a unit test fails on a missing or unknown path. Unresolved lineage reads "lineage not recorded". Freshness comes from real status data and is hidden when unreachable. The cost receipt shows only measured numbers with sources. |
| P1.3 | Clustering batches 0 to 2 | P1.0 for the feed posts | `ml/cluster_lab/` configs, `warehouse/features/clusters/<name>/`, `platform/publish/clusters/export_<name>.py`, gold `mart_cluster_<name>`, `frontend/src/meaning/posts/*-clusters-*.tsx` | main (#94) | `diagnostics` holds n, k, noise share, original-space silhouette, bootstrap ARI with its 5 to 95 % range, the null value and p, AMI against the reference label. The cluster_lab run id is carried into the export. ARI below 0.6 ships only as a labelled counter-example. Unmatched municipality names are counted and listed. |
| P1.4 | H4 Three Swedens, with I-14 | P1.3 batch 2, elections in Actions | `docs/sweden-three-spaces-preregistration.md`, `ml/three_swedens.py`, `platform/publish/clusters/three_swedens.py`, gold `mart_municipality_three_spaces`, `frontend/public/data/clusters/three-swedens.json`, one post | main (#103; the post follows PR #92) | Pre-registration committed before the analysis. Mantel r with 9,999 permutations and partial Mantel on distance for all three pairs. Copy says "municipalities where". Misfits readable without colour. Settles the municipality grouping. |
| P1.5 | H3 AI Act diffusion clock, Riksdag and ad lanes, with I-9 | P1.0 | `platform/nlp/ai_act_terms.py`, `seeds/cross_domain/ai_act_terms.csv`, gold `mart_ai_act_term_diffusion`, `ai-act/diffusion.json`, `frontend/src/meaning/posts/txt-act-diffusion.tsx` | loop (#97 in main, #116 in loop) | Term list generated, then reviewed, with each dropped term and its reason in the seed. Placebo p from 200 placebo months per lag. Partial month excluded; 2026 marked Jan to Sep. The ad scan runs in Actions. Result, 2026-10-23: neither lane shows a lag shorter than at random dates for ai-system or ai-modell. The short ad lags of the two longer terms rest on nine ads from one employer, posted on one day. |
| P1.6 | Futures topics in Actions | none | `.github/workflows/cluster-jobs.yml`, `ml/futures_topics/`, `platform/models/*/sweden_futures/`, `platform/publish/sweden/export_futures_topics.py`, `frontend/src/sweden/FuturesTopics.tsx` | review | Pilot code and pre-registration on `loop`; sample and embeddings in R2 under `features/sweden/futures_topics/`; the workflow runs only from `main`. The pre-registered stability and null tests decide whether any topic is published. |

### Phase 2

| Id | Title | Depends on | Owner files | Status | DoD beyond STD |
| --- | --- | --- | --- | --- | --- |
| P2.1 | H2 Ask the platform | P1.2 | `platform/nlp/workers_ai.py`, `platform/nlp/platform_docs_corpus.py`, `frontend/public/data/workers-ai/platform/`, the Worker route beside `/api/answer`, `configs/workers_ai/eval_questions_platform.yaml` | loop (#102) | At least 75 % of 20 eval answers verified; neurons per answer in `docs/workers-ai.md`. Answers quote verbatim with path and commit. The quota fallback is tested with a stubbed 503. A test fails if the corpus holds an ignored or private path. |
| P2.2 | H5 academia against industry tech lag, plus H3's thesis lane | P1.5 | `refresh-diva.yml`, `platform/publish/diva_terms.py`, gold `mart_tech_term_adoption`, `jobs/tech-lag.json`, one post | todo | Terms counted in Swedish and English abstracts, coverage per year published. Bootstrap interval on each lag; only terms with at least 50 mentions in both corpora. |
| P2.3 | Small cross-dataset posts: I-5, I-13, I-12, I-15 | P1.2 | one export, mart and post each; I-5 adds a mapping seed | todo | STD only. |

### Phase 3 (optional)

| Id | Title | Depends on | Owner files | Status | DoD beyond STD |
| --- | --- | --- | --- | --- | --- |
| P3.1 | I-7 unemployment and the vote, as a method note | pre-registration | `docs/` method note | todo | Pre-registration first. Not shown on the recruiter page. |
| P3.2 | I-8 sick leave and substitute hiring | P1.3 batch 2 | one export, mart and post | todo | STD only. |
| P3.3 | I-10 debated but unmeasured | P2.1 | Workers AI labelling, one post | blocked | Hand check of at least 70 % accuracy before it is built. |
| P3.4 | I-6 debate to statute book | the `Förarbeten` key | one export, mart and post | blocked | The key must exist and be verified first. |
| P3.5 | Clustering batch 4 in Actions: DiVA topics, `bridge_job_skills` | P1.6 | `.github/workflows/cluster-jobs.yml` `module` entry, `ml/cluster_lab/` | todo | Runs through the existing workflow; no new workflow file. |

## Compute

At most one heavy process runs locally at a time; duckdb runs with `memory_limit='1GB'`. Model
fits, UMAP sweeps and scans of the ad archive run in GitHub Actions through
`.github/workflows/cluster-jobs.yml`, which pulls its inputs from the R2 warehouse store and pushes
its results back. The workflow can only be dispatched once it is on `main`.
