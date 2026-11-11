<!-- Generated from the Idea Lineage journal. Do not edit; run npm run ideas:build. -->

# Decisions

What is decided across the portfolio, why, and how far each decision got. Built from the public Idea Lineage journal (`.idea-lineage/public/journal/`, see `docs/platform/idea-lineage.md`). Current project status and next steps are in `PROJECTS.md`.

Each entry shows the steps on record: decided → implemented (a commit, PR or file reference) → verified (a run reference). A later decision that replaces one is linked, and the replaced one moves to *Set aside* with the reason.

## Ask the law

- 2026-11-01 · Worker AI routes refuse foreign origins and answer 503 without the limiter (`decision-2026-11-03-015`)
  decided (implementation not recorded)

## Concept Constellation

- 2026-10-07 · Open the concept layer with Concept Journey (`decision-2026-10-07-006`)
  Follow one concept at a time through stories, philosophy, Riksdag speeches and the AI Act; the constellation stays as the exploring view.
  Why: A reader can follow one idea across four kinds of text more easily than read the whole constellation at once.
  Also: Symbolic Atlas, Philosophy Atlas, Politics, AI Act
  decided → implemented: commit 278a788

## Jobs

- 2026-11-01 · The job assistant is the second flagship, refreshed hourly with an 8 h SLA (`decision-2026-11-03-017`)
  Subject job_assistant in pipeline.yml. Live owner functions wait on the D1 token permission.
  decided (implementation not recorded)
- 2026-11-02 · Keep the hourly GitHub refresh as the production scheduler until an always-on Airflow host exists (`decision-2026-11-03-018`)
  Then set JOB_ADS_SCHEDULER=airflow and JOB_ADS_PUBLISH=r2. A host budget is not approved.
  Why: Airflow on a GitHub runner proved the flow but is not always on
  decided (implementation not recorded)
- 2026-11-02 · Raw job-ad answers are LOCAL_ONLY, and push refuses to overwrite keys changed in the bucket (`decision-2026-11-03-019`)
  decided (implementation not recorded)

## Philosophy Atlas

- 2026-10-22 · Riksdag moral-foundation shares stay unpublished until the owner's review passes the gate (`decision-2026-11-03-009`)
  The owner labels tmp/mf-review.csv (300 sentence passages); python -m ml.moral.riksdag gate compares the single-rater F1 with the majority-gold English F1 before score may run.
  Why: the English tagger sits only at the human ceiling, so Swedish output needs its own check
  Also: Politics
  decided (implementation not recorded)
- 2026-10-23 · Moral-foundation raw text stays local; only figures and derived features go to R2 (`decision-2026-11-03-010`)
  warehouse/raw/philosophy_moral (MFRC Reddit text, GPL eMFD, ETHICS) and features/philosophy/moral/run are LOCAL_ONLY in warehouse_store.py.
  decided (implementation not recorded)

## Politics

