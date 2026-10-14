"""Reject partial or unverified parliament inputs before the tax models build on them.

    python platform/ingest/taxes/require_parliament.py

The tax build is `+tag:taxes`, which includes its parliament parents, so platform/pipeline.yml
runs this first. Restore verified parliament raw data or run the parliament subject before taxes.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

PLATFORM = Path(__file__).resolve().parents[2]
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
                               "or run `python platform/pipeline.py run parliament` before taxes")
        for path in paths:
            match = re.fullmatch(r"(\d{4})(\d{2}|\d{4})(?:-\d+)?", path.name.split(".")[0])
            if not match or match[2] not in {str(int(match[1]) + 1), str(int(match[1]) + 1)[-2:]}:
                raise RuntimeError(f"Invalid parliament upstream filename: {path}")
            session = f"{match[1]}/{match[2]}"
            group = ("studies/preparation/" if preparation else "history/") + match[1] + match[2]
            request = preparation_request(session) if preparation else {"session": session}
            sealed = rawstore.completed_paths("riksdagen", group, request, None)
            if not sealed or path not in sealed:
                raise RuntimeError(f"Incomplete or unverified parliament upstream: {group}; "
                                   "run `python platform/pipeline.py run parliament` before taxes")


if __name__ == "__main__":
    require_parliament()
