"""Fetch every welfare source into the bronze store, then build and test the models.

    python platform/ingest/run_welfare.py            # fetch all five sources, then dbt build
    python platform/ingest/run_welfare.py --skip-fetch
    python platform/ingest/run_welfare.py --only scb fk

Each source's fetch is independent; a failing source stops the run before dbt, so the
warehouse never builds from a partly refreshed bronze layer.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

PLATFORM = Path(__file__).resolve().parents[1]
SOURCES = {
    "scb": "ingest/scb/scb_ingest.py",
    "fohm": "ingest/fohm/fohm_ingest.py",
    "fk": "ingest/fk/fk_ingest.py",
    "ess": "ingest/ess/ess_ingest.py",
    "kolada": "ingest/kolada/kolada_ingest.py",
}


def run(arguments: list[str]) -> None:
    print("Running:", " ".join(arguments), flush=True)
    subprocess.run(arguments, cwd=PLATFORM, check=True,
                   env=dict(os.environ, DBT_SEND_ANONYMOUS_USAGE_STATS="false"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", nargs="*", choices=sorted(SOURCES), help="Fetch only these sources")
    parser.add_argument("--skip-fetch", action="store_true", help="Build from the bronze files already on disk")
    parser.add_argument("--skip-build", action="store_true", help="Fetch only")
    args = parser.parse_args()
    if not args.skip_fetch:
        for source, script in SOURCES.items():
            if not args.only or source in args.only:
                run([sys.executable, script])
    if not args.skip_build:
        run([sys.executable, "-m", "dbt.cli.main", "build", "--profiles-dir", ".",
             "--select", "tag:welfare"])


if __name__ == "__main__":
    main()
