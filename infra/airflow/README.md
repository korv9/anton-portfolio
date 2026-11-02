# Airflow for the job ads

Airflow schedules the job assistant's ads near real time by polling: every ten minutes it reads the
changes JobStream has since the last stored cursor, analyses the new and changed ads with the current
model and checks the publication files. The design, the measurements and the steps left for
continuous operation are in [docs/job-ads-airflow.md](../../docs/job-ads-airflow.md).

| DAG | Schedule | Does |
|---|---|---|
| `job_ads_near_realtime` | `*/10 * * * *` | `collect` > `analyse` > `build` > `publish`, each one stage of `platform/job_assistant/realtime.py` |
| `job_cluster_candidate` | Sundays 03:17 | trains a candidate with `ml.jobs.pipeline` and runs the promotion gate; never promotes |

## Start locally

Needs Docker with Compose v2 and about 6 GB of disk for the image. From the repository root:

```bash
docker compose -f infra/airflow/docker-compose.yml build
```

```bash
docker compose -f infra/airflow/docker-compose.yml up -d
```

Open http://localhost:8080, unpause `job_ads_near_realtime`, and follow the runs there. Both DAGs
start paused. On Linux, set `AIRFLOW_UID=$(id -u)` in `infra/airflow/.env` first, so the files the
tasks write in the checkout belong to you.

Stop without losing the run history (it is in the `airflow-db` volume):

```bash
docker compose -f infra/airflow/docker-compose.yml down
```

`down -v` also deletes the metadata volume. The ad store, its cursor and the stage state are files in
the checkout (`warehouse/raw/job_assistant/`), so they survive either way.

## Settings

Put these in `infra/airflow/.env` (ignored by Git):

| Variable | Default | Meaning |
|---|---|---|
| `JOB_STREAM_OVERLAP_MINUTES` | `10` | how far before the cursor each read starts |
| `JOB_ADS_PUBLISH` | `local` | `local` checks the files only; `r2` uploads them with `release.py` |
| `AIRFLOW_JWT_SECRET` | a local placeholder | set a random value for anything beyond your own machine |
| `AIRFLOW_UID` | `50000` | the user the tasks write files as |

`JOB_ADS_PUBLISH=r2` also needs the R2 secrets that `release.py` reads, and `rank.py` needs
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for its Workers AI part (without them it ranks
by rules and cached vectors).

## Only one scheduler

The hourly GitHub workflow `refresh-job-assistant.yml` writes the same store and release group. Before
publishing from Airflow with `r2`, set the repository variable `JOB_ADS_SCHEDULER` to `airflow`;
that workflow then skips its runs. Within one machine, `realtime.py` holds
`warehouse/raw/job_assistant/pipeline.lock`, so a manual run cannot overlap a scheduled one.

## Run a stage by hand

```bash
python platform/job_assistant/realtime.py status
```

The stages are `collect`, `analyse`, `build` and `publish`. A stage whose input has not changed
since it last succeeded reports `skipped`.

## Models

```bash
python -m ml.jobs.registry show
```

`evaluate <run_id>` runs the gate, `promote <run_id>` promotes a run that passes it, and `rollback`
returns to the model promoted before. The register is `ml/jobs/registry.json`; commit it after a
promotion or rollback.
