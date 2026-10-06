"""The quality layer's Python measures: what dbt cannot check (reconciliation across files,
provenance, freshness) and the diagnostics of analytical validity, read from the artefacts the
pipelines already wrote. Nothing here reruns a model.

Each data-quality function returns a Measurement: a value, and for ratios the numerator and
denominator it came from. Each validity function returns a Diagnostic: a value and details.
A function returns None when its input does not exist yet; the check is then not_measured.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
RAW = Path(os.environ.get("PORTFOLIO_RAW", ROOT / "warehouse/raw"))
FEATURES = Path(os.environ.get("PORTFOLIO_FEATURES", ROOT / "warehouse/features"))
PUBLIC = ROOT / "frontend/public/data"

# The hosts each source is served from. A file from any other host is not counted as official.
OFFICIAL_HOSTS = {
    "riksdagen": {"data.riksdagen.se", "www.riksdagen.se"},
    "val": {"resultat.val.se", "www.val.se"},
    "scb": {"api.scb.se", "www.scb.se", "statistikdatabasen.scb.se"},
    "fk": {"www.forsakringskassan.se"},
    "fohm": {"fohm-app.folkhalsomyndigheten.se", "www.folkhalsomyndigheten.se"},
    "kolada": {"api.kolada.se"},
    # The European Social Survey's data portal serves its files from this storage account.
    "ess": {"stessdissprodwe.blob.core.windows.net", "ess.sikt.no"},
    "symbolic": {"www.gutenberg.org"},
}


@dataclass
class Measurement:
    value: float | None
    numerator: float | None = None
    denominator: float | None = None
    details: dict = field(default_factory=dict)


@dataclass
class Diagnostic:
    value: float | None
    details: dict = field(default_factory=dict)


def _con():
    import duckdb

    return duckdb.connect(str(DATABASE), read_only=True)


def _exists(con, qualified: str) -> bool:
    schema, table = qualified.split(".")
    return bool(con.execute("select count(*) from information_schema.tables where table_schema = ? "
                            "and table_name = ?", [schema, table]).fetchone()[0])


def _ratio(numerator: int, denominator: int, **details) -> Measurement:
    if not denominator:
        return Measurement(None, numerator, denominator, {"reason": "nothing to measure", **details})
    return Measurement(numerator / denominator, numerator, denominator, details)


def _manifest(source: str) -> list[dict]:
    path = RAW / source / "_manifest.jsonl"
    if not path.is_file():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def _fetched(source: str) -> list[dict]:
    """Fetch-log entries for files downloaded over the network (not local metadata files)."""
    return [m for m in _manifest(source) if m.get("method") != "LOCAL" and str(m.get("url", "")).startswith("http")]


def _official_share(sources: list[str]) -> Measurement | None:
    entries = [(s, m) for s in sources for m in _fetched(s)]
    if not entries:
        return None
    ok = [1 for s, m in entries if urlparse(m["url"]).netloc in OFFICIAL_HOSTS[s]]
    hosts = sorted({urlparse(m["url"]).netloc for _, m in entries})
    return _ratio(len(ok), len(entries), hosts=hosts)


def _days_since_fetch(sources: list[str], oldest: bool = False) -> Measurement | None:
    latest = {}
    for s in sources:
        times = [m["fetched_at"] for m in _fetched(s) if m.get("fetched_at")]
        if times:
            latest[s] = max(times)
    if not latest:
        return None
    pick = min(latest.values()) if oldest else max(latest.values())
    age = (datetime.now(timezone.utc) - datetime.fromisoformat(pick)).total_seconds() / 86400
    return Measurement(round(age, 1), details={"last_fetch": latest, "compared": pick})


# ---------------------------------------------------------------- Symbolic Atlas

def symbolic_match_alignment() -> Measurement | None:
    con = _con()
    if not _exists(con, "silver.int_symbol_occurrences"):
        return None
    total, aligned = con.execute("""
        select count(*), count(*) filter (
            where lower(substr(d.clean_text, o.char_start + 1, o.char_end - o.char_start)) = lower(o.matched_term))
        from silver.int_symbol_occurrences o join silver.int_symbolic_documents d using (document_id)""").fetchone()
    return _ratio(aligned, total)


def symbolic_alias_match() -> Measurement | None:
    con = _con()
    if not _exists(con, "silver.int_symbol_occurrences"):
        return None
    total, matched = con.execute("""
        select count(*), count(a.alias)
        from silver.int_symbol_occurrences o
        left join seeds.symbol_aliases a
          on a.symbol_id = o.symbol_id and lower(a.alias) = lower(o.matched_term)""").fetchone()
    return _ratio(matched, total)


def symbolic_corpus_coverage() -> Measurement | None:
    corpus = json.loads((ROOT / "platform/ingest/symbolic/corpus.json").read_text(encoding="utf-8"))
    expected = {d["id"] for d in corpus["documents"]}
    con = _con()
    if not _exists(con, "silver.int_symbolic_documents"):
        return None
    present = {r[0] for r in con.execute("select document_id from silver.int_symbolic_documents").fetchall()}
    return _ratio(len(expected & present), len(expected), missing=sorted(expected - present))


def symbolic_symbol_coverage() -> Measurement | None:
    con = _con()
    if not _exists(con, "silver.int_symbol_occurrences"):
        return None
    symbols = {r[0] for r in con.execute("select symbol_id from seeds.symbols").fetchall()}
    found = {r[0] for r in con.execute("select distinct symbol_id from silver.int_symbol_occurrences").fetchall()}
    return _ratio(len(symbols & found), len(symbols), without_occurrences=sorted(symbols - found))


def symbolic_shared_sample() -> Measurement | None:
    folder = FEATURES / "symbolic/experiments"
    comparison = folder / "comparison.json"
    if not comparison.is_file():
        return None
    expected = json.loads(comparison.read_text(encoding="utf-8"))["sample_sha256"]
    runs = sorted(folder.glob("*/run.json"))
    same = [r.parent.name for r in runs if json.loads(r.read_text(encoding="utf-8")).get("sample_sha256") == expected]
    return _ratio(len(same), len(runs), sample_sha256=expected[:16],
                  differing=sorted({r.parent.name for r in runs} - set(same)))


def symbolic_source_provenance() -> Measurement | None:
    fetched = {Path(m["path"]).stem: m["sha256"] for m in _fetched("symbolic")}
    con = _con()
    if not fetched or not _exists(con, "silver.int_symbolic_documents"):
        return None
    rows = con.execute("select document_id, source_hash from silver.int_symbolic_documents").fetchall()
    ok = [d for d, h in rows if fetched.get(d) == h]
    return _ratio(len(ok), len(rows), mismatched=sorted({d for d, _ in rows} - set(ok)))


def symbolic_source_credibility() -> Measurement | None:
    return _official_share(["symbolic"])


# ---------------------------------------------------------------- Politics

def _session_start(session: str) -> int:
    return int(session[:4])


def politics_session_coverage() -> Measurement | None:
    con = _con()
    if not _exists(con, "gold.fct_roll_call"):
        return None
    sessions = sorted({r[0] for r in con.execute("select distinct session from gold.fct_roll_call").fetchall()})
    years = [_session_start(s) for s in sessions]
    expected = list(range(min(years), max(years) + 1))
    missing = [f"{y}/{str(y + 1)[-2:]}" for y in expected if y not in years]
    return _ratio(len(expected) - len(missing), len(expected), first=sessions[0], last=sessions[-1], missing=missing)


def politics_currentness() -> Measurement | None:
    return _days_since_fetch(["riksdagen"])


def politics_source_credibility() -> Measurement | None:
    return _official_share(["riksdagen", "val"])


# ---------------------------------------------------------------- Job market

def jobs_archive_reconciliation() -> Measurement | None:
    con = _con()
    if not _exists(con, "gold.mart_market_archives"):
        return None
    market = {a: n for a, n in con.execute("select archive, ads from gold.mart_market_archives").fetchall()}
    governance = {}
    for path in sorted((RAW / "jobtech/governance").glob("manifest_*.json")):
        m = json.loads(path.read_text(encoding="utf-8"))
        governance[m["archive"]] = m.get("ads")
    both = sorted(set(market) & set(governance))
    equal = [a for a in both if market[a] == governance[a]]
    return _ratio(len(equal), len(both), archives=both,
                  differing={a: [market[a], governance[a]] for a in both if a not in equal})


def _months(con) -> list[date]:
    return sorted(r[0] for r in con.execute(
        "select distinct month from gold.mart_market_field_monthly where ads > 0").fetchall())


def jobs_month_coverage() -> Measurement | None:
    con = _con()
    if not _exists(con, "gold.mart_market_field_monthly"):
        return None
    months = _months(con)
    first, last = months[0], months[-1]
    expected = (last.year - first.year) * 12 + last.month - first.month + 1
    present = {(m.year, m.month) for m in months}
    missing = []
    y, mo = first.year, first.month
    while (y, mo) <= (last.year, last.month):
        if (y, mo) not in present:
            missing.append(f"{y}-{mo:02d}")
        y, mo = (y + 1, 1) if mo == 12 else (y, mo + 1)
    return _ratio(expected - len(missing), expected, first=str(first)[:7], last=str(last)[:7], missing=missing)


def jobs_currentness() -> Measurement | None:
    con = _con()
    if not _exists(con, "gold.mart_market_field_monthly"):
        return None
    last = _months(con)[-1]
    today = date.today()
    age = (today.year - last.year) * 12 + today.month - last.month
    return Measurement(age, details={"latest_month": str(last)[:7], "today": str(today)})


def jobs_source_credibility() -> Measurement | None:
    con = _con()
    if not _exists(con, "gold.mart_market_archives"):
        return None
    rows = con.execute("select archive, source_url, sha256 from gold.mart_market_archives").fetchall()
    # Arbetsförmedlingen's archives, and JobTech's stream (Arbetsförmedlingen's open API).
    hosts = {"data.arbetsformedlingen.se", "jobstream.api.jobtechdev.se"}
    ok = [a for a, url, sha in rows if urlparse(url or "").netloc in hosts and sha]
    return _ratio(len(ok), len(rows))


def jobs_stream_currentness() -> Measurement | None:
    """Days between the daily stream's last complete day and today; None before its first run."""
    path = RAW / "jobtech/market/manifest_stream.json"
    if not path.exists():
        return None
    manifest = json.loads(path.read_text(encoding="utf-8"))
    last = date.fromisoformat(manifest["last_complete_day"])
    return Measurement((date.today() - last).days,
                       details={"last_complete_day": str(last), "complete_from": manifest["complete_from"],
                                "fetched_until": manifest["fetched_until"]})


