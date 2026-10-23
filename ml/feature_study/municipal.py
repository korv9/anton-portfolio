"""Municipal types from the cross-subject panel: plain levels against engineered features.

    python -m ml.feature_study.municipal

Reads gold.mart_municipality_year_cross_subject (PORTFOLIO_DB, read-only). Seven indicators
(open unemployment, social assistance, median earned income, local income tax rate, library
visits, turnout, sick pay) and the eight Riksdag parties' shares in the latest election.
Feature sets, each z-scored per column and clustered with the same K-means and checks
(report.cluster_report):
- levels: the indicators and party percentages of YEAR as delivered;
- engineered: log income, library visits per 1,000 residents (log), CLR of the party shares with
  the remainder as a ninth part;
- + change: engineered plus each indicator's change since BASE (party CLR change across the two
  elections);
- + slope: engineered plus each indicator's OLS slope over BASE..YEAR;
- + jobs: engineered plus CLR of the 21 occupation-field shares of distinct job ads, pooled
  2023-2025 (gold.mart_job_ad_municipality_field, at least 900 ads, as labour_market.py).
A municipality missing any value is left out of every set, so all sets cover the same units.
Library visits are missing for 38 of the 240 municipalities that have every other value, so
every comparison runs with and without them. Period check: each set built for 2014-2019 and for 2019-2024, clustered at the fixed k, as
ARI (none for + jobs: the ads start in 2023).
"""
from __future__ import annotations

import json
import os

import duckdb
import numpy as np
import pandas as pd

from ml.feature_study.report import ROOT, cluster_report, period_ari, standardise, stats, write

INDICATORS = ["open_unemployment_18_65_pct", "social_assistance_pct", "median_earned_income_sek",
              "local_income_tax_rate", "library_visits", "turnout_riksdag_pct", "sick_pay_rate_1_days"]
PARTIES = ["s", "m", "sd", "v", "c", "kd", "mp", "l"]
SHARES = [f"share_{p}_pct" for p in PARTIES]
YEAR, BASE, FIXED_K = 2024, 2015, 4
DATABASE = os.environ.get("PORTFOLIO_DB", str(ROOT / "warehouse/portfolio.duckdb"))
SIMILARITY = ROOT / "frontend/public/data/sweden/similarity/municipalities.json"


def per_capita(panel: pd.DataFrame) -> pd.DataFrame:
    """Rates that compare across sizes: library visits per 1,000 residents, logs of skewed money."""
    out = panel.copy()
    out["library_visits"] = np.log(panel.library_visits / panel.population * 1000 + 1)
    out["median_earned_income_sek"] = np.log(panel.median_earned_income_sek)
    return out


def party_clr(panel: pd.DataFrame, pseudo: float = 0.1) -> pd.DataFrame:
    """CLR of the eight party shares plus the rest as a ninth part (percentages in, logs out)."""
    parts = panel[SHARES].to_numpy(float)
    rest = np.clip(100 - parts.sum(axis=1, keepdims=True), 0, None)
    logs = stats.clr(np.hstack([parts, rest]) + pseudo)
    return pd.DataFrame(logs, index=panel.index, columns=[f"clr_{p}" for p in PARTIES] + ["clr_other"])


def change(panel: pd.DataFrame, columns: list[str], year: int, base: int) -> pd.DataFrame:
    """Value in `year` minus value in `base`, per municipality."""
    wide = panel.set_index(["municipality_code", "year"])[columns]
    return (wide.xs(year, level="year") - wide.xs(base, level="year")).add_prefix("change_")


def slope(panel: pd.DataFrame, columns: list[str], first: int, last: int, min_years: int = 5) -> pd.DataFrame:
    """OLS slope per year over first..last; NaN with fewer than `min_years` observed years."""
    window = panel[panel.year.between(first, last)]

    def one(cell: pd.DataFrame) -> pd.Series:
        out = {}
        for c in columns:
            ok = cell[c].notna()
            t, v = cell.year[ok].to_numpy(float), cell[c][ok].to_numpy(float)
            out[c] = np.polyfit(t - t.mean(), v, 1)[0] if ok.sum() >= min_years else np.nan
        return pd.Series(out)

    return window.groupby("municipality_code")[["year", *columns]].apply(one).add_prefix("slope_")


