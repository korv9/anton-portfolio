"""Who taxes like Sweden? (clustering plan item 10): a descriptive tax-mix dendrogram of 38 countries.

    python platform/publish/clusters/tax_mix.py

taxes/countries.json (OECD Revenue Statistics): each country's revenue split into nine parts of
total tax (personal income, corporate income, other income, social security, payroll, property,
VAT, other goods and services, other), in its latest complete year and in 1990 and 2005. Zero
parts get 0.1 % before the centred log-ratio; Ward on the CLR values, cut at 3-5 groups by
silhouette.
- bootstrap over countries (ARI of the refitted cut on the drawn countries);
- per-branch support: the share of bootstrap trees, on the drawn countries, that contain the
  branch's drawn members as one branch (in the style of pvclust's BP; tax types are too few to
  resample);
- each tax part permuted over countries on its own as the null.
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd
from scipy.cluster.hierarchy import fcluster, linkage, to_tree

import stats

COUNTRIES = stats.PUBLIC / "taxes/countries.json"
PARTS = {"personal_income": ["T_1100"], "corporate_income": ["T_1200"], "social_security": ["T_2000"],
         "payroll": ["T_3000"], "property": ["T_4000"], "vat": ["T_5111"], "other": ["T_6000"]}
YEARS = (1990, 2005)
FLOOR = 0.001
ROUNDS = 200


def mix(wide: pd.DataFrame) -> pd.DataFrame:
    parts = pd.DataFrame({name: wide[codes].sum(axis=1) for name, codes in PARTS.items()})
    parts["other_income"] = (wide["T_1000"] - wide["T_1100"] - wide["T_1200"]).clip(lower=0)
    parts["other_goods_services"] = (wide["T_5000"] - wide["T_5111"]).clip(lower=0)
    shares = parts.div(wide["_T"], axis=0).clip(lower=FLOOR)
    return shares.div(shares.sum(axis=1), axis=0)


def clr(shares: np.ndarray) -> np.ndarray:
    logs = np.log(shares)
    return logs - logs.mean(axis=1, keepdims=True)


def ward(x: np.ndarray, k: int) -> np.ndarray:
    return fcluster(linkage(x, "ward"), k, "maxclust") - 1


def clades(z: np.ndarray, n: int) -> list[frozenset]:
    out = []
    def walk(node):
        if node.is_leaf():
            return frozenset([node.id])
        members = walk(node.left) | walk(node.right)
        if 1 < len(members) < n:
            out.append(members)
        return members
    walk(to_tree(z))
    return out


def clade_support(x: np.ndarray, rounds: int = ROUNDS, seed: int = stats.SEED) -> list[tuple[frozenset, float]]:
    """For each branch of the tree: share of bootstrap trees (on the drawn countries) holding it."""
    reference = clades(linkage(x, "ward"), len(x))
    hits, seen = np.zeros(len(reference)), np.zeros(len(reference))
    rng = np.random.default_rng(seed)
    for _ in range(rounds):
        drawn = np.unique(rng.integers(0, len(x), len(x)))
        found = {frozenset(drawn[list(c)]) for c in clades(linkage(x[drawn], "ward"), len(drawn))}
        for i, clade in enumerate(reference):
            inside = clade & frozenset(drawn)
            if 1 < len(inside) < len(drawn):
                seen[i] += 1
                hits[i] += inside in found
    return [(c, round(float(h / s), 3) if s else None) for c, h, s in zip(reference, hits, seen)]


def main() -> None:
    data = json.loads(COUNTRIES.read_text(encoding="utf-8"))
    rows = pd.DataFrame(data["rows"], columns=data["columns"])
    names = {c["country_code"]: c["name_en"] for c in data["countries"]}
    rows = rows[~rows.country_code.str.startswith("OECD")]  # the OECD average is not a country
    wide = rows.pivot_table(index=["country_code", "year"], columns="tax_code", values="pct_gdp").dropna()
    latest = wide.reset_index().groupby("country_code").year.max()
    current = wide.loc[list(latest.items())].droplevel("year")
    shares = mix(current)
    x = clr(shares.to_numpy())
    k, sweep = stats.choose_k(x, range(3, 6), fit=lambda k: lambda d: ward(d, k))
    fit = lambda d: ward(d, k)
    labels = fit(x)
    observed = stats.silhouette(x, labels)
    z = linkage(x, "ward")
    codes = shares.index.to_numpy()
    support = [{"members": sorted(codes[list(c)].tolist()), "support": s} for c, s in clade_support(x)]
    sweden = int(np.flatnonzero(codes == "SWE")[0])
    over_time = {}
    for year in YEARS:
        past = wide.xs(year, level="year") if year in wide.index.get_level_values("year") else None
        if past is None or "SWE" not in past.index:
            continue
        px, pc = clr(mix(past).to_numpy()), past.index.to_numpy()
        plab = ward(px, k)
        over_time[str(year)] = {"countries": len(pc), "sweden_group": sorted(pc[plab == plab[pc == "SWE"][0]].tolist())}
    over_time["latest"] = {"countries": len(codes), "sweden_group": sorted(codes[labels == labels[sweden]].tolist())}
    diagnostics = stats.diagnostics(labels, observed, stats.bootstrap_ari(x, labels, fit),
                                    stats.permutation_null(x, observed, fit), {},
                                    space="centred log-ratios of nine tax parts",
                                    note=f"Descriptive: {len(codes)} countries.")
    clusters = [{"id": c, "size": int((labels == c).sum()), "members": sorted(codes[labels == c].tolist()),
                 "mean_share": dict(zip(shares.columns, np.round(shares.to_numpy()[labels == c].mean(axis=0), 4).tolist()))}
                for c in range(k)]
    metrics = {"title": "Who taxes like Sweden", "method": {"features": "CLR of nine tax parts of total tax",
                                                            "algorithm": "Ward", "k": k, "k_sweep_silhouette": sweep,
                                                            "floor": FLOOR, "latest_year": latest.to_dict()},
               "diagnostics": diagnostics, "clusters": clusters, "tree": {"leaves": codes.tolist(),
                                                                          "linkage": np.round(z, 4).tolist()},
               "branch_support": support, "sweden_over_time": over_time,
               "assignments": ["tax-mix"], "members": True, "shares": False}
    assignments = stats.frame("tax-mix", codes, [names.get(c, c) for c in codes], "latest", labels)
    stats.save("tax-mix", shares.reset_index(), assignments, metrics)


if __name__ == "__main__":
    main()
