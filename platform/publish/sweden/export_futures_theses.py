"""SWEDEN E, the DiVA 2024-25 jump taken apart, from gold.mart_sweden_future_theses_detail (record
months 2019-01 onward, counted by platform/ingest/diva/futures_theses_detail.py).

`jump(rows, years)` returns, per publication year, the future share, the part left once the
research alternative ("framtida forskning", "forskning i framtiden") is dropped, the part left once
the long-term alternative ("långsiktig", "på lång sikt") is dropped as well, and the share of
abstracts using each alternative; and a shift-share of the change from the three years before the
last two to the last two, by degree level, HSV subject area and institution. Called by
export_futures.py.
"""
from __future__ import annotations

from collections import defaultdict

ALTERNATIVES = ["research", "framtiden", "framtida", "framtid_compound", "long_term", "vision", "other"]
COLUMNS = ["year", "level", "area", "institution", "abstracts", "future_abstracts", "future_without_research",
           "future_without_research_long_term",
           *[f"using_{a}" for a in ALTERNATIVES]]
# A cell enters the shift-share only with at least this many abstracts in each period.
MIN_CELL = 100


def shift_share(cells: dict, a: list[int], b: list[int]) -> dict:
    """Change in the future share between periods a and b over cells present in both: composition
    (the cell mix moved), within (the cells' own shares moved) and interaction; they add up to the
    change over the kept cells."""
    per = {}
    for key, by_year in cells.items():
        n = [sum(by_year.get(y, (0, 0))[0] for y in p) for p in (a, b)]
        f = [sum(by_year.get(y, (0, 0))[1] for y in p) for p in (a, b)]
        if min(n) >= MIN_CELL:
            per[key] = (n, [f[0] / n[0], f[1] / n[1]])
    total = [sum(v[0][i] for v in per.values()) for i in (0, 1)]
    w = {k: [v[0][0] / total[0], v[0][1] / total[1]] for k, v in per.items()}
    s = {k: v[1] for k, v in per.items()}
    parts = {"composition": sum((w[k][1] - w[k][0]) * s[k][0] for k in per),
             "within": sum(w[k][0] * (s[k][1] - s[k][0]) for k in per),
             "interaction": sum((w[k][1] - w[k][0]) * (s[k][1] - s[k][0]) for k in per)}
    rising = sum(1 for k in per if s[k][1] > s[k][0])
    return {**{k: round(v, 4) for k, v in parts.items()}, "cells": len(per), "cells_rising": rising,
            "abstracts": total}


def jump(rows: list[tuple], years: list[int]) -> dict | None:
    """Rows in COLUMNS order; years are the publication years shown on the page."""
    if len(years) < 5:
        return None
    rows = [dict(zip(COLUMNS, r)) for r in rows if r[0] in years]
    totals: dict = defaultdict(lambda: defaultdict(int))
    for r in rows:
        for c in COLUMNS[4:]:
            totals[r["year"]][c] += r[c]
    series = []
    for y in years:
        t = totals[y]
        n = t["abstracts"]
        series.append([y, n, round(t["future_abstracts"] / n, 4), round(t["future_without_research"] / n, 4),
                       round(t["future_without_research_long_term"] / n, 4),
                       *[round(t[f"using_{a}"] / n, 4) for a in ALTERNATIVES]])
    a, b = years[-5:-2], years[-2:]
    dims = {}
    for dim in ("level", "area", "institution"):
        cells: dict = defaultdict(lambda: defaultdict(lambda: (0, 0)))
        for r in rows:
            n, f = cells[r[dim]][r["year"]]
            cells[r[dim]][r["year"]] = (n + r["abstracts"], f + r["future_abstracts"])
        dims[dim] = shift_share(cells, a, b)
    return {"columns": ["year", "abstracts", "future_share", "future_share_without_research",
                        "future_share_without_research_long_term",
                        *[f"using_{x}" for x in ALTERNATIVES]],
            "rows": series, "periods": [a, b], "shift_share": dims, "min_cell": MIN_CELL}