# ---------------------------------------------------------------- Welfare

WELFARE_SOURCES = ["scb", "fk", "fohm", "kolada", "ess"]


def welfare_currentness() -> Measurement | None:
    return _days_since_fetch(WELFARE_SOURCES, oldest=True)


def welfare_source_credibility() -> Measurement | None:
    return _official_share(WELFARE_SOURCES)


# ---------------------------------------------------------------- EU AI Act

# Regulation (EU) 2024/1689 as published in the Official Journal: 113 articles, 180 recitals,
# 13 annexes.
OFFICIAL_JOURNAL = "32024R1689"
PUBLISHED_STRUCTURE = {"article": 113, "recital": 180, "annex": 13}


def ai_act_structure() -> Measurement | None:
    con = _con()
    if not _exists(con, "silver.int_ai_act_provisions"):
        return None
    checks, ok = [], 0
    for language in ("en", "sv"):
        counts = dict(con.execute("""select provision_kind, count(*) from silver.int_ai_act_provisions
                                     where version_celex = ? and language = ? group by 1""",
                                  [OFFICIAL_JOURNAL, language]).fetchall())
        for kind, expected in PUBLISHED_STRUCTURE.items():
            good = counts.get(kind) == expected
            ok += good
            checks.append({"language": language, "part": kind, "found": counts.get(kind), "expected": expected, "ok": good})
        numbers = sorted(int(n) for (n,) in con.execute("""select number from silver.int_ai_act_provisions
            where version_celex = ? and language = ? and provision_kind = 'article'""",
            [OFFICIAL_JOURNAL, language]).fetchall() if str(n).isdigit())
        good = numbers == list(range(1, 114))
        ok += good
        checks.append({"language": language, "part": "article numbers 1-113", "ok": good})
    return _ratio(ok, len(checks), checks=checks)


