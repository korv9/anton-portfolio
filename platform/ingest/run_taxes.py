"""Fetch the tax sources, then build and test them.

    python platform/ingest/run_taxes.py              # fetch, then dbt build
    python platform/ingest/run_taxes.py --skip-fetch
    python platform/ingest/run_taxes.py --skip-build

Sources: OECD Revenue Statistics and Taxing Wages, Skatteverket's municipal tax rates and
withholding tables. Restore verified parliament raw data or run run_parliament.py first.
The build is `dbt build --select +tag:taxes`, including its parliament parents and seeds.
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

PLATFORM = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PLATFORM / "lib"))
sys.path.insert(0, str(PLATFORM / "ingest/riksdagen"))
import rawstore  # noqa: E402
from studies_ingest import preparation_request  # noqa: E402


def require_parliament() -> None:
    """Reject partial or unverified inputs before dbt can consume them as a delivery."""
    base = rawstore.RAW / "riksdagen"
    for pattern, preparation in (("studies/preparation/*.jsonl.gz", True),
                                 ("votes/*.csv.gz", False), ("reports/*.json", False)):
        paths = list(base.glob(pattern))
        if not paths:
            raise RuntimeError(f"Missing parliament upstream: {pattern}; restore verified raw data "
                               "or run platform/ingest/run_parliament.py before taxes")
        for path in paths:
            match = re.fullmatch(r"(\d{4})(\d{2})(?:-\d+)?", path.name.split(".")[0])
            if not match:
                raise RuntimeError(f"Invalid parliament upstream filename: {path}")
            session = f"{match[1]}/{match[2]}"
            group = ("studies/preparation/" if preparation else "history/") + match[1] + match[2]
            request = preparation_request(session) if preparation else {"session": session}
            sealed = rawstore.completed_paths("riksdagen", group, request, None)
            if not sealed or path not in sealed:
                raise RuntimeError(f"Incomplete or unverified parliament upstream: {group}; "
                                   "run platform/ingest/run_parliament.py before taxes")


def run(arguments: list[str]) -> None:
    print("Running:", " ".join(arguments), flush=True)
    subprocess.run(arguments, cwd=PLATFORM, check=True,
                   env=dict(os.environ, DBT_SEND_ANONYMOUS_USAGE_STATS="false"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--skip-fetch", action="store_true")
    parser.add_argument("--full-refresh", "--force", action="store_true",
                        help="Refetch verified historical data as well as current data")
    parser.add_argument("--skip-build", action="store_true")
    arguments = parser.parse_args()
    if arguments.full_refresh:
        os.environ["PORTFOLIO_FULL_REFRESH"] = "1"
    if not arguments.skip_build:
        require_parliament()
    if not arguments.skip_fetch:
        run([sys.executable, "ingest/taxes/taxes_ingest.py"])
    if not arguments.skip_build:
        run([sys.executable, "-m", "dbt.cli.main", "build", "--profiles-dir", ".",
             "--select", "+tag:taxes", "--target-path", "target/taxes"])


if __name__ == "__main__":
    main()
