"""Rising and falling words in IT job ads: the latest twelve complete months against the twelve before.

    python platform/nlp/rising_terms.py [--database warehouse/jobtech/history.duckdb]

Reads the archive build of platform/ingest/jobtech/run_history_pipeline.py (subject jobs_analysis):
bronze.stg_job_ads.description, with the role family and publication time of gold.fct_job_ads.
The two windows follow the data: the latest month that gold.mart_job_trends_monthly marks complete
ends the recent window, and all 24 months must be complete, or nothing is written.

Words and two-word phrases (platform/nlp/log_odds.py tokens, never across a line break) are
scored per role family with weighted log-odds (Monroe, Colaresi and Quinn 2008) of the recent
window against the window before. A term is kept when it
  - neither starts nor ends with a Swedish or English stopword and has no all-digit token;
  - is used at least MIN_USES times by at least MIN_EMPLOYERS distinct employers over both
    windows, which drops one employer's boilerplate and most names;
  - is not, as whole words, in the employer's own name in NAME_SHARE or more of its uses
    (employer names);
  - has no token that is, or begins with a place name of six letters or more from, the
    municipalities and counties of the ads (place names);
  - has |z| >= Z_MIN. At most TOP terms per side (rising, falling), with the counts behind each.
No ad text is written: jobs/rising-terms.json holds terms and counts only.
"""
from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, timezone
from pathlib import Path

import duckdb

from portfolio.core import io

sys.path.insert(0, str(Path(__file__).resolve().parent))
from log_odds import STOP_EN, STOP_SV, TOKEN, allowed, log_odds_z  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
DATABASE = ROOT / "warehouse/jobtech/history.duckdb"
OUT = ROOT / "frontend/public/data/jobs/rising-terms.json"
STOP = STOP_SV | STOP_EN
MIN_USES, MIN_EMPLOYERS, NAME_SHARE, PLACE_PREFIX, Z_MIN, TOP = 20, 10, 0.2, 6, 3.29, 30

COUNTS = """
with ads as (
    select s.job_id,
        nullif(' ' || array_to_string(regexp_extract_all(lower(coalesce(s.employer_name, '')), $token), ' ') || ' ',
               '  ') as employer,
        case when f.published_at >= $recent then 'recent' else 'before' end as side,
        lower(s.description) as text
    from gold.fct_job_ads as f
    join bronze.stg_job_ads as s using (job_id)
    where f.role_family = $role and f.published_at >= $before and f.published_at < $end
), lines as (
    select employer, side, regexp_extract_all(unnest(string_split(text, chr(10))), $token) as t
    from ads
), grams as (
    select employer, side, 1 as n, unnest(t) as term from lines
    union all
    select employer, side, 2 as n,
        unnest(list_transform(range(1, len(t)), i -> t[i] || ' ' || t[i + 1])) as term
    from lines where len(t) > 1
), totals as (
    select side, n, count(*) as grams from grams group by all
)
select 'total' as kind, side as term, n, grams as recent, 0 as before, 0 as employers, 0 as own_name
from totals
union all
select 'term', term, n,
    count(*) filter (where side = 'recent'), count(*) filter (where side = 'before'),
    count(distinct employer), count(*) filter (where contains(employer, ' ' || term || ' '))
from grams
where not list_contains($stop, split_part(term, ' ', 1))
  and not list_contains($stop, split_part(term, ' ', -1))
group by term, n
having count(*) >= $min_uses and count(distinct employer) >= $min_employers
"""


