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

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "lib"))

import rawstore  # noqa: E402

from sources import GUIDANCE  # noqa: E402

SOURCE = "eu_ai_act"
PAUSE = 3.0


def main() -> int:
    http = rawstore.session()
    failed = []
    for page in GUIDANCE:
        try:
            rawstore.fetch(http, SOURCE, f"guidance/{page['id']}.html", page["url"],
                           pause=PAUSE, versioned=True, timeout=120)
        except Exception as error:
            failed.append(f"{page['id']}: {error}")
    rawstore.store(SOURCE, "guidance/sources.json",
                   json.dumps(GUIDANCE, ensure_ascii=False, indent=1).encode("utf-8"),
                   url="platform/ingest/eu_ai_act/sources.py", method="LOCAL")
    print(f"Guidance pages attempted: {len(GUIDANCE)}, failures: {len(failed)}")
    for line in failed:
        print("  failed:", line)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
