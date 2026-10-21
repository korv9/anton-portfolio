"""Publish SWEDEN Connections: a few explicitly defined relationships between products, each with
its measurement contract, and the joins that were rejected.

    python platform/publish/sweden/export_connections.py

Reads gold.mart_municipality_year_cross_subject for the municipal relationships (SWEDEN C's
frozen 2024 inputs and D's library totals) and B's and E's gold marts for the rejected joins,
and writes frontend/public/data/sweden/connections/connections.json. Every relationship declares
geography, time, population and denominator, units, missing-data behaviour, confounders and its evidence class; a join whose grains do not meet is recorded as
rejected with the reason, not computed.

Statistics: Spearman's ρ with a 95 % bootstrap interval (2,000 resamples, fixed seed) and a
partial ρ that removes log population from both ranks. Several relationships are tested, so
none is called significant; the intervals are descriptive.
"""
from __future__ import annotations

import json
import math
import os
import sys
from datetime import date
from pathlib import Path

import duckdb
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
DATA = ROOT / "frontend/public/data/sweden"
OUT = DATA / "connections"
SEED = 20261020
RESAMPLES = 2000
# Rate per inhabitant multiplier, as SWEDEN D publishes each rate.
PER = {"visits_rate": ("library_visits", 1), "service_points_rate": ("library_service_points", 10_000)}
X = ("median_earned_income_sek", "post_secondary_25_64_pct")


def ranks(x: np.ndarray) -> np.ndarray:
    order = x.argsort(kind="mergesort")
    r = np.empty(len(x))
    r[order] = np.arange(len(x))
    # Average tied ranks.
    for v in np.unique(x):
        tie = x == v
        if tie.sum() > 1:
            r[tie] = r[tie].mean()
    return r


def spearman(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.corrcoef(ranks(a), ranks(b))[0, 1])


def partial(a: np.ndarray, b: np.ndarray, z: np.ndarray) -> float:
    """Spearman's ρ of a and b after removing z linearly from both ranks."""
    ra, rb, rz = ranks(a), ranks(b), ranks(z)
    design = np.column_stack([np.ones_like(rz), rz])
    res = lambda y: y - design @ np.linalg.lstsq(design, y, rcond=None)[0]  # noqa: E731
    return float(np.corrcoef(res(ra), res(rb))[0, 1])


def bootstrap(a: np.ndarray, b: np.ndarray, rng) -> list[float]:
    draws = [spearman(a[i], b[i]) for i in (rng.integers(0, len(a), len(a)) for _ in range(RESAMPLES))]
    return [round(float(np.percentile(draws, 2.5)), 3), round(float(np.percentile(draws, 97.5)), 3)]


def panel(con, year: int) -> list[dict]:
    """SWEDEN C's municipalities in its reference year, with C's values at the precision C
    publishes (4 decimals) and D's rates as D publishes them."""
    rows = con.sql(f"""select municipality_code, similarity_population, similarity_median_earned_income_sek,
                              similarity_post_secondary_25_64_pct, library_population, library_visits,
                              library_service_points
                       from gold.mart_municipality_year_cross_subject
                       where year = {year} and similarity_population is not null
                       order by municipality_code""")
    out = []
    for r in (dict(zip(rows.columns, values)) for values in rows.fetchall()):
        p = r["library_population"]
        out.append({"code": r["municipality_code"],
                    "log_population": round(math.log(r["similarity_population"]), 4),
                    **{f: (round(r[f"similarity_{f}"], 4) if r[f"similarity_{f}"] is not None else None) for f in X},
                    **{k: (round(r[c] * per / p, 4) if p and r[c] is not None else None) for k, (c, per) in PER.items()}})
    return out


def municipal(rng, rows: list[dict], x_key: str, y_key: str) -> dict:
    pairs = [(r[y_key], r[x_key], r["log_population"], r["code"])
             for r in rows if r.get(y_key) is not None and r.get(x_key) is not None]
    y, x, z = (np.array([p[i] for p in pairs], dtype=float) for i in range(3))
    return {"n": len(pairs), "excluded": len(rows) - len(pairs), "rho": round(spearman(x, y), 3),
            "ci95": bootstrap(x, y, rng), "partial_rho_log_population": round(partial(x, y, z), 3),
            "points": [[p[3], round(p[1], 4), round(p[0], 4)] for p in pairs]}


def joined_series(con) -> tuple[set[int], set[int], float | None, bool]:
    """From gold, as B and E publish them: the years with a standardised job-ad rate, the Riksdag
    years kept, Spearman's ρ of the future share with speech length, and whether the academic
    corpus is shown."""
    import export_futures  # here: export_futures imports spearman from this module
    from export_language import MIN_TEXTS

    b_years = {y for (y,) in con.sql(f"""
        select year from gold.mart_sweden_job_language_trends
        where category = (select term_id from seeds.ad_language_terms order by sort_order limit 1)
          and texts >= {MIN_TEXTS} and per_1000_words_standardised is not null""").fetchall()}
    try:
        _, e_years, share = export_futures.yearly(con, date.today().year)
    except duckdb.CatalogException:  # E not built in this warehouse
        return b_years, set(), None, False
    rho = round(spearman(np.array([r[1] for r in share]), np.array([r[2] for r in share])), 2)
    return b_years, e_years, rho, export_futures.academic(con, [], date.today().year) is not None


