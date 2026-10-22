"""Publish SWEDEN Connections: a few explicitly defined relationships between products, each with
its measurement contract, and the joins that were rejected.

    python platform/publish/sweden/export_connections.py

Reads gold.mart_municipality_year_cross_subject (the welfare panel, SWEDEN C's 2024 inputs and
D's library totals), gold.fct_municipal_similarity for C's commuting shares and
gold.fct_library_municipality_year for why a visit count is missing, and B's and E's gold marts
for the rejected joins. Writes frontend/public/data/sweden/connections/connections.json. Every
relationship declares geography, time, population and denominator, units, missing-data
behaviour, confounders and its evidence class; a join whose grains do not meet is recorded as
rejected with the reason, not computed.

The socioeconomic relationship (plan 3.3) is one question with one family of tests: the partial
Spearman ρ of visits per inhabitant with median earned income after log population, in the
reference year and in REPLICATION, and with post-secondary education in the reference year
(education is C's 2024 input only). Each carries an iid and a county-cluster bootstrap interval
and a residual permutation p, Holm-adjusted over the family. The label is read from the income
estimate alone, the one measured the same way in both years.
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

sys.path.insert(0, str(Path(__file__).resolve().parent))
import connections_preregistered as pre  # noqa: E402
from connections_stats import RESAMPLES, ROUNDS, holm, interval, partial, permutation_p, spearman  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
DATA = ROOT / "frontend/public/data/sweden"
OUT = DATA / "connections"
SEED = 20261020
# The last year before the pandemic closed libraries: the reference year's replication.
REPLICATION = 2019
EDUCATION = "post_secondary_25_64_pct"
INCOME = "median_earned_income_sek"
COMMUTING = ("in_commuting_pct", "out_commuting_pct")
PREREGISTERED = "ecd242f2"


def panel(con, year: int) -> list[dict]:
    """Every municipality in the year: panel population and income, C's education and commuting
    (reference year only), D's visit rate as D publishes it, and why a visit count is missing."""
    rows = con.sql(f"""select x.municipality_code as code, x.municipality_name as name, x.population, x.{INCOME},
                              x.similarity_{EDUCATION} as {EDUCATION}, f.{COMMUTING[0]}, f.{COMMUTING[1]},
                              x.library_visits, x.library_population, l.municipality_code is not null as in_kb,
                              l.set_to_missing
                       from gold.mart_municipality_year_cross_subject as x
                       left join gold.fct_municipal_similarity as f using (municipality_code, year)
                       left join gold.fct_library_municipality_year as l using (municipality_code, year)
                       where x.year = {year} order by x.municipality_code""")
    out = []
    for r in (dict(zip(rows.columns, values)) for values in rows.fetchall()):
        p, v = r["library_population"], r["library_visits"]
        reasons = [m for m in (r["set_to_missing"] or []) if m.startswith("visits")]
        out.append({"code": r["code"], "name": r["name"],
                    "log_population": math.log(r["population"]) if r["population"] else None,
                    **{k: r[k] for k in (INCOME, EDUCATION, *COMMUTING)},
                    "visits_rate": round(v / p, 4) if p and v is not None else None,
                    "missing": None if v is not None else "; ".join(reasons) or (
                        "no visit count in KB's statistics" if r["in_kb"] else "no row in KB's statistics")})
    return out


def complete(rows: list[dict], keys: tuple[str, ...]) -> tuple[list[dict], dict[str, np.ndarray]]:
    kept = [r for r in rows if all(r[k] is not None for k in keys)]
    return kept, {k: np.array([r[k] for r in kept], dtype=float) for k in keys}


def estimate(rows: list[dict], x_key: str, controls: tuple[str, ...], seed: int, test: bool = True) -> dict:
    """Partial ρ of visits per inhabitant with x_key after the controls, with both intervals."""
    kept, v = complete(rows, ("visits_rate", x_key, *controls))
    x, y, z = v[x_key], v["visits_rate"], [v[k] for k in controls]
    county = np.array([r["code"][:2] for r in kept])
    stat = lambda i: partial(x[i], y[i], [c[i] for c in z])  # noqa: E731
    out = {"n": len(kept), "partial_rho": round(partial(x, y, z), 3),
           "ci95_iid": interval(stat, len(kept), np.random.default_rng(seed)),
           "ci95_county": interval(stat, len(kept), np.random.default_rng(seed), county)}
    if test:
        out["p"] = round(permutation_p(x, y, z, np.random.default_rng(seed)), 4)
    return out


def side(ci: list[float]) -> int:
    return 1 if ci[0] > 0 else -1 if ci[1] < 0 else 0


def replicated(intervals: list[list[float]]) -> str:
    """robust: every interval excludes zero on the same side; not_supported: every interval
    includes zero; uncertain otherwise."""
    sides = {side(ci) for ci in intervals}
    return "robust" if len(sides) == 1 and 0 not in sides else "not_supported" if sides == {0} else "uncertain"


