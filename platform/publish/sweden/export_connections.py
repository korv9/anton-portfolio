"""Publish SWEDEN Connections: a few explicitly defined relationships between products, each with
its measurement contract, and the joins that were rejected.

    python platform/publish/sweden/export_connections.py

Reads the published SWEDEN files (sweden/similarity, sweden/belonging, sweden/language,
sweden/futures) and writes frontend/public/data/sweden/connections/connections.json. Every
relationship declares geography, time, population and denominator, units, missing-data
behaviour, confounders and its evidence class; a join whose grains do not meet is recorded as
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
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "frontend/public/data/sweden"
OUT = DATA / "connections"
SEED = 20261020
RESAMPLES = 2000


def load(path: str) -> dict:
    return json.loads((DATA / path).read_text(encoding="utf-8"))


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


def municipal(rng, similarity: dict, belonging: dict, x_key: str, y_key: str, year: int) -> dict:
    values = {m["code"]: m for m in similarity["municipalities"]}
    rows = [r for r in belonging["rows"] if r["year"] == year]
    pairs = [(r[y_key], values[r["code"]]["values"].get(x_key), values[r["code"]]["values"]["log_population"], r["code"])
             for r in rows if r["code"] in values and r.get(y_key) is not None
             and values[r["code"]]["values"].get(x_key) is not None]
    y, x, z = (np.array([p[i] for p in pairs], dtype=float) for i in range(3))
    return {"n": len(pairs), "excluded": len(values) - len(pairs), "rho": round(spearman(x, y), 3),
            "ci95": bootstrap(x, y, rng), "partial_rho_log_population": round(partial(x, y, z), 3),
            "points": [[p[3], round(p[1], 4), round(p[0], 4)] for p in pairs]}


def main() -> int:
    rng = np.random.default_rng(SEED)
    similarity = load("similarity/municipalities.json")
    belonging = load("belonging/municipalities.json")
    year = similarity["year"]
    label = {f["id"]: (f["label_en"], f["unit"]) for f in similarity["features"]}
    contract = {"geography": "municipality (SCB code, 290)", "time": f"calendar year {year}",
                "missing": "a municipality without either value is left out, and counted"}
    relationships = []
    for x_key, why in (("post_secondary_25_64_pct", "Cultural capital: do libraries see more visits where more adults hold a post-secondary education?"),
                       ("median_earned_income_sek", "Economic capital: are library visits higher where earned incomes are higher?")):
        result = municipal(rng, similarity, belonging, x_key, "visits_rate", year)
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
    trivial = municipal(rng, similarity, belonging, "log_population", "service_points_rate", year)
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
    language = load("language/trends.json")
    b_years = {r[0] for r in language["categories"][0]["rows"] if r[8] is not None}
    e_years = ({r[0] for r in load("futures/trends.json")["themes"][0]["rows"]}
               if (DATA / "futures/trends.json").exists() else set())
    overlap = sorted(b_years & e_years)
    rejected = [{
        "id": "ads-career-futures", "products": ["B", "E"],
        "question": "Does the language of careers and self-development rise in job ads and in the Riksdag's future talk together?",
        "reason": (f"Only {len(overlap)} years ({', '.join(map(str, overlap))}) have both a standardised job-ad rate and a "
                   "Riksdag count; a correlation over so few points, two genres and unequal coverage would describe "
                   "nothing. The join waits for the full job-ad backfill."),
    }, {
        "id": "speeches-theses", "products": ["E"],
        "question": "Do Riksdag speeches and academic theses imagine the same futures?",
        "reason": "DiVA abstracts are not yet counted, and the two corpora differ in genre, language and author; "
                  "they will be compared side by side, never pooled into one map.",
    }]
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