def job_fields(rows: pd.DataFrame, min_ads: int = 900) -> pd.DataFrame:
    """CLR of occupation-field shares (+0.5 per count) for municipalities with at least `min_ads`."""
    wide = rows.pivot_table(index="municipality_code", columns="occupation_field", values="ads",
                            aggfunc="sum", fill_value=0)
    wide = wide[wide.sum(axis=1) >= min_ads]
    return pd.DataFrame(stats.clr(wide.to_numpy(float) + 0.5), index=wide.index,
                        columns=[f"clr_field_{i}" for i in range(wide.shape[1])])


def feature_sets(panel: pd.DataFrame, year: int, base: int, indicators=INDICATORS) -> dict[str, pd.DataFrame]:
    raw = panel[panel.year == year].set_index("municipality_code")
    eng_panel = per_capita(panel)
    eng = eng_panel[eng_panel.year == year].set_index("municipality_code")
    engineered = pd.concat([eng[indicators], party_clr(eng)], axis=1)
    votes = pd.concat({y: party_clr(eng_panel[eng_panel.year == y].set_index("municipality_code"))
                       for y in (year, base)})
    vote_change = (votes.loc[year] - votes.loc[base]).add_prefix("change_")
    return {"levels": raw[indicators + SHARES],
            "engineered": engineered,
            "engineered+change": engineered.join(change(eng_panel, indicators, year, base)).join(vote_change),
            "engineered+slope": engineered.join(slope(eng_panel, indicators, base, year))}


def common(sets: dict[str, pd.DataFrame]) -> pd.Index:
    index = None
    for frame in sets.values():
        ok = frame.dropna().index
        index = ok if index is None else index.intersection(ok)
    return index.sort_values()


def load() -> tuple[pd.DataFrame, pd.DataFrame]:
    columns = ", ".join(["municipality_code", "year", "population", *INDICATORS, *SHARES])
    with duckdb.connect(DATABASE, read_only=True) as con:
        con.execute("set memory_limit='1GB'")
        panel = con.sql(f"select {columns} from gold.mart_municipality_year_cross_subject "
                        "where year between 2010 and 2024").df()
        jobs = con.sql("select municipality_code, occupation_field, ads from gold.mart_job_ad_municipality_field "
                       "where year between 2023 and 2025").df()
    return panel, jobs


def compare(panel: pd.DataFrame, jobs: pd.DataFrame, indicators: list[str], refs_by_code: dict) -> dict:
    sets = feature_sets(panel, YEAR, BASE, indicators)
    sets["engineered+jobs"] = sets["engineered"].join(job_fields(jobs), how="inner")
    early, late = feature_sets(panel, 2019, 2014, indicators), feature_sets(panel, 2024, 2019, indicators)
    codes = common({**sets, **{f"early {k}": v for k, v in early.items()}, **{f"late {k}": v for k, v in late.items()}})
    refs = {"skr_group": [refs_by_code.get(c, {}).get("skr_group") for c in codes]}
    result = {"indicators": indicators, "units": int(len(codes)),
              "left_out": int(panel.municipality_code.nunique() - len(codes)), "sets": {}}
    for name, frame in sets.items():
        report = cluster_report(standardise(frame.loc[codes].to_numpy(float)), FIXED_K, reference=refs)
        report["period_ari_2014_19_vs_2019_24"] = (period_ari(standardise(early[name].loc[codes].to_numpy(float)),
                                                              standardise(late[name].loc[codes].to_numpy(float)), FIXED_K)
                                                   if name in early else None)
        result["sets"][name] = report
    return result


def main() -> None:
    panel, jobs = load()
    by_code = {m["code"]: m for m in json.loads(SIMILARITY.read_text(encoding="utf-8"))["municipalities"]}
    without = [i for i in INDICATORS if i != "library_visits"]
    write("municipal", {"year": YEAR, "base": BASE, "fixed_k": FIXED_K,
                        "with_libraries": compare(panel, jobs, INDICATORS, by_code),
                        "without_libraries": compare(panel, jobs, without, by_code)})


if __name__ == "__main__":
    main()
