"""Fetch the parliament sources, then build and test them.

    python platform/ingest/run_parliament.py              # fetch, then dbt build
    python platform/ingest/run_parliament.py --skip-fetch
    python platform/ingest/run_parliament.py --skip-build

Sources: Riksdagen (roll calls and committee reports since 1993/94, government-formation
news), SCB (elections 1973-2022, the party preference survey) and Valmyndigheten (the latest
election), and government studies (SOU, Ds, Riksrevisionen) with the preparation of every
bill since 2006/07. The build is `dbt build --select tag:parliament`, with the delivered party votes of
recent sessions it is reconciled against.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

PLATFORM = Path(__file__).resolve().parents[1]


def run(arguments: list[str]) -> None:
    print("Running:", " ".join(arguments), flush=True)
    subprocess.run(arguments, cwd=PLATFORM, check=True,
                   env=dict(os.environ, DBT_SEND_ANONYMOUS_USAGE_STATS="false"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--skip-fetch", action="store_true")
    parser.add_argument("--skip-build", action="store_true")
    arguments = parser.parse_args()
    if not arguments.skip_fetch:
        run([sys.executable, "ingest/riksdagen/history_ingest.py"])
        run([sys.executable, "ingest/elections/elections_ingest.py"])
        run([sys.executable, "ingest/riksdagen/studies_ingest.py"])
    if not arguments.skip_build:
        run([sys.executable, "-m", "dbt.cli.main", "build", "--profiles-dir", ".",
             "--select", "tag:parliament", "stg_party_vote", "--target-path", "target/parliament"])


if __name__ == "__main__":
    main()
