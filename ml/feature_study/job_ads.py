"""Senior vs junior and role from Data/IT job ads: skill flags against engineered features.

    python -m ml.feature_study.job_ads [corpus folder ...]

Reads the JobTech cluster corpus (warehouse/raw/jobtech/cluster-corpus/<year>/*.parquet, or the
folders given) in one DuckDB pass with a 1 GB limit: occupation field Data/IT, a description of
at least 300 characters, deduplicated on the exact lower-cased description (tmp/job-ads-ml.md),
so a repost with an edited description stays in. Ads without an employer are left out (none in
2024-2025).
- Label: senior when the title matches SENIOR, junior when it matches JUNIOR; the title is never
  a feature. Role: the six largest occupation groups.
- Baseline: the 32 skill flags of platform/seeds/technology_patterns.csv in the body.
- Engineered (each added to the baseline on its own, then together):
  size: log skill count and log word count; stack: the ad's mean skill vector from an SVD of the
  skills' positive PMI (fitted on all ads, no labels); experience: years of experience asked
  for, lead/mentor words, entry words, remote or hybrid work; interactions: a gradient-boosted
  model on the flags alone.
- consistency (separate, close to leakage): senior or junior written in the body as well.
Logistic regression with balanced class weights, 5 folds grouped by employer, out-of-fold scores. AUC (seniority) and
macro-F1 (role) with a 1,000-round employer bootstrap; each set against the baseline with the
paired bootstrap, so the interval is for the difference.
"""
from __future__ import annotations

import csv
import re
import sys

import duckdb
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold, cross_val_predict
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from ml.feature_study.report import ROOT, write
from ml.mlkit.metrics import auc, cluster_bootstrap, macro_f1, paired_cluster_bootstrap

CORPUS = ROOT / "warehouse/raw/jobtech/cluster-corpus"
PATTERNS = ROOT / "platform/seeds/technology_patterns.csv"
SENIOR = r"\b(senior|lead|principal|sr|erfaren)\b"
JUNIOR = r"\b(junior|graduate|trainee|jr|nyexad\w*)\b"
# Body signals; the literal title words are kept apart in CONSISTENCY.
SIGNALS = {
    "years": r"\b(\d{1,2})\s*\+?\s*(?:års?|years?)\s*(?:av\s+|of\s+)?(?:\w+\s+){0,2}(?:erfarenhet|experience)",
    "lead": r"\b(mentor\w*|coach\w*|leda\b|leder\b|teamlead\w*|tech lead|arkitekt\w*|strateg\w*|ansvar för)",
    "entry": r"\b(nyexaminerad\w*|introduktionsprogram\w*|lära dig|utbildning hos oss|praktik\w*|entry.level|"
             r"ingen tidigare erfarenhet|no prior experience)",
    "remote": r"\b(distans\w*|remote|hybrid\w*|hemifrån|work from home)",
}
CONSISTENCY = {"body_senior": SENIOR, "body_junior": JUNIOR}
ROLES, FOLDS, BOOT, SEED = 6, 5, 1000, 20261022


def skills() -> list[tuple[str, str]]:
    with PATTERNS.open(encoding="utf-8") as handle:
        return [(row["skill"], row["pattern"]) for row in csv.DictReader(handle)]


