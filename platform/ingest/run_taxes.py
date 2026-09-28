"""Fetch the tax sources, then build and test them.

    python platform/ingest/run_taxes.py              # fetch, then dbt build
    python platform/ingest/run_taxes.py --skip-fetch
    python platform/ingest/run_taxes.py --skip-build

Sources: OECD Revenue Statistics and Taxing Wages, Skatteverket's municipal tax rates and
withholding tables. The build is `dbt build --select tag:taxes`.
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
        run([sys.executable, "ingest/taxes/taxes_ingest.py"])
    if not arguments.skip_build:
        run([sys.executable, "-m", "dbt.cli.main", "build", "--profiles-dir", ".",
             "--select", "tag:taxes", "--target-path", "target/taxes"])


if __name__ == "__main__":
    main()