def rejected_joins(b_years: set[int], e_years: set[int], rho: float | None, academic: bool) -> list[dict]:
    """The joins left uncomputed, with the reason each would mislead."""
    overlap = sorted(b_years & e_years)
    span = f"{overlap[0]}–{overlap[-1]}" if overlap else "none"
    length = (f"the Riksdag's future share also rises and falls with speech length (Spearman's ρ {rho} "
              "across years)" if rho is not None else "the Riksdag's future share also follows speech length")
    return [{
        "id": "ads-career-futures", "products": ["B", "E"],
        "question": "Does the language of careers and self-development rise in job ads and in the Riksdag's future talk together?",
        "reason": (f"{len(overlap)} years ({span}) have both a standardised job-ad rate and a Riksdag count. Job ads and "
                   "speeches are two genres with their own vocabulary, and two yearly series that both drift over "
                   f"time correlate whether or not they are related; {length}. A correlation would not show a "
                   "common cause."),
    }, {
        "id": "speeches-theses", "products": ["E"],
        "question": "Do Riksdag speeches and academic theses imagine the same futures?",
        "reason": ("The two corpora differ in genre, author and length. "
                   + ("The DiVA abstracts are shown next to the Riksdag on The Lost Futures page, never pooled into one map."
                      if academic else
                      "The DiVA abstracts are being harvested again so that only Swedish abstracts count, each record "
                      "once; they are shown next to the Riksdag when that is done, never pooled into one map.")),
    }]


def main() -> int:
    rng = np.random.default_rng(SEED)
    con = duckdb.connect(str(DATABASE), read_only=True)
    year = con.sql("select max(year) from gold.fct_municipal_similarity").fetchone()[0]
    rows = panel(con, year)
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from export_similarity import FEATURES

    label = {f: (en, unit) for f, (en, _, unit) in FEATURES.items()}
    contract = {"geography": "municipality (SCB code, 290)", "time": f"calendar year {year}",
                "missing": "a municipality without either value is left out, and counted"}
    relationships = []
    for x_key, why in (("post_secondary_25_64_pct", "Cultural capital: do libraries see more visits where more adults hold a post-secondary education?"),
                       ("median_earned_income_sek", "Economic capital: are library visits higher where earned incomes are higher?")):
        result = municipal(rng, rows, x_key, "visits_rate")
        rho, part = result["rho"], result["partial_rho_log_population"]
        relationships.append({
            "id": f"visits-{x_key}", "products": ["D", "C"], "question": why,
            "x": {"name": label[x_key][0], "unit": label[x_key][1], "source": "Kolada/SCB via C (12-indicator profile)"},
            "y": {"name": "Physical library visits per inhabitant", "unit": "visits per inhabitant",
                  "source": "KB library statistics (D)", "denominator": "municipal population"},
            "contract": contract,
            "confounders": ["population size (partialled out)", "share of commuters", "library opening hours",
                            "students and tourists visiting another municipality's library"],
            "result": result,
            "evidence": "exploratory",
            "assessment": ("robust" if result["ci95"][0] > 0.1 and part > 0.1 else
                           "uncertain" if max(abs(rho), abs(part)) >= 0.1 else "not_supported"),
            "alternatives": ["Larger towns have both more graduates and central libraries that draw visitors from around them.",
                             "Visits are counted by door counters of uneven quality across municipalities."],
        })
    trivial = municipal(rng, rows, "log_population", "service_points_rate")
    relationships.append({
        "id": "points-population", "products": ["D", "C"],
        "question": "Do small municipalities have more library service points per inhabitant?",
        "x": {"name": "Population (log)", "unit": "ln persons", "source": "SCB via C"},
        "y": {"name": "Staffed service points per 10,000 inhabitants", "unit": "per 10,000",
              "source": "KB library statistics (D)", "denominator": "municipal population"},
        "contract": contract, "confounders": ["the rate's own denominator"], "result": trivial,
        "evidence": "descriptive", "assessment": "trivial",
        "alternatives": ["Every municipality keeps at least one main library, so a small population gives a high rate by construction."],
    })
    rejected = rejected_joins(*joined_series(con))
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / "connections.json"
    path.write_text(json.dumps({"relationships": relationships, "rejected": rejected,
                                "method": {"statistic": "Spearman's rho", "interval": f"bootstrap percentile, {RESAMPLES} resamples, seed {SEED}",
                                           "partial": "ranks residualised on the rank of log population",
                                           "assessment": {"robust": "interval above 0.1 and partial rho above 0.1",
                                                          "uncertain": "|rho| or |partial rho| at least 0.1 otherwise",
                                                          "not_supported": "both below 0.1",
                                                          "trivial": "follows from how the measure is built"},
                                           "multiple_comparisons": "several relationships are tested; none is called significant"},
                                "run_id": os.environ.get("GITHUB_RUN_ID"), "code_sha": os.environ.get("GITHUB_SHA")},
                               ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    sys.path.insert(0, str(ROOT / "platform/publish/symbolic"))
    import export_symbolic

    export_symbolic.register([path])
    print(f"SWEDEN connections: {len(relationships)} computed, {len(rejected)} rejected -> {path.relative_to(ROOT)}")
    for r in relationships:
        print(f"  {r['id']}: rho {r['result']['rho']} {r['result']['ci95']} partial {r['result']['partial_rho_log_population']} -> {r['assessment']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