def sql_text(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def load(folders: list[str]) -> tuple[dict, list[str]]:
    names = [s for s, _ in skills()]
    flags = ", ".join(f"regexp_matches(body, {sql_text(p)})::tinyint as flag_{i}" for i, (_, p) in enumerate(skills()))
    signals = ", ".join(f"regexp_matches(body, {sql_text(p)})::tinyint as signal_{i}"
                        for i, (k, p) in enumerate((k, p) for k, p in {**SIGNALS, **CONSISTENCY}.items() if k != "years"))
    paths = ", ".join(sql_text(f"{f}/*.parquet") for f in folders)
    query = f"""
        with ads as (
            select any_value(lower(title)) as title, any_value(employer) as employer,
                   any_value(occupation_group) as role, lower(any_value(description)) as body
            from read_parquet([{paths}])
            where occupation_field = 'Data/IT' and length(description) >= 300 and employer is not null
            group by md5(lower(description)))
        select employer, coalesce(role, '?') as role,
               case when regexp_matches(title, {sql_text(SENIOR)}) then 1
                    when regexp_matches(title, {sql_text(JUNIOR)}) then 0 end as senior,
               len(string_split(body, ' ')) as words,
               coalesce(list_max(list_transform(regexp_extract_all(body, {sql_text(SIGNALS['years'])}, 1),
                                                x -> least(x::int, 20))), 0) as years,
               {signals}, {flags}
        from ads"""
    with duckdb.connect() as con:
        con.execute("set memory_limit='1GB'")
        con.execute("set threads=2")
        rows = con.sql(query).fetchnumpy()
    other = [k for k in {**SIGNALS, **CONSISTENCY} if k != "years"]
    data = {"employer": rows["employer"].astype(str), "role": rows["role"].astype(str),
            "senior": np.array([np.nan if v is None else v for v in rows["senior"]], dtype=float),
            "words": np.asarray(rows["words"], float), "years": np.asarray(rows["years"], float)}
    data.update({k: np.asarray(rows[f"signal_{i}"], float) for i, k in enumerate(other)})
    data["flags"] = np.column_stack([rows[f"flag_{i}"] for i in range(len(names))]).astype(float)
    return data, names


def stack_vectors(flags: np.ndarray, dims: int = 8) -> np.ndarray:
    """Skill vectors from an SVD of positive PMI over co-mentions; an ad gets its skills' mean."""
    counts = flags.T @ flags
    total = flags.shape[0]
    single = np.diag(counts) + 1e-9
    with np.errstate(divide="ignore"):
        pmi = np.log(counts * total / np.outer(single, single))
    ppmi = np.where(np.isfinite(pmi) & (pmi > 0), pmi, 0)
    np.fill_diagonal(ppmi, 0)
    u, s, _ = np.linalg.svd(ppmi)
    vectors = u[:, :dims] * np.sqrt(s[:dims])
    n = flags.sum(axis=1, keepdims=True)
    return np.divide(flags @ vectors, n, out=np.zeros((len(flags), dims)), where=n > 0)


def feature_sets(data: dict) -> dict[str, np.ndarray]:
    flags = data["flags"]
    size = np.column_stack([np.log1p(flags.sum(axis=1)), np.log1p(data["words"])])
    experience = np.column_stack([data["years"], data["years"] > 0, data["lead"], data["entry"], data["remote"]])
    stack = stack_vectors(flags)
    base = {"skills": flags}
    for name, extra in (("size", size), ("stack", stack), ("experience", experience)):
        base[f"skills+{name}"] = np.hstack([flags, extra])
    base["skills+all"] = np.hstack([flags, size, stack, experience])
    base["skills+all+consistency"] = np.hstack([base["skills+all"], np.column_stack([data["body_senior"],
                                                                                      data["body_junior"]])])
    return base


def out_of_fold(x: np.ndarray, y: np.ndarray, groups: np.ndarray, model=None, proba: bool = True) -> np.ndarray:
    model = model or make_pipeline(StandardScaler(), LogisticRegression(max_iter=3000, class_weight="balanced"))
    method = "predict_proba" if proba else "predict"
    scores = cross_val_predict(model, x, y, groups=groups, cv=GroupKFold(FOLDS), method=method)
    return scores[:, 1] if proba and scores.ndim == 2 and len(np.unique(y)) == 2 else scores


def compare(sets: dict, y: np.ndarray, groups: np.ndarray, metric, proba: bool, interactions: bool) -> dict:
    predictions = {name: out_of_fold(x, y, groups, proba=proba) for name, x in sets.items()}
    if interactions:
        predictions["skills, boosted trees"] = out_of_fold(sets["skills"], y, groups, HistGradientBoostingClassifier(
            max_iter=200, learning_rate=0.05, class_weight="balanced", random_state=0), proba)
    out = {}
    for name, p in predictions.items():
        out[name] = {"score": cluster_bootstrap(metric, y, p, groups, BOOT, SEED)}
        if name != "skills":
            out[name]["vs_skills"] = paired_cluster_bootstrap(metric, y, p, predictions["skills"], groups, BOOT, SEED)
    return out


def main(folders: list[str]) -> None:
    data, names = load(folders)
    sets = feature_sets(data)
    labelled = ~np.isnan(data["senior"])
    y = data["senior"][labelled].astype(int)
    groups = data["employer"]
    seniority = compare({k: v[labelled] for k, v in sets.items()}, y, groups[labelled], auc, True, True)
    top = [r for r, _ in sorted(zip(*np.unique(data["role"][data["role"] != "?"], return_counts=True)),
                                key=lambda t: -t[1])[:ROLES]]
    in_role = np.isin(data["role"], top)
    roles = compare({k: v[in_role] for k, v in sets.items() if "consistency" not in k}, data["role"][in_role],
                    groups[in_role], macro_f1, False, True)
    majority = max(np.mean(data["role"][in_role] == r) for r in top)
    write("job_ads", {"folders": [re.sub(r".*cluster-corpus/", "", f) for f in folders], "ads": int(len(groups)),
                      "skills": names, "seniority": {"labelled": int(labelled.sum()), "senior_share": round(float(y.mean()), 4),
                                                     "employers": int(len(np.unique(groups[labelled]))), "sets": seniority},
                      "roles": {"groups": top, "ads": int(in_role.sum()), "majority_share": round(float(majority), 4),
                                "sets": roles}})


if __name__ == "__main__":
    main(sys.argv[1:] or [str(p) for p in sorted(CORPUS.iterdir()) if p.is_dir()])
