# ml

The analysis and ML layer. It reads the warehouse and the delivered data, and writes features
under `warehouse/features/` or runs under `ml/runs/` (both gitignored). Results reach the site
only through a pipeline export step in `platform/publish/`, never directly from here. Run every
module from the repository root.

## Packages

| Package | What it does | Entry point | Documentation |
|---|---|---|---|
| `mlkit/` | Supervised tasks with model cards in `cards/`: `policy_area`, `polarization`, `seniority` | `python -m ml.mlkit.overnight` | The cards |
| `jobs/` | Unsupervised clustering of Swedish software and data job ads | `python -m ml.jobs.pipeline`, `sweep`, `feature_experiment` | [job-market clustering](../docs/job-market-clustering.md), [sweep](../docs/job-clustering-sweep.md), [ensemble](../docs/job-clustering-ensemble.md) |
| `cluster_lab/` | Local, configuration-driven clustering experiments; never promotes results | `python -m ml.cluster_lab.cli` | [its README](cluster_lab/README.md) |
| `research/` | Consensus subject groups in debates and philosophy, county profiles, the debate passages for Workers AI | `python -m ml.research.consensus`, `topics`, `export_workers_ai` | [public clustering](../docs/public-clustering-method.md), [Workers AI](../docs/workers-ai.md) |
| `feature_study/` | Engineered features against the plain baseline, scored with one validation | `python -m ml.feature_study.job_ads` and siblings | [feature engineering](../docs/ml-feature-engineering.md) |
| `ai_act/` | Monthly counts of the AI Act's own terms in Riksdag speeches and job ads | `python -m ml.ai_act.diffusion speeches\|ads` | [pre-registration](../docs/ai-act-diffusion-preregistration.md) |
| `futures_topics/` | Topic pilot on future-marked sentences (Riksdag, DiVA) | `python -m ml.futures_topics.sentences`, `cluster`, `analyze` | [pre-registration](../docs/sweden-futures-topics-preregistration.md) |
| `moral/` | Moral-foundation tagger, eMFD baseline, ETHICS check, Riksdag passages | `python -m ml.moral.mfrc`, `ethics`, `riksdag` | [pre-registration](../docs/philosophy-moral-preregistration.md) |
| `oldbailey/` | Offence, verdict and punishment read by gemma on Workers AI, scored against hand tags | `python -m ml.oldbailey.trials`, `extract`, `score` | [pre-registration](../docs/oldbailey-extraction-preregistration.md) |
| `three_swedens.py` | Whether social, job-ad and vote similarity of municipalities agree | `python -m ml.three_swedens` (pipeline subject `clusters`) | [pre-registration](../docs/sweden-three-spaces-preregistration.md) |

Pre-registered modules follow their document: unit, sample, metric and stop rule are fixed
there, and a change is a dated amendment in that document.

## Environment

```bash
python -m venv ml/.venv --system-site-packages
ml/.venv/Scripts/python.exe -m pip install -r ml/requirements.txt   # ml/.venv/bin/python on Linux
```

`--system-site-packages` reuses torch from the parent interpreter, so the environment does not
download it a second time.

## mlkit

```bash
cd ml
.venv/bin/python -m mlkit.overnight                    # every job; unchanged ones are cached
.venv/bin/python -m mlkit.overnight --only seniority
.venv/bin/python -m mlkit.overnight --no-transformers  # without a GPU
```

- Speech shards are fetched from object storage once and cached in `ml/.cache/` (about
  740 MB).
- `seniority` reads `warehouse/jobtech/history.duckdb`, which
  `platform/ingest/jobtech/run_history_pipeline.py` builds. You can also build only what
  the model needs: `dbt build --select +int_job_ads_enriched` with `PORTFOLIO_DB` pointing
  at that file. `ML_JOBS_DB` overrides the path.
- KB-BERT fine-tuning takes 8–10 s per batch on four CPU cores, which is about nine hours
  for `policy_area`. Without a GPU, use `--no-transformers`:
  - `policy_area` then reports its baselines with status `partial` and leaves its card
    alone, because its headline and gate need KB-BERT.
  - `polarization` writes its card and states that the KB-BERT cross-check was not run.

Output lands in `ml/runs/<run_id>/`. Only the cards are committed. Nothing reaches the site
without a deliberate promotion of a passing run (`mlkit/promote.py`).

## Tests

```bash
python -m pytest ml/tests ml/jobs/tests -q
```

These tests are not part of `npm run verify:full` or the CI Python job, which run
`platform/tests` only.
