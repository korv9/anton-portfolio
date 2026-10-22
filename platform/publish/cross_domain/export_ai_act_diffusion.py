"""Publish the AI Act diffusion clock: when the Act's own terms appear in Riksdag speeches and job ads.

    python platform/publish/cross_domain/export_ai_act_diffusion.py

Reads gold.mart_ai_act_term_diffusion, gold.mart_ai_act_timeline and seeds.ai_act_terms and
writes frontend/public/data/ai-act/diffusion.json: per corpus its whole months and monthly rows
per term, and per corpus, term and milestone the adoption lag with its placebo p, all as
docs/ai-act-diffusion-preregistration.md fixes. The corpora are never pooled. Descriptive only.
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

ROOT = Path(__file__).resolve().parents[3]
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
OUT = ROOT / "frontend/public/data/ai-act/diffusion.json"
SEED, ROUNDS, MIN_PRE, PERCENTILE = 20261022, 200, 12, 95
MONTHS_EN = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
DEPARTURES = [
    "The EN-SV cosine per article (I-9) is not computed: the stored bge-m3 vectors of the English and "
    "the Swedish text are compressed with separate PCA fits, so their cosines are not comparable.",
    "Riksdagen has not yet published the 2026/27 speech archive; the Riksdag lane ends with the "
    "2025/26 archive (last speech 13 August 2026), so its last whole month is July 2026.",
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


def lags(corpus: str, months: list[str], series: dict, milestones: list[dict]) -> list[dict]:
    out = []
    for (term_id, language), rows in series.items():
        values = [r[3] for r in rows]
        for m in milestones:
            start = months.index(m["month"]) if m["month"] in months else -1
            if start < MIN_PRE:
                continue
            threshold, lag = adoption_lag(values, start)
            key = f"{corpus}|{term_id}|{language}|{m['milestone_id']}"
            p, eligible = placebo_p(values, lag, key)
            out.append({"corpus": corpus, "term_id": term_id, "language": language,
                        "milestone_id": m["milestone_id"], "milestone_month": m["month"],
                        "threshold": round(threshold, 7), "lag_months": lag,
                        "adoption_month": months[start + lag] if lag is not None else None,
                        "placebo_p": round(p, 4) if p is not None else None, "placebo_months": eligible})
    return out


def swedish_share(series: dict) -> list[dict]:
    """I-9: Swedish matches over Swedish plus English, per term pair and month with any match."""
    out = []
    for (term_id, language), rows in series.items():
        if language != "en" or (term_id, "sv") not in series:
            continue
        sv = series[(term_id, "sv")]
        out.append({"term_id": term_id, "rows": [[r[0], s[1], r[1]] for s, r in zip(sv, rows) if s[1] + r[1]]})
    return out


def build(con) -> dict:
    terms = con.sql("select * from seeds.ai_act_terms order by z desc").df()
    milestones = [{"milestone_id": i, "month": d.strftime("%Y-%m"), "date": d.isoformat(), "title_en": en,
                   "title_sv": sv} for i, d, en, sv in con.sql(
        "select milestone_id, date, title_en, title_sv from gold.mart_ai_act_timeline order by date, milestone_id"
    ).fetchall()]
    corpora, all_lags = [], []
    for (corpus,) in con.sql("select distinct corpus from gold.mart_ai_act_term_diffusion order by 1").fetchall():
        rows = con.sql(f"""select term_id, language, term, strftime(month, '%Y-%m'), matches, documents,
                                  share_rolling_3m
                           from gold.mart_ai_act_term_diffusion where corpus = '{corpus}'
                           order by term_id, language, month""").fetchall()
        series: dict = {}
        for term_id, language, term, month, n, d, rolling in rows:
            series.setdefault((term_id, language), []).append(
                [month, int(n), int(d), None if rolling is None else round(rolling, 7)])
        months = [r[0] for r in next(iter(series.values()))]
        tested = [m for m in milestones if m["month"] <= months[-1]]
        corpus_lags = lags(corpus, months, series, tested)
        all_lags += corpus_lags
        corpora.append({
            "corpus": corpus, "first_month": months[0], "last_month": months[-1], "years": year_labels(months),
            "documents": [[r[0], r[2]] for r in next(iter(series.values()))],
            "series": [{"term_id": t, "language": lang, "rows": [[r[0], r[1], r[3]] for r in rs]}
                       for (t, lang), rs in series.items()],
            "swedish_share": swedish_share(series),
        })
    tested_p = [x["placebo_p"] for x in all_lags if x["placebo_p"] is not None]
    kept = terms[terms["decision"] == "keep"]
    return {
        "columns": {"documents": ["month", "documents"], "series": ["month", "matches", "share_rolling_3m"],
                    "swedish_share": ["month", "sv_matches", "en_matches"]},
        "terms": [{"term_id": r.term_id, "term_sv": r.term_sv,
                   "term_en": r.term_en if r.en_decision == "keep" else None,
                   "act_count": int(r.act_count), "sfs_count": int(r.sfs_count), "z": float(r.z)}
                  for r in kept.itertuples()],
        "dropped": [{"term_sv": r.term_sv, "reason": r.reason} for r in terms[terms["decision"] != "keep"].itertuples()],
        "milestones": milestones,
        "corpora": corpora,
        "lags": all_lags,
        "diagnostics": {
            "tests": len(all_lags), "with_p": len(tested_p), "censored": sum(x["lag_months"] is None for x in all_lags),
            "p_at_most_0_05": sum(p <= 0.05 for p in tested_p), "placebo_rounds": ROUNDS, "seed": SEED,
        },
        "method": {
            "preregistration": "docs/ai-act-diffusion-preregistration.md",
            "terms": "Weighted log-odds (informative Dirichlet prior) of Act n-grams against SFS, top 60 reviewed; "
                     "platform/seeds/cross_domain/ai_act_terms.csv lists every dropped term and its reason.",
            "adoption": f"First month from the milestone month whose 3-month rolling share is above the "
                        f"{PERCENTILE}th percentile of the earlier months; at least {MIN_PRE} earlier months.",
            "placebo": f"{ROUNDS} random months per lag, each able to show the observed lag; "
                       f"p = (1 + placebo lags <= observed) / {ROUNDS + 1}; no multiple-test adjustment.",
            "never_pooled": True, "partial_months": "excluded", "departures": DEPARTURES,
        },
        "caveat_en": "A shorter lag than at random dates is timing, not proof that the Act caused it.",
        "caveat_sv": "En kortare fördröjning än vid slumpade datum visar tidpunkt, inte att förordningen orsakade den.",
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