- 2026-10-21 · Withdraw the observatories from the site (`decision-2026-11-03-003`)
  Politics, the labour market, Job Intelligence, wellbeing, the AI Act and the statute book are off the site. Every old address and /companies/* redirects to #what-does-it-even-mean. frontend/src/{compliance,companies,job-intelligence} stay unrouted because compliance:check and jobs:check read them.
  Also: Jobs, Welfare, AI Act, Compliance, Portfolio
  decided (implementation not recorded)

## Symbolic Atlas

- 2026-10-05 · Centre the embeddings by book before clustering (`decision-2026-10-07-001`)
  Subtract each book's mean embedding and normalise again, and compare it with masking the symbol word on one shared sample.
  Why: The baseline grouped books, so the part every passage of a book shares had to be removed before reading anything into the clusters.
  decided → implemented: commit 7ae4c20
- 2026-10-05 · Remove paratext before clustering (`decision-2026-10-07-002`)
  Cut contents, glossaries, notes and indexes from the books and keep an audit of every removal.
  decided → implemented: commit c15d805
- 2026-10-05 · Only a person's review may name a cluster (`decision-2026-10-07-003`)
  Clusters are ranked for review and stay numbers until someone has read the passages; rejections are recorded too.
  Why: A cluster spanning several books is a recurring context worth reading, not proof of a shared meaning.
  decided → implemented: commit c15d805
- 2026-10-06 · Expand the corpus to 101 books across 12 traditions (`decision-2026-10-07-004`)
  Keep the same 20 symbols and grow the corpus from 10 to 101 public-domain books, so the comparison stays controlled.
  decided → implemented: commit 0edc523
- 2026-10-07 · Keep all-MiniLM-L6-v2 for the published atlas (`decision-2026-10-07-005`)
  Why: The gain is small next to the book effect, and the clustering settings were chosen for MiniLM; they should change only after the review.
  decided → implemented: commit efe3595

## Portfolio

- 2026-10-07 · Record why the system changes in an append-only Idea Lineage journal (`decision-2026-10-07-007`)
  Ideas, decisions, experiments, findings and questions are stored as short structured events; prompts and conversations never are.
  Why: Data lineage says where data came from; the reasons behind a change of direction were not written down anywhere.
  decided (implementation not recorded)
- 2026-10-18 · Optimise the agent workflow in six areas (`decision-2026-11-03-001`)
  CI duplication, verification scope, skill routing, resource checks, workspace lifecycle and responsibility-based extraction. Verification levels live in docs/development.md and scripts/verify.mjs.
  decided → implemented: files scripts/verify.mjs, docs/development.md
- 2026-10-18 · No automatic deployment, and missing data stays absent (`decision-2026-11-03-002`)
  Financial, workforce, contracts, repository and issuer data that cannot be fetched is left out rather than filled in. Named legal findings require human approval before they are shown.
  Also: Compliance
  decided (implementation not recorded)
- 2026-10-20 · SWEDEN has its own delivery group (`decision-2026-11-03-007`)
  configs/delivery/sweden.json; the baseline group excludes sweden/*. The Wellbeing Observatory moved to #wellbeing and old #sweden-* tabs redirect.
  decided (implementation not recorded)
- 2026-10-20 · Library data: Biblioteksdatabasen (open API, no licence named) and bibstat (CC0) (`decision-2026-11-03-008`)
  platform/ingest/kb/libraries.py fetches both; no contact data is stored. Terms used: BemanService01, Besok01, Publ199, Aktiv99.
  decided (implementation not recorded)
- 2026-10-22 · One fit script per clustering, and only findings may be posted (`decision-2026-11-03-005`)
  Clustering batches 0-2 live in platform/publish/clusters/ under pipeline subject clusters, with run ids in cluster_lab/clusters/registry.sqlite and exports in frontend/public/data/clusters/. Results with status finding may appear on the site; the rest stay in docs/cluster-batches.md.
  decided (implementation not recorded)
- 2026-10-23 · docs/README.md is the documentation index (`decision-2026-11-03-004`)
  28 outdated docs and 6 run-log JSON files were removed or merged; root README and folder READMEs for frontend/, configs/, scripts/ and ml/ were added.
  decided (implementation not recorded)
- 2026-10-23 · Old Bailey: licensed zip in R2 with attribution, trial text stays local (`decision-2026-11-03-006`)
  The ORDA zip is CC BY-NC 4.0 and is stored in warehouse/raw/oldbailey/ with ATTRIBUTION.txt. Trial text is never published. ml.oldbailey.score refuses to export until all 2,000 gemma answers exist (871 on 2026-10-23, at 6,000 neurons per UTC day).
  decided (implementation not recorded)
- 2026-10-29 · One shared experiment core with a registry of candidate, champion and rejected runs (`decision-2026-11-03-011`)
  ml/experiments/: contract, leak-free splits, shared measures, frozen acceptance rules in configs/experiments/*.yaml, embedding cache per text hash, checkpoints and a heavy lock. Promotion, rollback and reinstate are explicit commands; the weekly job never promotes.
  decided (implementation not recorded)
- 2026-10-30 · The GitHub runner is the deciding machine for champion promotions (`decision-2026-11-03-012`)
  Stored registries for philosophy, symbolic and debates were replaced by the runner's repro registries (local ones kept as registry-local-2026-10-29.json). Champions: f367c26d, a224a175, b33f92b1; jobs unchanged.
  Why: local and runner runs differ by a few hundredths in UMAP/HDBSCAN metrics, which is within the frozen margins, so one machine has to decide
  decided (implementation not recorded)
- 2026-10-31 · Anything that passes its gate may be shown on Cluster Visuals (`decision-2026-11-03-013`)
  GatedModels lists mlkit targets whose pre-declared gate passed; a card whose gate failed keeps the failure and loses its data file (ml/mlkit/promote.py).
  decided (implementation not recorded)
- 2026-10-31 · Dimensionality-reduction benchmark not adopted; the atlas stays on v2 (`rejection-2026-11-03-001`)
  umap10 with exact kNN gave 87 versus 83 stable clusters, under the 1.10 clear-win line; openTSNE map kNN15 0.278 versus 0.094 for UMAP. Local run, docs/cluster-atlas.md.
  rejected (implementation not recorded)
- 2026-11-01 · Publication refuses a 30 % row drop on files of 100+ rows (`decision-2026-11-03-014`)
  Override with PORTFOLIO_ALLOW_ROW_DROP. A partly missing dbt group blocks, --only publish keeps group completeness, and the heartbeat compares published_at.
  decided (implementation not recorded)
- 2026-11-01 · Every page is published, in one charcoal theme (`decision-2026-11-03-016`)
  #start is about Anton, #projects is the overview and each project has its own page (docs/design-system.md). The observatories stay withdrawn.
  decided (implementation not recorded)
- 2026-11-07 · Allegoras svar strömmas som märkt utkast och får ✓ efter citatkontrollen; faller kontrollen tas utkastet bort. (`decision-2026-11-07-001` · by Anton)
  decided (implementation not recorded)
- 2026-11-07 · Fabeln lämnar den kritiska vägen och visas under det verifierade svaret. (`decision-2026-11-07-002` · by Anton)
  decided (implementation not recorded)
- 2026-11-07 · Sökenheten är paragrafen; högst en passage per paragraf och fyra lagar per svar. (`decision-2026-11-07-003` · by Anton)
  decided (implementation not recorded)
- 2026-11-07 · Allegora byggs som arbetsyta med tråd och lagtextpanel i befintlig design; hastighet och sökning går före nya korpusar. (`decision-2026-11-07-004` · by Anton)
  decided (implementation not recorded)