def add_months(month: date, k: int) -> date:
    index = month.year * 12 + month.month - 1 + k
    return date(index // 12, index % 12 + 1, 1)


def windows(complete: list[date]) -> tuple[date, date, date] | None:
    """(before, recent, end): the start of the 24 months, of the latest 12, and the month after."""
    if not complete:
        return None
    latest = max(complete)
    needed = {add_months(latest, -k) for k in range(24)}
    if not needed <= set(complete):
        return None
    return add_months(latest, -23), add_months(latest, -11), add_months(latest, 1)


def is_place(gram: tuple[str, ...], places: set[str]) -> bool:
    return any(t in places or any(t.startswith(p) for p in places if len(p) >= PLACE_PREFIX)
               for t in gram)


def rank(found: list[tuple], places: set[str]) -> dict:
    """The rising and falling terms of one role family from its COUNTS rows."""
    totals = {(side, n): grams for kind, side, n, grams, *_ in found if kind == "total"}
    dropped = {"stopword_or_number": 0, "employer_name": 0, "place_name": 0}
    scored = []
    for kind, term, n, recent, before, employers, own_name in found:
        if kind != "term":
            continue
        gram = tuple(term.split())
        if not allowed(gram, STOP):
            dropped["stopword_or_number"] += 1
        elif own_name >= NAME_SHARE * (recent + before):
            dropped["employer_name"] += 1
        elif is_place(gram, places):
            dropped["place_name"] += 1
        else:
            z = log_odds_z(recent, totals.get(("recent", n), 0), before, totals.get(("before", n), 0))
            scored.append({"term": term, "words": n, "recent_uses": recent, "before_uses": before,
                           "employers": employers, "z": round(z, 2)})
    rising = sorted((r for r in scored if r["z"] >= Z_MIN), key=lambda r: (-r["z"], r["term"]))
    falling = sorted((r for r in scored if r["z"] <= -Z_MIN), key=lambda r: (r["z"], r["term"]))
    return {"totals": {f"{side}_{'words' if n == 1 else 'phrases'}": v for (side, n), v in sorted(totals.items())},
            "candidates": len(scored) + sum(dropped.values()), "dropped": dropped,
            "rising": rising[:TOP], "falling": falling[:TOP]}


def places_of(connection) -> set[str]:
    names = connection.execute("""
        select distinct lower(v) from bronze.stg_job_ads,
            unnest([municipality, region]) as u(v) where v is not null""").fetchall()
    return {t for (name,) in names for t in TOKEN.findall(name)}


def build(connection) -> dict:
    complete = [m for (m,) in connection.execute("""
        select distinct publication_month from gold.mart_job_trends_monthly where is_complete""").fetchall()]
    found = windows(complete)
    if not found:
        raise SystemExit("rising terms: 24 complete months ending in the latest complete month are needed")
    before, recent, end = found
    places = places_of(connection)
    roles = [r for (r,) in connection.execute("""
        select distinct role_family from gold.fct_job_ads where role_family <> 'Other' order by 1""").fetchall()]
    result = []
    for role in roles:
        rows = connection.execute(COUNTS, {
            "role": role, "before": before, "recent": recent, "end": end, "token": TOKEN.pattern,
            "stop": sorted(STOP), "min_uses": MIN_USES, "min_employers": MIN_EMPLOYERS}).fetchall()
        ads = connection.execute("""
            select count(*) filter (where published_at >= $recent), count(*) filter (where published_at < $recent)
            from gold.fct_job_ads where role_family = $role and published_at >= $before and published_at < $end""",
            {"role": role, "before": before, "recent": recent, "end": end}).fetchone()
        result.append({"role_family": role, "recent_ads": ads[0], "before_ads": ads[1], **rank(rows, places)})
        print(f"  {role}: {len(result[-1]['rising'])} rising, {len(result[-1]['falling'])} falling", flush=True)
    return {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "Arbetsförmedlingen JobTech, historical ad archives (CC0 1.0)",
        "model": "bronze.stg_job_ads.description with gold.fct_job_ads",
        "recent": {"from": recent.isoformat()[:7], "to": add_months(end, -1).isoformat()[:7]},
        "before": {"from": before.isoformat()[:7], "to": add_months(recent, -1).isoformat()[:7]},
        "rules": {"min_uses": MIN_USES, "min_employers": MIN_EMPLOYERS, "employer_name_share": NAME_SHARE,
                  "place_prefix_letters": PLACE_PREFIX, "z_min": Z_MIN, "top": TOP, "max_words": 2},
        "method": ("Words and two-word phrases in the ad texts of each role family, the latest twelve "
                   "complete months against the twelve before, scored by weighted log-odds with an "
                   "informative Dirichlet prior (Monroe, Colaresi and Quinn 2008). Left out: terms "
                   "that start or end with a stopword or are numbers, terms used fewer than 20 times "
                   "or by fewer than 10 employers (one employer's boilerplate), terms that are part of "
                   "the employer's own name in a fifth of their uses, and place names of the ads' "
                   "municipalities and counties. At most 30 per side; no ad text is published."),
        "rows": result,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--database", type=Path, default=DATABASE)
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()
    connection = duckdb.connect(str(args.database), read_only=True)
    connection.execute("set preserve_insertion_order = false")
    data = build(connection)
    connection.close()
    io.write_json(args.out, data, newline=False)
    print(f"{args.out}: {len(data['rows'])} role families, {data['before']['from']} to {data['recent']['to']}")


if __name__ == "__main__":
    main()