def gradient(con, year: int, label: dict) -> dict:
    """Plan 3.3: one socioeconomic gradient in library visits after population size."""
    rows, early = panel(con, year), panel(con, REPLICATION)
    family = [("income", year, estimate(rows, INCOME, ("log_population",), SEED)),
              ("income", REPLICATION, estimate(early, INCOME, ("log_population",), SEED)),
              ("education", year, estimate(rows, EDUCATION, ("log_population",), SEED))]
    for (_, _, e), p in zip(family, holm([e["p"] for _, _, e in family])):
        e["p_holm"] = round(p, 4)
    others = ("log_population", *COMMUTING)
    joint = {"income": estimate(rows, INCOME, (*others, EDUCATION), SEED, test=False),
             "education": estimate(rows, EDUCATION, (*others, INCOME), SEED, test=False)}
    kept, v = complete(rows, ("visits_rate", INCOME))
    missing = [r for r in rows if r["visits_rate"] is None]
    median = lambda group, f: round(float(np.median([r[f] for r in group if r[f] is not None])), 3)  # noqa: E731
    return {
        "id": "visits-socioeconomic", "kind": "gradient", "products": ["D", "C"],
        "specification": "chosen by the authors after the data were available; not pre-registered",
        "question": "After population size, are library visits higher in municipalities with higher incomes?",
        "x": {"name": label[INCOME][0], "unit": label[INCOME][1], "source": "Kolada N00906 via the municipal panel"},
        "y": {"name": "Physical library visits per inhabitant", "unit": "visits per inhabitant",
              "source": "KB library statistics (D)", "denominator": "municipal population"},
        "contract": {"geography": "municipality (SCB code, 290)",
                     "time": f"calendar year {year}, repeated for {REPLICATION}",
                     "missing": "a municipality without a visit count is left out and named below"},
        "confounders": ["population size (partialled out)", "commuting (held constant in the joint model)",
                        "library opening hours", "students and tourists visiting another municipality's library"],
        "result": {"n": len(kept), "excluded": len(rows) - len(kept),
                   "rho": round(spearman(v[INCOME], v["visits_rate"]), 3),
                   "ci95": interval(lambda i: spearman(v[INCOME][i], v["visits_rate"][i]), len(kept),
                                    np.random.default_rng(SEED)),
                   "family": [{"measure": m, "year": y, **e} for m, y, e in family],
                   "joint": joint,
                   "missing": [{"code": r["code"], "name": r["name"], "reason": r["missing"]} for r in missing],
                   "missing_profile": [{"feature": f, "missing_median": median(missing, f),
                                        "included_median": median(kept, f)}
                                       for f in ("log_population", INCOME, EDUCATION, *COMMUTING)],
                   "points": [[r["code"], round(r[INCOME]), r["visits_rate"]] for r in kept]},
        "evidence": "exploratory",
        "assessment": replicated([family[0][2]["ci95_county"], family[1][2]["ci95_county"]]),
        "alternatives": ["Income and education measure one gradient: holding either constant shrinks the other (joint model).",
                         "Larger towns have both more graduates and central libraries that draw visitors from around them.",
                         "Visits are counted by door counters of uneven quality across municipalities."],
    }


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
    con = duckdb.connect(str(DATABASE), read_only=True)
    year = con.sql("select max(year) from gold.fct_municipal_similarity").fetchone()[0]
    from export_similarity import FEATURES

    label = {f: (en, unit) for f, (en, _, unit) in FEATURES.items()}
    spec = f"pre-registered in docs/sweden-connections-preregistration.md (commit {PREREGISTERED}) before it was computed"
    relationships = [gradient(con, year, label),
                     pre.neighbour_comparison(con, year, list(FEATURES), REPLICATION) | {"specification": spec},
                     pre.change_model(con) | {"specification": spec}]
    rejected = rejected_joins(*joined_series(con))
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / "connections.json"
    path.write_text(json.dumps({"relationships": relationships, "rejected": rejected, "method": {
        "statistic": "Spearman's rho; the partial rho removes the controls' ranks linearly from both ranks",
        "interval": f"95 % percentile bootstrap, {RESAMPLES} resamples of municipalities (iid) or of the 21 counties "
                    "(county cluster)",
        "test": f"residual permutation, {ROUNDS} rounds, two-sided",
        "seeds": {"visits-socioeconomic": SEED, "neighbours-libraries": pre.SEED, "visits-change": pre.SEED},
        "families": {"visits-socioeconomic": f"income in {year} and {REPLICATION}, education in {year}",
                     "neighbours-libraries": "visits and service points",
                     "visits-change": "population and income in both periods"},
        "multiple_comparisons": "Holm-adjusted p within each family, published beside the raw p; no label rests on p",
        "assessment": {"visits-socioeconomic": "robust when the county-cluster intervals of the income partial rho "
                                               "exclude zero in both years on the same side; not_supported when both "
                                               "include zero; uncertain otherwise",
                       "neighbours-libraries": "per measure: robust when the median absolute log ratio lies below the "
                                               "reference's 2.5th percentile, uncertain when below its median, "
                                               "not_supported otherwise",
                       "visits-change": "robust when one coefficient's interval excludes zero in both periods on the "
                                        "same side; not_supported when every interval includes zero; uncertain otherwise"},
        "deviations": pre.DEVIATIONS,
    }, "run_id": os.environ.get("GITHUB_RUN_ID"), "code_sha": os.environ.get("GITHUB_SHA")},
        ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")
    sys.path.insert(0, str(ROOT / "platform/publish/symbolic"))
    import export_symbolic

    export_symbolic.register([path])
    print(f"SWEDEN connections: {len(relationships)} computed, {len(rejected)} rejected -> {path.relative_to(ROOT)}")
    for r in relationships:
        print(f"  {r['id']}: {r['assessment']} {json.dumps({k: v for k, v in r['result'].items() if k != 'points'})}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