def ai_act_article_coverage() -> Measurement | None:
    con = _con()
    if not _exists(con, "gold.dim_ai_act_article"):
        return None
    current = con.execute("""select version_celex from silver.int_ai_act_provisions
                             where version_celex like '0%' order by version_celex desc limit 1""").fetchone()[0]
    expected = con.execute("""select count(distinct number) from silver.int_ai_act_provisions
                              where version_celex = ? and provision_kind = 'article'""", [current]).fetchone()[0]
    both = con.execute("""select count(*) from gold.dim_ai_act_article
                          where text_en is not null and text_sv is not null""").fetchone()[0]
    return _ratio(min(both, expected), expected, version=current, articles_in_dimension=both)


def ai_act_currentness() -> Measurement | None:
    return _days_since_fetch(["eu_ai_act"])


# ---------------------------------------------------------------- Philosophy, concepts

def philosophy_translator_metadata() -> Measurement | None:
    con = _con()
    if not _exists(con, "gold.dim_philosophy_document"):
        return None
    rows = con.execute("""select document_id, translator, translator_note from gold.dim_philosophy_document
                          where original_language <> text_language""").fetchall()
    ok = [d for d, t, n in rows if t or n]
    return _ratio(len(ok), len(rows), missing=sorted({d for d, *_ in rows} - set(ok)))


