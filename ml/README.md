# ml

Models trained on the delivered data, each with a model card in `cards/` that records what
the label means, how the data were split, what the model beat and what it cannot support.
The design is in [docs/plans/ml-layer-plan.md](../docs/plans/ml-layer-plan.md).

| Task | Input | Split | Headline |
|---|---|---|---|
| `policy_area` | issue-debate speeches labelled by committee | temporal (last session held out), no debate on both sides | KB-BERT against TF-IDF, paired |
| `polarization` | speeches with a party, per session | grouped by the Riksdag's person id | mean pairwise party AUC |
| `seniority` | JobTech adverts, title removed | grouped by employer | AUC and calibrated junior share |

## Running

```bash
python -m venv ml/.venv && ml/.venv/bin/pip install -r ml/requirements.txt
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

Output lands in `ml/runs/<run_id>/`, which is gitignored along with caches and weights. Only
the cards are committed. Nothing reaches the site without a deliberate promotion of a
passing run.
