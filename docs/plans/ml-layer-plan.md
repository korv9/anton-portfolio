# ML/NLP layer, SOU ingestion and the politics dbt migration — Phase 0

Status: **awaiting approval**. No model code written.
Recon date: 2026-09-25. Every number below was measured, not assumed.

---

## 1. What the recon changes

Four findings shape the plan.

1. **Model 1's label is not free, but it is reachable.** Issue-debate sections carry only
   `debate_title` and `debate_kind` — no committee. Joining the title to
   `fact_decision_point.title` gives an unambiguous committee for **473 of 618 sections
   (77%), covering 9,904 speeches across 16 committees**. That is enough to fine-tune, but
   it only exists for 2024/25 and 2025/26, because decision points exist only for those two.
2. **The SOU `summary` field is unusable.** It is OCR'd cover matter, not an abstract:
   `"sou 2020 83 d2\n Havet och människan\n Volym 2\n Delbetänkande av..."`. Model 3 must
   extract the *Sammanfattning* chapter from the full text.
3. **The GPU is the binding constraint.** A GTX 1660 SUPER has 6 GB and no tensor cores, so
   fp16 buys nothing. KB-BERT base fine-tuning is fine; 33 per-session transformer models
   are not. Section 6 scopes around it.
4. **Disk is tighter than the GPU.** 71 GB free of 466. The Språkbanken SOU corpus is 5.09 GB
   compressed and far larger unpacked; Riksdagen's 4,948 SOU documents as text are a fraction
   of that and carry the metadata we need. Recommendation: use Riksdagen, and treat
   Språkbanken as an optional enrichment later.

Already done, since it only executed the gate decision you made: the WASM engine is out,
Parquet stays as a data product, bundle back to 340.7 kB, 24 browser tests pass.

---

## 2. Hardware and data

| | |
|---|---|
| GPU | GTX 1660 SUPER, 6 GB, compute 7.5, no tensor cores |
| CPU / RAM | 12 cores / 16 GB |
| Disk | 71 GB free of 466 GB |
| Stack present | torch 2.5.1+cu121, transformers 5.6.2, duckdb 1.5.5, pyarrow 23 |
| Models reachable | `KB/bert-base-swedish-cased`, `KBLab/sentence-bert-swedish-cased`, `intfloat/multilingual-e5-base` |

| Input | Volume | State |
|---|---|---|
| Speeches with party label | 135,556 across 33 sessions | ready |
| Issue-debate passages with committee | 9,904 across 16 classes, 2 sessions | ready via title join |
| Job advertisement text | `history.duckdb`, 1.08 GB | ready, must never be committed |
| SOU | 4,948 documents from 1867 | **not ingested** |
| Member votes | 501,164 rows, 0.87 MB Parquet | ready |

---

## 3. Order of work

The ML layer depends on the other two, so they come first.

| # | Workstream | Why it is first |
|---|---|---|
| A | SOU ingestion | Model 3 has no input without it |
| B | Politics into dbt | Models read silver/gold tables, not sixteen legacy scripts |
| C | `ml/` skeleton + overnight runner | Needed before any model is worth writing |
| D | Models 1, 2, 4 | Independent of SOU |
| E | Model 3 | Needs A |

A and B can run in either order; B is larger.

---

## 4. A — SOU ingestion

`platform/ingest/riksdagen/sou_ingest.py`, following the six steps in `platform/README.md`.

- **Fetch** the `doktyp=sou` document list, then each document's `.text`, into
  `warehouse/raw/sou/`. Watermark on `datum` so reruns are incremental. Record URL, fetch
  date and SHA-256 per file.
- **Parse** `SOU YYYY:NN` from `beteckning` and `rm`, with a normaliser covering
  `SOU 2020:55`, `SOU 2020: 55`, `SOU:2020:55`, `(SOU 2020:55)`.
- **Extract the summary** by locating the *Sammanfattning* heading and taking to the next
  chapter heading. Record `summary_found` per document; a missing summary is a coverage gap,
  never a silent fallback to cover text.
- **Models**: `bronze/politics/stg_sou`, `silver/shared/dim_document`, `gold/politics/fct_sou_section`.
- **Deliver**: metadata as Parquet, full text as shards, both catalogued.