def concepts_chunk_provenance() -> Measurement | None:
    con = _con()
    if not _exists(con, "gold.dim_text_chunk"):
        return None
    total, ok = con.execute("""select count(*), count(*) filter (where source_url like 'http%'
                               and source_version is not null and retrieved_at is not null)
                               from gold.dim_text_chunk""").fetchone()
    return _ratio(ok, total)


# ================================================================ validity diagnostics

def _json(path: Path) -> dict | None:
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else None


def _experiments(path: Path | None = None) -> dict[str, dict] | None:
    data = _json(path or FEATURES / "symbolic/experiments/comparison.json")
    return {e["experiment"]: e for e in data["experiments"]} if data else None


def symbolic_experiment_metric(experiment: str, metric: str) -> Diagnostic | None:
    runs = _experiments()
    if not runs or experiment not in runs:
        return None
    return Diagnostic(runs[experiment][metric], {"experiment": experiment, "metric": metric,
                                                 "occurrences": runs[experiment]["occurrences"],
                                                 "clusters": runs[experiment]["clusters"]})


def symbolic_experiment_change(metric: str, before: str, after: str) -> Diagnostic | None:
    runs = _experiments()
    if not runs or before not in runs or after not in runs:
        return None
    return Diagnostic(round(runs[after][metric] - runs[before][metric], 4),
                      {"metric": metric, before: runs[before][metric], after: runs[after][metric]})


def symbolic_reviewed_clusters() -> Diagnostic | None:
    reviews = _json(ROOT / "platform/nlp/symbolic/reviewed_clusters.json")
    if reviews is None:
        return None
    clusters = reviews.get("clusters", [])
    reviewed = [c for c in clusters if c.get("status") == "reviewed"]
    return Diagnostic(len(reviewed), {"review_entries": len(clusters)})


def symbolic_cleaning_history() -> list[dict]:
    """The same diagnostics before and after paratext cleaning: the validity history."""
    folder = FEATURES / "symbolic/experiments"
    out = []
    for label, path in (("before_cleaning", folder / "history/v2-before-cleaning/comparison.json"),
                        ("current", folder / "comparison.json")):
        runs = _experiments(path)
        if not runs:
            continue
        for experiment, row in runs.items():
            for metric in ("mean_largest_book_share", "cross_book_occurrence_share", "mean_book_entropy",
                           "cross_book_cluster_count", "trustworthiness", "silhouette"):
                if metric in row:
                    out.append({"run_label": label, "experiment": experiment, "metric": metric, "value": row[metric]})
    return out


def symbolic_corpus_size() -> Diagnostic | None:
    corpus = _json(ROOT / "platform/ingest/symbolic/corpus.json")
    if not corpus:
        return None
    docs = corpus["documents"]
    traditions = sorted({d["tradition"] for d in docs})
    return Diagnostic(len(docs), {"books": len(docs), "traditions": traditions,
                                  "languages": sorted({d["language"] for d in docs})})


def _boost() -> dict | None:
    return _json(PUBLIC / "politics/parliament/boost.json")


def politics_split_integrity() -> Diagnostic | None:
    boost = _boost()
    if not boost:
        return None
    return Diagnostic(1.0 if boost["train_session"] != boost["test_session"] else 0.0,
                      {"train_session": boost["train_session"], "test_session": boost["test_session"]})


