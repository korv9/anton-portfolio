"""Fetch the Commission's AI Act guidance pages into the bronze store.

    python platform/ingest/eu_ai_act/ingest_guidance.py

Each page in sources.GUIDANCE is stored as served, one file per distinct version
(guidance/<id>@<sha12>.html), so an update to a page adds a version and never replaces the
older one. The list itself is copied to guidance/sources.json next to the pages. Titles and
publication dates are read from the pages in silver.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "lib"))

import rawstore  # noqa: E402

from sources import GUIDANCE  # noqa: E402

SOURCE = "eu_ai_act"
PAUSE = 3.0


# The Commission's site answers 403 to GitHub's runners (it serves the same pages elsewhere).
BLOCKING_HOST = "digital-strategy.ec.europa.eu"


def kept(page: dict, error: Exception) -> bool:
    """A 403 from BLOCKING_HOST is not fatal when a stored version of the page exists: that
    version stays current and the refusal is logged as an error line in the fetch log."""
    response = getattr(error, "response", None)
    return (getattr(response, "status_code", None) == 403
            and urlparse(page["url"]).hostname == BLOCKING_HOST
            and any((rawstore.RAW / SOURCE / "guidance").glob(f"{page['id']}@*.html")))


def main() -> int:
    http = rawstore.session()
    failed, refused = [], []
    for page in GUIDANCE:
        relative = f"guidance/{page['id']}.html"
        try:
            rawstore.fetch(http, SOURCE, relative, page["url"],
                           pause=PAUSE, versioned=True, timeout=120)
        except Exception as error:
            if kept(page, error):
                rawstore.record_error(SOURCE, relative, page["url"], error)
                refused.append(page["id"])
                print(f"::warning::{page['id']}: {error}; kept the last stored version", flush=True)
            else:
                failed.append(f"{page['id']}: {error}")
    rawstore.store(SOURCE, "guidance/sources.json",
                   json.dumps(GUIDANCE, ensure_ascii=False, indent=1).encode("utf-8"),
                   url="platform/ingest/eu_ai_act/sources.py", method="LOCAL")
    print(f"Guidance pages attempted: {len(GUIDANCE)}, failures: {len(failed)}, "
          f"refused with the last version kept: {len(refused)}")
    for line in failed:
        print("  failed:", line)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
