"""One compact file for the home backdrop and the gallery's debate map: no new clustering.

    python platform/publish/clusters/debate_backdrop.py
    python platform/publish/clusters/debate_backdrop.py --check

Each politics/parliament/sessions/<s>/umap.json holds up to 400 speech chunks with speakers and
excerpts, which those two maps never show. This keeps only each chunk's UMAP position and topic,
as [x, y, topic], in session order. --check fails when the published file differs from its sources.
"""
from __future__ import annotations

import json
from pathlib import Path
import sys

PUBLIC = Path(__file__).resolve().parents[3] / "frontend/public/data"
SESSIONS = PUBLIC / "politics/parliament/sessions"
TARGET = PUBLIC / "politics/parliament/backdrop.json"
# A thousandth of a UMAP unit is far below one pixel of a map about 15 units wide.
DECIMALS = 3


def build() -> bytes:
    sources = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(SESSIONS.glob("*/umap.json"))]
    if not sources:
        raise SystemExit(f"No session maps under {SESSIONS}")
    points = [[round(r["x"], DECIMALS), round(r["y"], DECIMALS), r["topic_id"]]
              for source in sources for r in source["data"]]
    # The sources' own time, so a rerun on unchanged sessions writes the same bytes.
    document = {"schema_version": 1, "generated_at": max(s["generated_at"] for s in sources),
                "source": "politics/parliament/sessions/*/umap.json", "sessions": len(sources),
                "fields": ["x", "y", "topic_id"], "points": points}
    return (json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")


def main() -> int:
    built = build()
    if "--check" in sys.argv[1:]:
        if not TARGET.exists() or TARGET.read_bytes() != built:
            print(f"{TARGET.relative_to(PUBLIC)} is out of date; rerun this script", file=sys.stderr)
            return 1
        return 0
    TARGET.write_bytes(built)
    print(f"{TARGET.relative_to(PUBLIC)}: {len(built):,} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