def politics_parties_beating_baseline() -> Diagnostic | None:
    boost = _boost()
    if not boost:
        return None
    parties = {p["party"]: [p["accuracy"], p["baseline"]] for p in boost["parties"]}
    better = [p for p, (a, b) in parties.items() if a > b]
    return Diagnostic(round(len(better) / len(parties), 4),
                      {"parties": parties, "beating_baseline": sorted(better)})


def ai_politics_baseline() -> Diagnostic | None:
    run = _json(FEATURES / "ai_politics/run.json")
    if not run:
        return None
    baseline = run.get("baseline_random_pairs") or {}
    p95 = baseline.get("p95")
    return Diagnostic(p95, {"baseline": baseline, "model": run.get("model")})


def jobs_occupation_mix_shift() -> Diagnostic | None:
    con = _con()
    if not _exists(con, "gold.mart_market_field_monthly"):
        return None
    rows = con.execute("""select year(month) y, sum(ads) filter (where field = 'Data/IT') / sum(ads) as it_share,
                                 count(distinct month) as months
                          from gold.mart_market_field_monthly group by 1 order by 1""").fetchall()
    full = [(y, s) for y, s, m in rows if m == 12]
    if len(full) < 2:
        return None
    (y0, s0), (y1, s1) = full[0], full[-1]
    change = round((s1 - s0) * 100, 2)
    return Diagnostic(abs(change), {"change_pp": change, "from": [y0, round(s0, 4)], "to": [y1, round(s1, 4)]})


def jobs_duplicate_share() -> Diagnostic | None:
    con = _con()
    if not _exists(con, "gold.mart_market_archives"):
        return None
    read, dup = con.execute("select sum(ads_read), sum(duplicates) from gold.mart_market_archives").fetchone()
    return Diagnostic(round(dup / read, 6) if read else None, {"ads_read": int(read or 0), "duplicates": int(dup or 0)})


def ai_act_navigator_references() -> Diagnostic | None:
    navigator = _json(ROOT / "platform/publish/eu_ai_act/navigator.json")
    con = _con()
    if not navigator or not _exists(con, "gold.dim_ai_act_article"):
        return None
    articles = {str(r[0]) for r in con.execute("select article_number from gold.dim_ai_act_article").fetchall()}
    obligations = {r[0] for r in con.execute("select obligation_id from gold.mart_ai_act_obligations").fetchall()}
    refs, ok = 0, 0
    for q in navigator["questions"]:
        for a in q.get("articles", []):
            refs += 1
            ok += str(a) in articles
        for effect in q.get("effects", {}).values():
            for o in effect.get("obligations", []):
                refs += 1
                ok += o in obligations
    return Diagnostic(round(ok / refs, 4) if refs else None, {"references": refs, "resolved": ok})


def timeline_rise_after_2022() -> Diagnostic | None:
    con = _con()
    if not _exists(con, "gold.mart_ai_governance_timeline"):
        return None
    rows = dict(con.execute("""select year(month), sum(numerator) / sum(denominator)
                               from gold.mart_ai_governance_timeline where series_id = 'jobs_ai_any'
                               group by 1""").fetchall())
    if 2022 not in rows or 2025 not in rows or not rows[2022]:
        return None
    return Diagnostic(round(rows[2025] / rows[2022], 2), {"share_2022": round(rows[2022], 5), "share_2025": round(rows[2025], 5)})


def philosophy_neighbour_metric(variant: str, metric: str, chance: str) -> Diagnostic | None:
    run = _json(FEATURES / "philosophy/run.json")
    if not run:
        return None
    e = run["evaluation"][variant]
    return Diagnostic(round(e[metric] / e[chance], 2), {"variant": variant, metric: round(e[metric], 4),
                                                        chance: round(e[chance], 4)})


def concepts_metric(metric: str, chance: str | None = None) -> Diagnostic | None:
    run = _json(FEATURES / "concepts/run.json")
    if not run:
        return None
    e = run["evaluation"]
    if chance:
        return Diagnostic(round(e[metric] / e[chance], 2), {metric: round(e[metric], 4), chance: round(e[chance], 4)})
    return Diagnostic(round(e[metric], 4), {metric: e[metric]})
