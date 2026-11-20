"""Train a candidate job cluster model weekly, and run the promotion gate on it. Never promotes.

ml.jobs.pipeline fits a new run from the job history warehouse (ML_JOBS_DB, by default
warehouse/jobtech/history.duckdb, built by platform/ingest/jobtech/run_history_pipeline.py) into
warehouse/ml/jobs/runs/<run_id>. The gate (ml.jobs.registry evaluate) is reported; promotion and
rollback stay manual: python -m ml.jobs.registry promote <run_id> | rollback.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta

from airflow.providers.standard.operators.bash import BashOperator
from airflow.sdk import DAG

ROOT = os.environ.get("PORTFOLIO_ROOT", "/opt/portfolio")
# The repository's own environment, separate from Airflow's (infra/airflow/Dockerfile).
PY = os.environ.get("PORTFOLIO_PYTHON", "python")

with DAG(
    dag_id="job_cluster_candidate",
    description="Weekly candidate clustering run and its gate; promotion is manual",
    schedule="17 3 * * 0",
    start_date=datetime(2026, 11, 1),
    catchup=False,
    max_active_runs=1,
    default_args={"retries": 1, "retry_delay": timedelta(minutes=10)},
    tags=["jobs", "ml"],
) as dag:
    train = BashOperator(
        task_id="train_candidate",
        bash_command=f"cd {ROOT} && {PY} -m ml.jobs.pipeline",
        execution_timeout=timedelta(hours=3),
    )
    gate = BashOperator(
        task_id="gate",
        # The newest run folder is the candidate just trained.
        bash_command=f"cd {ROOT} && {PY} -m ml.jobs.registry evaluate "
                     f"$(ls -t warehouse/ml/jobs/runs | head -1)",
        execution_timeout=timedelta(minutes=20),
    )
    train >> gate
