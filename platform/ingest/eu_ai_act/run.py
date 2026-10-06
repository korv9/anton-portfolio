"""Fetch every AI Act source: Cellar (the acts) and the Commission's guidance pages.

    python platform/ingest/eu_ai_act/run.py

Safe to run on a schedule: unchanged texts are not rewritten, changed pages and Cellar answers
are kept as new versions, and the requests are few and spaced out.
"""
from __future__ import annotations

import sys

import ingest_cellar
import ingest_guidance

if __name__ == "__main__":
    sys.exit(max(ingest_cellar.main(), ingest_guidance.main()))