Licence: Riksdagen open data. If Språkbanken is added later its CC-BY-4.0 attribution must
appear wherever its text is shown.

Acceptance: `SOU 2020:55` resolves to *Innovation genom information*, `dok_id` H8B355; the
count per year is reported and years with no documents appear as gaps.

---

## 5. B — Politics into dbt

Strangler, one subject at a time, each with a reconciliation test asserting the delivered
JSON is byte-identical to what `legacy/` produces before the old script is deleted.

| Order | Subject | Legacy source | Why this order |
|---|---|---|---|
| 1 | Budget | `build_budget_context`, `politics_budget` | Smallest, and the 127,707 / 133,393 fixture is an exact gate |
| 2 | Votes and decisions | part of `build_gold` | Largest volume, clearest schema |
| 3 | Speeches and debates | `build_speech_browser` | Feeds models 1 and 2 |
| 4 | Language and UMAP | part of `build_gold` | Most bespoke, least gained |

`build_gold.py` is 450 lines producing 31 tables; it is retired table by table, not at once.
`legacy/` empties as this proceeds, which is the point of the directory being named that.

---

## 6. C — The `ml/` folder

Self-contained. Its own virtual environment, its own dependency set, and no import path from
the site or the platform. It reads delivered data through a thin adapter and writes only to
`ml/runs/`.

```
ml/
  requirements.txt        torch, transformers, sentence-transformers, umap-learn,
                          hdbscan, scikit-learn, pandas, duckdb
  mlkit/
    overnight.py          the queue runner
    config.py             one dataclass per task, hashed into the cache key
    data.py               loaders: warehouse tables and delivered Parquet
    splits.py             grouped and temporal splits, plus leakage assertions
    metrics.py            cluster bootstrap CIs, permutation tests
    cards.py              model card writer
    tasks/
      policy_area.py  polarization.py  sou_map.py  seniority.py
  runs/                   gitignored: checkpoints, metrics, predictions, reports
  cards/                  committed: one model card per promoted run
```

**`python -m mlkit.overnight`** walks a declared job list and for each job:

- computes a cache key from config plus input hashes, and **skips unchanged jobs**;
- checkpoints after every epoch and resumes from the last one;
- falls back to CPU on any CUDA error, with the fallback recorded in the run metadata;
- catches a failing job, records the traceback and continues to the next;
- writes `ml/runs/<run_id>/report.md` at the end — per task: metric, baseline, delta, CI,
  gate pass or fail, wall time, and whether it ran on GPU.

`run_id` is a hash of the job set and input hashes, so a rerun that changes nothing produces
the same id and does no work.

**Never committed**: weights, checkpoints, caches, embeddings, raw job-advertisement text.
`ml/runs/` and the model cache go in `.gitignore`. Model cards, metrics JSON and the report
are committed, because they are the evidence.

**Nothing reaches the site** without passing its gate and an explicit `promote <run_id>`,
which copies the aggregate output into the delivery path and records the run id in the
catalogue. There is no automatic path from a run to `frontend/public/data/`.

---

## 7. The four models

Common rules: grouped or temporal splits only, with an assertion that no group appears in
two folds; every model reported against its baselines; 95% CIs by cluster bootstrap over the
grouping unit; aggregates only, never per-person output.

### 1. Policy area

Train on issue-debate passages with committee as label, apply to party-leader debates.

- **Labels**: 9,904 passages, 16 committees, from the title join. Sections whose title does
  not match are excluded and counted, not guessed.
- **Split**: grouped by `section_id`, so no debate spans folds. Temporal holdout on 2025/26.
- **Baselines**: the existing exact and Swedish-stem keyword methods, then TF-IDF + logistic
  regression. **Main**: KB-BERT fine-tuned, max_len 256, batch 16, 3 epochs.
- **Gate**: macro-F1 must beat TF-IDF by more than the CI width, and must beat the keyword
  methods outright.
- **Output**: a new `method` in `fact_language_area`, alongside the existing ones, never
  replacing them.
- **Honest limitation for the card**: committee is a proxy for policy area, not the thing
  itself, and the label exists for two sessions only. Applying it to 33 sessions of
  party-leader debate is a transfer whose error is unmeasured. The card must say so.

