"""Fetch Försäkringskassan's sickness-insurance statistics.

Each dataset has a `meta.json` (dimension codes and labels) and one JSON file per table:
a list of `{"dimensions": {...}, "observations": {measure: {"value", "rojd"}}}` records,
where `rojd` marks a value suppressed for disclosure control. Tables:

- Sjukpenningtal 2.0 (sick-pay days per insured person), monthly by county, municipality,
  age group and sex, from 2021.
- Started sick-leave cases by ICD-10 diagnosis chapter, monthly and national, from 2006.
  Chapter F00-F99 is psychiatric.
- Started sick-leave cases for stress-related disorders (F43), monthly by county, from 2006.
- Ongoing sick-leave cases by county and age group, monthly, from 1994.

Tables are stored gzip-compressed; the largest is about 135 MB uncompressed.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))

from rawstore import fetch, session  # noqa: E402

API = "https://www.forsakringskassan.se/api/sprstatistikrapportera/public/v1"
SOURCE = "fk"

# dataset key -> table name within it
DATASETS = {
    "ohm-sjptal-tvanoll": "SJPT2",
    "sjp-startade-diagnos": "SJPStartadeSjukfallDiagnos",
    "sjp-startade-diagnos-f43": "SJPStartadeSjukfallF43",
    "sjp-pagaende-sjukfall-diagnos-alder-langd": "SJPPagSjukfallAlder",
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", nargs="*", choices=sorted(DATASETS), help="Fetch only these datasets")
    args = parser.parse_args()
    http = session()
    for dataset, table in DATASETS.items():
        if args.only and dataset not in args.only:
            continue
        fetch(http, SOURCE, f"{dataset}/meta.json", f"{API}/{dataset}/meta.json", pause=1)
        path = fetch(http, SOURCE, f"{dataset}/{table}.json.gz", f"{API}/{dataset}/{table}.json",
                     pause=1, timeout=600)
        print(f"fk/{dataset}: {path.stat().st_size / 1e6:.1f} MB stored")


if __name__ == "__main__":
    main()
