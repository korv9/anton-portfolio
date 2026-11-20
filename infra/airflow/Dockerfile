# Airflow for the job ads flow (infra/airflow/README.md). Airflow keeps its own constrained environment;
# the repository's code runs in /opt/portfolio-venv with the repository's own pins, so neither set of
# pins can break the other. The checkout itself is mounted at /opt/portfolio, not copied.
FROM apache/airflow:3.3.2-python3.12

USER root
RUN python -m venv /opt/portfolio-venv && chown -R airflow: /opt/portfolio-venv
USER airflow

COPY requirements.txt /tmp/requirements.txt
# CPU torch only: the flow embeds a few changed texts per run with a small sentence model.
RUN /opt/portfolio-venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt \
 && /opt/portfolio-venv/bin/pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.5.1 \
 && /opt/portfolio-venv/bin/pip install --no-cache-dir sentence-transformers==5.4.1 transformers==5.6.2

# The mounted checkout's packages (src/portfolio, ml), for this environment only, not Airflow's.
RUN printf '/opt/portfolio/src\n/opt/portfolio\n' \
    > /opt/portfolio-venv/lib/python3.12/site-packages/portfolio.pth

ENV PORTFOLIO_ROOT=/opt/portfolio \
    PORTFOLIO_PYTHON=/opt/portfolio-venv/bin/python
