"""Fetch SCB's municipality and county boundaries for thematic maps (CC0).

SCB publishes simplified boundaries in SWEREF99 TM, meant for mapping statistics, not for
analysis of exact borders. The zip is stored as fetched under warehouse/raw/geography/ with its
provenance line; platform/publish/sweden/export_similarity.py reads the municipality layer.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))

from rawstore import fetch, session  # noqa: E402

URL = "https://scb.se/contentassets/3443fea3fa6640f7a57ea15d9a372d33/shape_svenska_260225.zip"


def main() -> None:
    path = fetch(session(), "geography", "scb_boundaries_shape.zip", URL, max_age_days=30)
    print(f"geography: {path}")


if __name__ == "__main__":
    main()
