"""Publish the AI Act diffusion clock: when the Act's own terms appear in Riksdag speeches and job ads.

    python platform/publish/cross_domain/export_ai_act_diffusion.py

Reads gold.mart_ai_act_term_diffusion, gold.mart_ai_act_timeline, seeds.ai_act_terms and
seeds.ai_act_term_precision and writes frontend/public/data/ai-act/diffusion.json: per corpus its
whole months and monthly rows per term, and per corpus, term and milestone the adoption lag with
its placebo p, all as docs/ai-act-diffusion-preregistration.md fixes. The primary (pre-registered)
and the amended term list are reported side by side, never one in place of the other. The corpora
are never pooled. Descriptive only.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
OUT = ROOT / "frontend/public/data/ai-act/diffusion.json"
SEED, ROUNDS, MIN_PRE, PERCENTILE = 20261022, 200, 12, 95
FEW = 5  # a lag whose adoption window holds this many matches or fewer gives no informative p
LISTS = ("primary", "amended")
MONTHS_EN = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
DEPARTURES = [
    "The EN-SV cosine per article (I-9) is not computed: the stored bge-m3 vectors of the English and "
    "the Swedish text are compressed with separate PCA fits, so their cosines are not comparable.",
    "Riksdagen has not yet published the 2026/27 speech archive; the Riksdag lane ends with the "
    "2025/26 archive (last speech 13 August 2026), so its last whole month is July 2026.",
    "Amendment of 2026-10-22 (docs/ai-act-diffusion-preregistration.md): review had dropped ai-system, "
    "ai-modell and the sandbox terms as general_language, a reason meant for common phrases with uses "
    "outside AI. Re-reviewed against the reason definitions, with every token allowed four letters of "
    "inflection and a precision check of up to 50 matched speeches per re-admitted term (kept at 0.8 or "
    "more), they form the amended list. It is reported beside the primary list, which stays as "
    "pre-registered.",
    "Job ads start in January 2020 as pre-registered. The 2020 archive also holds 117 ads from October to "
    "December 2019, whose other ads sit in archives that are not counted, so those months are left out.",
    "Ad precision: the 50 ads per re-admitted term were drawn (seed 20261022) from the matches in the 2022 to "
    "2026-Q3 archives, 323 of 347 for ai-system and 420 of 427 for ai-modell, because the local read stopped "
    "before the 2020 and 2021 archives. All nine ads behind each of the two longer primary terms were read.",
]


def adoption_lag(values: list, start: int) -> tuple[float, int | None]:
    """Threshold (95th percentile of the rolling share before `start`) and months to the first value above it."""
    threshold = float(np.percentile([v for v in values[:start] if v is not None], PERCENTILE))
    for i in range(start, len(values)):
        if values[i] is not None and values[i] > threshold:
            return threshold, i - start
    return threshold, None


def placebo_p(values: list, lag: int | None, key: str, rounds: int = ROUNDS) -> tuple[float | None, int]:
    """One-sided p of `lag` against the same rule at random months that could show it; and the eligible months."""
    eligible = [s for s in range(MIN_PRE, len(values)) if lag is not None and s + lag < len(values)]
    if not eligible:
        return None, 0
    rng = np.random.default_rng([SEED, int.from_bytes(hashlib.sha256(key.encode()).digest()[:8], "big")])
    shorter = 0
    for start in rng.choice(eligible, size=rounds, replace=True):
        placebo = adoption_lag(values, int(start))[1]
        shorter += placebo is not None and placebo <= lag
    return (1 + shorter) / (rounds + 1), len(eligible)


def year_labels(months: list[str]) -> list[dict]:
    """Each year of a corpus with the months it covers; a partial year is labelled with them."""
    years: dict[str, list[int]] = {}
    for m in months:
        years.setdefault(m[:4], []).append(int(m[5:7]))
    return [{"year": int(y), "months": len(ms),
             "label": y if len(ms) == 12 else f"{y} ({MONTHS_EN[ms[0] - 1]}-{MONTHS_EN[ms[-1] - 1]})"}
            for y, ms in years.items()]


def reading(window_matches: int | None) -> str | None:
    """A lag resting on FEW matches or fewer is uninformative whatever its p."""
    if window_matches is None or window_matches > FEW:
        return None
    return f"uninformative ({window_matches} match{'' if window_matches == 1 else 'es'})"


def result(lags: list[dict]) -> str:
    """One line per corpus and term list: no adoption, uninformative, or tested."""
    found = [x["window_matches"] for x in lags if x["lag_months"] is not None]
    if not found:
        return "no adoption (every lag censored)"
    if max(found) <= FEW:
        return reading(1) if max(found) == 1 else f"uninformative (at most {max(found)} matches per lag)"
    return "tested: see the lags"


def lags(corpus: str, months: list[str], series: dict, milestones: list[dict]) -> list[dict]:
    out = []
    for (term_list, term_id, language), rows in series.items():
        values = [r[3] for r in rows]
        for m in milestones:
            start = months.index(m["month"]) if m["month"] in months else -1
            if start < MIN_PRE:
                continue
            threshold, lag = adoption_lag(values, start)
            # The primary key is as pre-registered; the amended list has generators of its own.
            key = f"{corpus}|{term_id}|{language}|{m['milestone_id']}" + ("" if term_list == "primary" else "|amended")
            p, eligible = placebo_p(values, lag, key)
            end = start + lag if lag is not None else None
            window = sum(r[1] for r in rows[max(0, end - 2):end + 1]) if end is not None else None
            out.append({"corpus": corpus, "term_list": term_list, "term_id": term_id, "language": language,
                        "milestone_id": m["milestone_id"], "milestone_month": m["month"],
                        "threshold": round(threshold, 7), "lag_months": lag,
                        "adoption_month": months[start + lag] if lag is not None else None,
                        "placebo_p": round(p, 4) if p is not None else None, "placebo_months": eligible,
                        "window_matches": window, "reading": reading(window)})
    return out


def side_by_side(all_lags: list[dict]) -> list[dict]:
    """Primary and amended lag per corpus, term, language and milestone in one row."""
    rows: dict = {}
    for x in all_lags:
        row = rows.setdefault((x["corpus"], x["term_id"], x["language"], x["milestone_id"]),
                              {k: x[k] for k in ("corpus", "term_id", "language", "milestone_id")})
        row[x["term_list"]] = {k: x[k] for k in ("lag_months", "placebo_p", "window_matches", "reading")}
    return list(rows.values())


def diagnostics(lags: list[dict]) -> dict:
    with_p = [x for x in lags if x["placebo_p"] is not None]
    return {"tests": len(lags), "with_p": len(with_p), "censored": sum(x["lag_months"] is None for x in lags),
            "p_at_most_0_05": sum(x["placebo_p"] <= 0.05 for x in with_p),
            f"lags_on_at_most_{FEW}_matches": sum(x["window_matches"] <= FEW for x in with_p)}


def swedish_share(series: dict) -> list[dict]:
    """I-9: Swedish matches over Swedish plus English, per term pair and month with any match."""
    out = []
    for (term_list, term_id, language), rows in series.items():
        if language != "en" or (term_list, term_id, "sv") not in series:
            continue
        sv = series[(term_list, term_id, "sv")]
        out.append({"term_list": term_list, "term_id": term_id, "rows": [[r[0], s[1], r[1]] for s, r in zip(sv, rows) if s[1] + r[1]]})
    return out


def build(con) -> dict:
    terms = con.sql("select * from seeds.ai_act_terms order by z desc").df()
    precision = con.sql("select * from seeds.ai_act_term_precision order by corpus desc, term_id, language").df()
    milestones = [{"milestone_id": i, "month": d.strftime("%Y-%m"), "date": d.isoformat(), "title_en": en,
                   "title_sv": sv} for i, d, en, sv in con.sql(
        "select milestone_id, date, title_en, title_sv from gold.mart_ai_act_timeline order by date, milestone_id"
    ).fetchall()]
    corpora, all_lags = [], []
    for (corpus,) in con.sql("select distinct corpus from gold.mart_ai_act_term_diffusion order by 1").fetchall():
        rows = con.sql(f"""select term_list, term_id, language, strftime(month, '%Y-%m'), matches, documents,
                                  share_rolling_3m
                           from gold.mart_ai_act_term_diffusion where corpus = '{corpus}'
                           order by term_list desc, term_id, language, month""").fetchall()
        series: dict = {}
        for term_list, term_id, language, month, n, d, rolling in rows:
            series.setdefault((term_list, term_id, language), []).append(
                [month, int(n), int(d), None if rolling is None else round(rolling, 7)])
        months = [r[0] for r in next(iter(series.values()))]
        tested = [m for m in milestones if m["month"] <= months[-1]]
        corpus_lags = lags(corpus, months, series, tested)
        all_lags += corpus_lags
        corpora.append({
            "corpus": corpus, "first_month": months[0], "last_month": months[-1], "years": year_labels(months),
            "documents": [[r[0], r[2]] for r in next(iter(series.values()))],
            "series": [{"term_list": tl, "term_id": t, "language": lang, "rows": [[r[0], r[1], r[3]] for r in rs]}
                       for (tl, t, lang), rs in series.items()],
            "swedish_share": swedish_share(series),
            "result": {tl: result([x for x in corpus_lags if x["term_list"] == tl]) for tl in LISTS},
        })

    def listed(kept, en_column):
        return [{"term_id": r.term_id, "term_sv": r.term_sv,
                 "term_en": r.term_en if getattr(r, en_column) == "keep" else None,
                 "act_count": int(r.act_count), "sfs_count": int(r.sfs_count), "z": float(r.z)}
                for r in kept.itertuples()]

    # employers: distinct employers among the matched ads read, a check that the matches are not one poster's.
    checked = {(r.corpus, r.term_id, r.language): {
        "matched": int(r.matched), "sampled": int(r.sampled), "on_topic": int(r.on_topic),
        "precision": None if r.sampled == 0 else float(r.precision),
        "employers": None if pd.isna(getattr(r, "employers", None)) else int(r.employers)}
        for r in precision.itertuples()}
    amended = listed(terms[terms["amended_decision"] == "keep"], "amended_en_decision")
    for t in amended:
        t["precision"] = {}
        for (corpus, term_id, lang), v in checked.items():
            if term_id == t["term_id"]:
                t["precision"].setdefault(corpus, {})[lang] = v
    return {
        "columns": {"documents": ["month", "documents"], "series": ["month", "matches", "share_rolling_3m"],
                    "swedish_share": ["month", "sv_matches", "en_matches"]},
        "terms": listed(terms[terms["decision"] == "keep"], "en_decision"),
        "amended_terms": amended,
        "dropped": [{"term_sv": r.term_sv, "reason": r.reason} for r in terms[terms["decision"] != "keep"].itertuples()],
        "amended_dropped": [{"term_sv": r.term_sv, "reason": r.amended_reason}
                            for r in terms[terms["amended_decision"] != "keep"].itertuples()],
        "precision": [{"corpus": k[0], "term_id": k[1], "language": k[2], **v} for k, v in checked.items()],
        "milestones": milestones,
        "corpora": corpora,
        "lags": all_lags,
        "lags_side_by_side": side_by_side(all_lags),
        "diagnostics": {
            "tests": len(all_lags), "placebo_rounds": ROUNDS, "seed": SEED, "few_matches": FEW,
            **{tl: diagnostics([x for x in all_lags if x["term_list"] == tl]) for tl in LISTS},
        },
        "method": {
            "preregistration": "docs/ai-act-diffusion-preregistration.md",
            "terms": "Weighted log-odds (informative Dirichlet prior) of Act n-grams against SFS, top 60 reviewed; "
                     "platform/seeds/cross_domain/ai_act_terms.csv lists every dropped term and its reason.",
            "adoption": f"First month from the milestone month whose 3-month rolling share is above the "
                        f"{PERCENTILE}th percentile of the earlier months; at least {MIN_PRE} earlier months.",
            "placebo": f"{ROUNDS} random months per lag, each able to show the observed lag; "
                       f"p = (1 + placebo lags <= observed) / {ROUNDS + 1}; no multiple-test adjustment.",
            "term_lists": "primary: the pre-registered terms and matching; amended: the 2026-10-22 amendment. "
                          "Both are reported, side by side in lags_side_by_side.",
            "precision": "Up to 50 random matched speeches or ads per re-admitted term and language, read by "
                         "hand; a term is kept at 0.8 or more. For ads, employers counts the distinct employers "
                         "among the ads read. Only the counts are stored.",
            "never_pooled": True, "partial_months": "excluded", "departures": DEPARTURES,
        },
        "caveat_en": "A shorter lag than at random dates is timing, not proof that the Act caused it. A lag whose "
                     f"three-month window holds {FEW} matches or fewer gives a p-value that says nothing.",
        "caveat_sv": "En kortare fördröjning än vid slumpade datum visar tidpunkt, inte att förordningen orsakade "
                     f"den. Vilar en fördröjning på {FEW} träffar eller färre i sitt tremånadersfönster säger "
                     "p-värdet ingenting.",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def main() -> int:
    con = duckdb.connect(str(DATABASE), read_only=True)
    con.execute("set memory_limit = '1GB'")
    payload = build(con)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    sys.path.insert(0, str(ROOT / "platform/publish/symbolic"))
    import export_symbolic

    export_symbolic.register([OUT])
    print(f"AI Act diffusion: {len(payload['corpora'])} corpora, {payload['diagnostics']['tests']} lags -> "
          f"{OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1000:.0f} kB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
