"""Publish SWEDEN C, The Invisible Sweden: municipalities by social similarity, and how far apart
socially similar municipalities lie.

    python platform/publish/sweden/export_similarity.py

Reuses the validated 2024 municipality clustering (ml/research/regions.py, run
public-consensus-2026-10-13: 12 indicators, PCA, K-means; k=2 by the gap rule, k=4 the finer
split, both with bootstrap ARI >= 0.75) and the indicator values it was fitted on, whose
SHA-256 it recorded. It adds what the research question needs: each municipality's five
nearest municipalities in the standardised indicator space, the straight-line distance between
their centroids, and SCB's municipality boundaries (CC0) for the map.

Writes frontend/public/data/sweden/similarity/:
- `municipalities.json`: all 290 municipalities; for the 280 in the analysis their raw values,
  groups, first two principal components and nearest neighbours; for the 10 others which value
  is missing.
- `groups.json`: profiles of both splits (raw and standardised means), stability and the null.
- `geometry.json`: simplified boundaries in SWEREF99 TM metres, one ring list per municipality.

The county share of nearest neighbours is compared with two nulls: a random partner (the share
of other municipalities that lie in another county) and a permutation of the social profiles
over the municipalities, which keeps the neighbour structure and moves the places.

The run JSON and the three sources it hashed are kept in warehouse/features/sweden/similarity,
which the sweden subject stores in R2, so a cloud runner rebuilds the same files. When they are
absent the committed files are kept and the script says so.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import sys
import tempfile
import zipfile
from pathlib import Path

import duckdb
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
RUN = "public-consensus-2026-10-13"
STORE = Path(os.environ.get("PORTFOLIO_FEATURES", ROOT / "warehouse/features")) / "sweden/similarity"
RESULT = STORE / "regions-municipalities.json"
BOUNDARIES = Path(os.environ.get("PORTFOLIO_RAW", ROOT / "warehouse/raw")) / "geography/scb_boundaries_shape.zip"
NAMES = ROOT / "frontend/public/data/cluster-research/municipalities.json"
OUT = ROOT / "frontend/public/data/sweden/similarity"
NEIGHBOURS = 5
ROUNDS = 1000
ELECTIONS = (2010, 2014, 2018, 2022, 2026)  # Kolada repeats the last Riksdag election in later years

FEATURES = {
    "open_unemployment_18_65_pct": ("Open unemployment, 18–65", "Öppen arbetslöshet, 18–65", "%"),
    "employment_rate_20_64_pct": ("Employment rate, 20–64", "Förvärvsfrekvens, 20–64", "%"),
    "ill_health_days": ("Ill-health days", "Ohälsotal", "days per person"),
    "median_earned_income_sek": ("Median earned income", "Medianinkomst", "SEK"),
    "social_assistance_pct": ("Social assistance", "Ekonomiskt bistånd", "% of residents"),
    "turnout_riksdag_pct": ("Riksdag turnout", "Valdeltagande riksdag", "%"),
    "eligible_vocational_programme_pct": ("Eligible for upper secondary", "Behöriga till gymnasiet", "%"),
    "log_population": ("Population (log)", "Folkmängd (log)", "ln persons"),
    "out_commuting_pct": ("Out-commuting", "Utpendling", "% of employed residents"),
    "in_commuting_pct": ("In-commuting", "Inpendling", "% of jobs"),
    "dependency_ratio": ("Dependency ratio", "Försörjningskvot", "ratio"),
    "post_secondary_25_64_pct": ("Post-secondary education, 25–64", "Eftergymnasial utbildning, 25–64", "%"),
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def values(result: dict) -> dict[str, dict]:
    """The 2024 indicator values per municipality, from the files the clustering hashed."""
    sources = {Path(p).name: (STORE / Path(p).name, h) for p, h in result["sources"].items()}
    for path, recorded in sources.values():
        if sha256(path) != recorded:
            raise SystemExit(f"{path} changed since the clustering ran; refusing to mix inputs")
    panel_path = sources["mart_municipality_year_panel.parquet"][0]
    rows = duckdb.sql(f"select * from read_parquet('{panel_path.as_posix()}') where year = {result['year']}").df()
    out = {r.municipality_code: {"name": r.municipality_name, "county": r.county_name,
                                 "population": r.population, **{f: getattr(r, f, None) for f in FEATURES}}
           for r in rows.itertuples()}
    structure = json.loads(sources["kolada_structure_2024.json"][0].read_text(encoding="utf-8"))
    names = {kpi: name for name, kpi in structure["kpis"].items()}
    for row in structure["values"]:
        for v in row["values"]:
            if v["gender"] == "T" and row["municipality"] in out:
                out[row["municipality"]][names[row["kpi"]]] = v["value"]
    for m in out.values():
        for f in FEATURES:  # pandas reads a missing value as NaN
            if isinstance(m.get(f), float) and math.isnan(m[f]):
                m[f] = None
        m["log_population"] = math.log(m["population"]) if m["population"] else None
    return out


def geometry() -> tuple[list[dict], dict[str, tuple[float, float]]]:
    """Municipality rings rounded to 100 m, and centroids in metres."""
    with tempfile.TemporaryDirectory() as tmp:
        with zipfile.ZipFile(BOUNDARIES) as outer:
            outer.extract("Kommun_Sweref99TM.zip", tmp)
        with zipfile.ZipFile(Path(tmp) / "Kommun_Sweref99TM.zip") as inner:
            inner.extractall(tmp)
        con = duckdb.connect()
        con.sql("install spatial; load spatial")
        shp = next(Path(tmp).rglob("Kommun_Sweref99TM.shp")).as_posix()
        rows = con.sql(f"""select KnKod, st_asgeojson(geom), st_x(st_centroid(geom)), st_y(st_centroid(geom))
                           from st_read('{shp}') order by KnKod""").fetchall()
    shapes, centroids = [], {}
    for code, geojson, cx, cy in rows:
        g = json.loads(geojson)
        polygons = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        rings = [[[round(x / 100), round(y / 100)] for x, y in ring] for poly in polygons for ring in poly]
        shapes.append({"code": code, "rings": rings})
        centroids[code] = (cx, cy)
    return shapes, centroids


def reference_year(feature: str, year: int) -> int:
    """The year a 2024 value describes: turnout is the last election held, the rest their year."""
    return max(e for e in ELECTIONS if e <= year) if feature == "turnout_riksdag_pct" else year


def county_null(county: list[str], nearest: list[int], xy: np.ndarray, seed: int = 2024) -> dict:
    """How often the nearest social neighbour lies in another county, against chance."""
    c, nn, n = np.array(county), np.array(nearest), len(county)
    other = int((c != c[nn]).sum())
    same = (c[:, None] == c[None, :]).sum(axis=1) - 1
    rng = np.random.default_rng(seed)
    rounds, km = [], []
    for _ in range(ROUNDS):
        p = rng.permutation(n)
        rounds.append(int((c[p] != c[p][nn]).sum()))
        km.append(float(np.median(np.linalg.norm(xy[p] - xy[p][nn], axis=1))))
    pair = np.linalg.norm(xy[:, None] - xy[None, :], axis=2)
    np.fill_diagonal(pair, np.inf)
    return {"observed": other,
            "random_partner": round(float((1 - same / (n - 1)).sum()), 1),
            "permutation": {"rounds": ROUNDS, "seed": seed,
                            "mean": round(float(np.mean(rounds)), 1),
                            "interval_95": [int(v) for v in np.percentile(rounds, [2.5, 97.5])],
                            "share_at_most_observed": sum(r <= other for r in rounds) / ROUNDS,
                            "km_median": round(float(np.mean(km)) / 1000)},
            "random_pair_km_median": round(float(np.median(pair[np.triu_indices(n, 1)])) / 1000),
            "geographic_nearest_km_median": round(float(np.median(pair.min(axis=1))) / 1000)}


def main() -> int:
    if not RESULT.exists():
        print(f"SWEDEN similarity: {RESULT} is not here; committed files kept")
        return 0
    result = json.loads(RESULT.read_text(encoding="utf-8"))
    features = result["features"]
    assert set(features) == set(FEATURES), "the clustering's features changed"
    raw = values(result)
    shapes, centroids = geometry()
    points = {p["code"]: p for p in result["points"]}
    analysed = sorted(points)
    matrix = np.array([[raw[c][f] for f in features] for c in analysed], dtype=float)
    z = (matrix - matrix.mean(axis=0)) / matrix.std(axis=0)
    distance = np.sqrt(((z[:, None, :] - z[None, :, :]) ** 2).sum(axis=2))
    names = json.loads(NAMES.read_text(encoding="utf-8"))["names"]

    municipalities = []
    for code in sorted(raw):
        m, p = raw[code], points.get(code)
        row = {"code": code, "name": m["name"], "county": m["county"],
               "population": int(m["population"]) if m["population"] else None,
               "values": {f: (round(m[f], 4) if m[f] is not None else None) for f in features}}
        if p:
            i = analysed.index(code)
            order = [j for j in np.argsort(distance[i]) if j != i][:NEIGHBOURS]
            row |= {"group": p["group"], "finer": p["finer_group"], "skr_group": p["skr_group"],
                    "pc": [round(p["x"], 4), round(p["y"], 4)],
                    "neighbours": [[analysed[j], round(float(distance[i, j]), 3),
                                    round(math.dist(centroids[code], centroids[analysed[j]]) / 1000)]
                                   for j in order]}
        else:
            row["missing"] = [f for f in features if m[f] is None]
        municipalities.append(row)

    nearest = [r["neighbours"][0] for r in municipalities if "neighbours" in r]
    county = {r["code"]: r["county"] for r in municipalities}
    null = county_null([county[c] for c in analysed],
                       [analysed.index(r["neighbours"][0][0]) for r in municipalities if "neighbours" in r],
                       np.array([centroids[c] for c in analysed]))
    other_county = null["observed"]
    km = sorted(n[2] for n in nearest)
    OUT.mkdir(parents=True, exist_ok=True)
    payload = {
        "year": result["year"], "features": [{"id": f, "label_en": FEATURES[f][0], "label_sv": FEATURES[f][1],
                                              "unit": FEATURES[f][2], "reference_year": reference_year(f, result["year"])}
                                             for f in features],
        "summary": {"analysed": len(analysed), "total": len(raw),
                    "nearest_in_other_county": other_county,
                    "nearest_km_median": km[len(km) // 2], "nearest_km_p90": km[int(len(km) * 0.9)],
                    "nearest_over_300km": sum(1 for k in km if k > 300),
                    "county_null": {k: v for k, v in null.items() if k != "observed"}},
        "municipalities": municipalities,
    }
    (OUT / "municipalities.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
                                             encoding="utf-8")
    kmeans = {c["k"]: c for c in result["comparison"] if c["method"] == "kmeans"}
    groups = {
        "method": result["method"], "criterion": result["criterion"],
        "explained_variance": [round(v, 4) for v in result["explained_variance"]],
        "loadings": result["loadings"], "permutation": result["permutation"],
        "splits": [
            {"k": result["k"], "role": "gap rule", "silhouette": result["silhouette"],
             "bootstrap_ari": kmeans[result["k"]]["bootstrap_ari"], "ami_skr_groups": result["ami_skr_groups"],
             "null_silhouette_95": result["kmeans_null_95"][str(result["k"])], "profiles": result["profiles"]},
            {"k": result["finer"]["k"], "role": "finer split", "silhouette": result["finer"]["silhouette"],
             "bootstrap_ari": kmeans[result["finer"]["k"]]["bootstrap_ari"],
             "ami_skr_groups": result["finer"]["ami_skr_groups"],
             "null_silhouette_95": result["kmeans_null_95"][str(result["finer"]["k"])],
             "profiles": result["finer"]["profiles"], "names": names},
        ],
        "excluded": result["excluded_for_missing_values"],
        "limits": result["limits"],
        "provenance": {"run": RUN, "sources": result["sources"],
                       "boundaries": {"url": "https://scb.se/hitta-statistik/regional-statistik-och-kartor/regionala-indelningar/digitala-granser/",
                                      "licence": "CC0 1.0", "sha256": sha256(BOUNDARIES)},
                       "run_id": os.environ.get("GITHUB_RUN_ID"), "code_sha": os.environ.get("GITHUB_SHA")},
    }
    (OUT / "groups.json").write_text(json.dumps(groups, ensure_ascii=False, separators=(",", ":")) + "\n",
                                     encoding="utf-8")
    (OUT / "geometry.json").write_text(json.dumps({"crs": "EPSG:3006", "unit": "100 m", "municipalities": shapes},
                                                  separators=(",", ":")) + "\n", encoding="utf-8")
    sys.path.insert(0, str(ROOT / "platform/publish/symbolic"))
    import export_symbolic

    export_symbolic.register([OUT / n for n in ("municipalities.json", "groups.json", "geometry.json")])
    print(f"SWEDEN similarity: {len(analysed)} of {len(raw)} municipalities, "
          f"{other_county} nearest in another county -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
