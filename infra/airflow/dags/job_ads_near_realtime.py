"""Job ads, near real time by polling: JobStream every ten minutes, then analysis and publication.

Each task runs one stage of platform/job_assistant/realtime.py in the repository checkout (PORTFOLIO_ROOT,
mounted at /opt/portfolio by infra/airflow/docker-compose.yml). The stages keep their own state, so a
retry or the next run continues where the last one stopped; this DAG only schedules them.

- One run at a time (max_active_runs=1) and no catch-up: a late run is followed by the current one,
  not by a backlog, because each collect reads everything since the stored cursor anyway.
- Retries with exponential backoff, and a timeout per task and per run.
- realtime.py also holds a lock file, so a manual run outside Airflow cannot overlap a scheduled one.
- The model is never trained here; job_cluster_candidate trains on its own schedule and promotion
  is manual (python -m ml.jobs.registry promote <run_id>).
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta

from airflow.providers.standard.operators.bash import BashOperator
from airflow.sdk import DAG

ROOT = os.environ.get("PORTFOLIO_ROOT", "/opt/portfolio")
# The repository's own environment, separate from Airflow's (infra/airflow/Dockerfile).
PY = os.environ.get("PORTFOLIO_PYTHON", "python")


def stage(name: str, minutes: int) -> BashOperator:
    return BashOperator(
        task_id=name,
        bash_command=f"cd {ROOT} && {PY} platform/job_assistant/realtime.py {name}",
        execution_timeout=timedelta(minutes=minutes),
    )


with DAG(
    dag_id="job_ads_near_realtime",
    description="JobStream changes every ten minutes: collect, analyse, build, publish",
    schedule="*/10 * * * *",
    start_date=datetime(2026, 11, 1),
    catchup=False,
    max_active_runs=1,
    dagrun_timeout=timedelta(minutes=60),
    default_args={
        "retries": 3,
        "retry_delay": timedelta(minutes=1),
        "retry_exponential_backoff": True,
        "max_retry_delay": timedelta(minutes=8),
    },
    tags=["jobs", "near-real-time"],
) as dag:
    # collect may read several six-hour windows after a pause, one a minute (JobStream's rate limit).
    stage("collect", 30) >> stage("analyse", 20) >> stage("build", 10) >> stage("publish", 10)
