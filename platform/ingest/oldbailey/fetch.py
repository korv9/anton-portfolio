"""Fetch the Old Bailey Online XML release (ORDA, University of Sheffield) into the raw store.

Source: Old Bailey Online XML Data, doi:10.15131/shef.data.4775434.v2, licence CC BY-NC 4.0
(checked on the figshare/ORDA record 2026-10-22; see platform/sources/oldbailey/README.md).
One zip of 2,163 Proceedings sessions and 475 Ordinary's Accounts as TEI-like XML, about 315 MB.

Writes warehouse/raw/oldbailey/OBO_XML_7-2.zip with its URL, time and SHA-256 in _manifest.jsonl,
and ATTRIBUTION.txt beside it: the raw store is a public bucket, and the licence asks for
attribution wherever the files are shared.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))

from rawstore import fetch, session  # noqa: E402

SOURCE = "oldbailey"
URL = "https://ndownloader.figshare.com/files/7979134"
FILE = "OBO_XML_7-2.zip"
ATTRIBUTION = """Old Bailey Online XML Data, version 7.2 (March 2015)
Old Bailey Online project (University of Sheffield, University of Hertfordshire, The Open University)
https://www.oldbaileyonline.org
Deposit: https://doi.org/10.15131/shef.data.4775434.v2 (University of Sheffield ORDA)
Licence: Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)
https://creativecommons.org/licenses/by-nc/4.0/

This work builds on Old Bailey Online, licensed under a Creative Commons
Attribution-NonCommercial 4.0 International License (www.oldbaileyonline.org).
The zip is stored unchanged, as downloaded.
"""


def main() -> None:
    # The release is frozen (v2, 2017), so a verified copy is reused for a year.
    path = fetch(session(), SOURCE, FILE, URL, timeout=1800, max_age_days=365)
    (path.parent / "ATTRIBUTION.txt").write_text(ATTRIBUTION, encoding="utf-8", newline="\n")
    print(f"oldbailey: {path} ({path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