*Estimated: 35 min on GPU.*

### 2. Polarization

- **Design**: party classifier per session; headline is **mean pairwise AUC with CIs**.
- **Controls**: equal passages per party, split by speaker so no speaker crosses folds, and
  a permutation test with shuffled party labels as the null.
- **Reported alongside**: government versus opposition role, and topic controls, because
  rising separability may be a change in who speaks about what rather than in how they speak.
- **Scoping, and this needs your call.** 33 sessions × KB-BERT is roughly 18–20 hours on this
  GPU — one full night for one model. I propose TF-IDF + linear as the main estimator across
  all 33 sessions, with KB-BERT on six sessions to show the two agree on direction. If they
  disagree, that is a finding worth reporting, not a failure.

*Estimated: 40 min TF-IDF for all sessions, plus 3.5 h for six KB-BERT sessions.*

### 3. SOU map

- **Embeddings**: compare `KBLab/sentence-bert-swedish-cased` against
  `intfloat/multilingual-e5-base` on the extracted summaries.
- **Then**: UMAP to 5 dimensions, HDBSCAN, c-TF-IDF keywords per cluster.
- **Stability**: 5 seeds, reporting adjusted Rand index between seeds. Clusters that do not
  survive reseeding are not shown.
- **Output**: cluster share per year.
- **Blocked on A.** Also blocked on the summary extraction working: if *Sammanfattning*
  cannot be located reliably, the honest fallback is title plus the first section, clearly
  labelled, not silent truncation of cover text.

*Estimated: 50 min for both embedding models plus clustering.*

### 4. Seniority

- **Input**: advertisement text with the title removed, because the title is what the current
  rule-based method already keys on and leaving it in leaks the label.
- **Split**: grouped by employer. Large employers repeat near-identical adverts, so a random
  split would memorise them.
- **Estimate**: junior share from **calibrated probabilities**, not from counting predicted
  labels. Isotonic calibration on a held-out fold, reported with a reliability curve.
- **Baseline**: the existing title-pattern rule.
- **Constraint**: raw advertisement text never leaves `warehouse/` and is never committed.
  Only aggregates are delivered.

*Estimated: 25 min.*

**Total: about 6 hours**, which fits one night with room for retries.

---

## 8. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Committee is a proxy for policy area; the card could overclaim | Gate on beating baselines, and state the proxy plainly in the card and on the site |
| R2 | Model 1's labels cover 2 sessions; applying to 33 is unmeasured transfer | Report per-session confidence distribution; flag sessions where it collapses |
| R3 | Polarization can rise because topics changed, not language | Topic control reported beside the headline, permutation test as the null |
| R4 | 6 GB VRAM out-of-memory mid-run | Batch 16 at seq 256 fits with room; CPU fallback and per-epoch checkpoints |
| R5 | 71 GB disk, and caches grow silently | Riksdagen instead of the Språkbanken corpus; a disk check aborts the queue below 15 GB |
| R6 | Job-advert text leaking into git | `ml/runs/` and caches gitignored; a test asserts no delivered file contains advert text |
| R7 | Summary extraction fails on older SOUs | Coverage reported per year; a labelled fallback, never a silent one |
| R8 | dbt migration changes a delivered value | Byte-identical reconciliation before any legacy script is deleted |

---

## 9. Questions

1. **Polarization scope** (Section 7.2): TF-IDF across all 33 sessions plus KB-BERT on six, or
   KB-BERT everywhere across two nights? I recommend the former.
2. **SOU source**: Riksdagen only for now, with Språkbanken as later enrichment? Disk says yes.
3. **Order of A and B**: SOU first unblocks model 3 sooner; dbt first pays off in everything
   afterwards. I lean dbt first, but it delays model 3 by a day.
4. **Promotion surface**: should `promote <run_id>` be a command in `mlkit`, or a manual copy
   step you run? I lean a command that refuses unless every gate passed.

---

## 10. What I will do on approval

C first — the skeleton and the runner, with one trivial job end to end to prove caching,
checkpointing, CPU fallback and the morning report. Then the models in the order above.
I will run `python -m mlkit.overnight` once the models are in place, without asking again.
