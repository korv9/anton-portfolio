"""SWEDEN B, The Ideal Human: the manual-coding sample that checks what the patterns match.

    python platform/publish/sweden/language_coding.py draw --out coding.csv
    python platform/publish/sweden/language_coding.py score coding.csv

`draw` takes, per category and period (2006-2012 and 2019-2025), the PER matches with the
lowest seeded hash of the ad text from the coding_*.parquet pools that ad_language.py writes
(seed 20261021; the same draw on every machine). Matches near contact details are skipped.
Readers fill `reader_1` and `reader_2` with 1 when the matched words, read in their context,
mean what the category names, and 0 when they do not (a company name, another sense of the
word, a heading). `score` reports per category and period the precision (share coded 1 by
reader 1) with a Wilson 95 % interval, and Cohen's kappa between the two readers.

The sample measures precision only. Recall needs a sample of texts the patterns did not match.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
FEATURES = Path(os.environ.get("PORTFOLIO_FEATURES", ROOT / "warehouse/features"))
PER = 17
PERIODS = {"2006-2012": range(2006, 2013), "2019-2025": range(2019, 2026)}
# As export_language.py: names of contact people sit next to these words.
CONTACT = re.compile(r"kontakt|frågor|ring |nås |mejla|\[e-post\]|\[telefon\]|contact|questions", re.I)
COLUMNS = ["sample_id", "category", "subterm", "period", "year", "archive", "field", "employer_type",
           "headline", "matched", "context", "reader_1", "reader_2"]


def period(year: str) -> str | None:
    return next((p for p, years in PERIODS.items() if year.isdigit() and int(year) in years), None)


def draw(rows: list[dict]) -> list[dict]:
    """The PER lowest-ranked usable matches per category and period, in a stable order."""
    pools: dict = {}
    for r in rows:
        p = period(str(r["year"]))
        if p and not CONTACT.search(r["context"] or ""):
            pools.setdefault((r["category"], p), []).append(r)
    out = []
    for (category, p), pool in sorted(pools.items()):
        # A text counted in two archives (ads near a year boundary) is drawn once.
        unique = {r["rank"]: r for r in pool}
        for r in sorted(unique.values(), key=lambda r: r["rank"])[:PER]:
            out.append({**{k: r.get(k) for k in COLUMNS if k in r}, "period": p,
                        "sample_id": f"{category}-{p[:4]}-{len(out) + 1:03d}", "reader_1": "", "reader_2": ""})
    return out


def wilson(k: int, n: int, z: float = 1.959964) -> tuple[float, float] | None:
    if not n:
        return None
    p = k / n
    centre = (p + z * z / (2 * n)) / (1 + z * z / n)
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return round(centre - half, 3), round(centre + half, 3)


def kappa(a: list[int], b: list[int]) -> float | None:
    """Cohen's kappa for two readers' 0/1 codes of the same items."""
    n = len(a)
    if not n or n != len(b):
        return None
    observed = sum(x == y for x, y in zip(a, b)) / n
    pa, pb = sum(a) / n, sum(b) / n
    expected = pa * pb + (1 - pa) * (1 - pb)
    return None if expected == 1 else round((observed - expected) / (1 - expected), 3)


def score(rows: list[dict]) -> dict:
    groups: dict = {}
    for r in rows:
        if r["reader_1"] in ("0", "1"):
            groups.setdefault((r["category"], r["period"]), []).append(r)
    out = []
    for (category, p), coded in sorted(groups.items()):
        one = [int(r["reader_1"]) for r in coded]
        both = [(int(r["reader_1"]), int(r["reader_2"])) for r in coded if r["reader_2"] in ("0", "1")]
        out.append({"category": category, "period": p, "n": len(one), "precision": round(sum(one) / len(one), 3),
                    "interval": wilson(sum(one), len(one)), "n_both": len(both),
                    "kappa": kappa([x for x, _ in both], [y for _, y in both]) if both else None})
    return {"seed": 20261021, "per_category_and_period": PER, "rows": out}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="action", required=True)
    sub.add_parser("draw").add_argument("--out", type=Path, required=True)
    sub.add_parser("score").add_argument("coded", type=Path)
    args = parser.parse_args()
    if args.action == "draw":
        import duckdb

        pools = (FEATURES / "sweden/ad_language/coding_*.parquet").as_posix()
        table = duckdb.sql(f"select * from read_parquet('{pools}', union_by_name = true)")
        rows = [dict(zip(table.columns, r)) for r in table.fetchall()]
        sample = draw(rows)
        with args.out.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, COLUMNS, lineterminator="\n")
            writer.writeheader()
            writer.writerows(sample)
        print(f"{len(sample)} matches drawn -> {args.out}")
        return 0
    with args.coded.open(encoding="utf-8") as handle:
        print(json.dumps(score(list(csv.DictReader(handle))), indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
