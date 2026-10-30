"""Clustering experiments across the portfolio's domains: one run contract, one evaluation, one registry.

Every domain (philosophy, symbolic, jobs, debates) writes runs in the shape `contract.validate`
checks, evaluates them with `evaluate`, and records their status in `registry`. Results reach the
site only through `export`, which writes `frontend/public/data/cluster-experiments/`.
"""
