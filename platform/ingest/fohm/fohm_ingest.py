"""Fetch Folkhälsomyndigheten's national public health survey (Hälsa på lika villkor).

Six tables: mental health, general health and social relations, each by county and by age
group. County results are pooled over four survey years (for example `2021-2024`) because
a single year's county sample is too small; age-group results are national and annual.
Every table reports the share, its 95% confidence interval and the number of responses.

Writes PxWeb JSON parts to warehouse/raw/fohm/<table>/.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))

from pxweb import download_table  # noqa: E402
from rawstore import session  # noqa: E402

API = "https://fohm-app.folkhalsomyndigheten.se/Folkhalsodata/api/v1/sv/A_Folkhalsodata/B_HLV"
SOURCE = "fohm"

# dataset name (the source table id) -> folder within B_HLV
TABLES = {
    "hlv1psyxreg": "dPsykhals",
    "hlv1psyaald": "dPsykhals",
    "hlv1allmxreg": "bFyshals/bbaFyshalsallman",
    "hlv1allmaald": "bFyshals/bbaFyshalsallman",
    "hlv1socxreg": "eSocialarel/aSocialarel",
    "hlv1socaald": "eSocialarel/aSocialarel",
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", nargs="*", choices=sorted(TABLES), help="Fetch only these tables")
    args = parser.parse_args()
    http = session()
    for table, folder in TABLES.items():
        if args.only and table not in args.only:
            continue
        parts = download_table(http, SOURCE, table, f"{API}/{folder}/{table}.px", pause=0.5)
        print(f"fohm/{table}: {len(parts)} part(s)")


if __name__ == "__main__":
    main()
