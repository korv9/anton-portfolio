"""SWEDEN B, The Ideal Human: the statistics behind the composition of a change in job-ad
language. Pure functions over counts, so each rule can be tested alone (test_ad_language.py).

A rate (texts using a category / texts, or matches / words) is a weighted mean of the rates of
its groups (occupation fields, SSYK-4 groups, employer types). `shift_share` splits its change
between two years into a part within the groups and a part from the groups' changing mix.
"""
from __future__ import annotations

Cells = dict[str, tuple[float, float]]  # group -> (denominator, numerator)


def rate(cells: Cells) -> float:
    total = sum(n for n, _ in cells.values())
    return sum(k for _, k in cells.values()) / total if total else 0.0


def shift_share(before: Cells, after: Cells) -> dict:
    """Symmetric shift-share: within = sum of mean weight × change in the group's rate, mix =
    sum of mean rate × change in the group's weight; within + mix is the whole change. A group
    present in one year only takes its rate from that year, so it adds to the mix alone."""
    n0 = sum(n for n, _ in before.values())
    n1 = sum(n for n, _ in after.values())
    within = mix = 0.0
    for group in before.keys() | after.keys():
        a0, k0 = before.get(group, (0, 0))
        a1, k1 = after.get(group, (0, 0))
        p0, p1 = (a0 / n0 if n0 else 0.0), (a1 / n1 if n1 else 0.0)
        r0 = k0 / a0 if a0 else (k1 / a1 if a1 else 0.0)
        r1 = k1 / a1 if a1 else r0
        within += (p0 + p1) / 2 * (r1 - r0)
        mix += (r0 + r1) / 2 * (p1 - p0)
    return {"before": rate(before), "after": rate(after), "within": within, "mix": mix,
            "groups": len(before.keys() | after.keys())}


def baselines(years: list[int], first: int, end: int) -> list[int]:
    """The first standardised year and the years two and four later, as languageChange.ts."""
    return [y for y in (first, first + 2, first + 4) if y < end and y in years]


GROUPINGS = {"field": "field", "occupation": "occupation_group", "employer": "employer_type",
             "occupation_employer": "occupation_group || '|' || employer_type"}
MEASURES = {"share": ("texts", "texts_matching"), "per_1000_words": ("words", "matches * 1000.0")}


def known(cells: Cells, grouping: str) -> tuple[Cells, float]:
    """The cells with a known occupation (all of them for employer type), and their share of the
    denominator."""
    if grouping == "employer":
        return cells, 1.0
    kept = {g: v for g, v in cells.items() if g != "Unknown" and not str(g).startswith("Unknown|")}
    total = sum(n for n, _ in cells.values())
    return kept, round(sum(n for n, _ in kept.values()) / total, 4) if total else 0.0


def composition(con, categories: list[str], bases: list[int], end: int) -> dict:
    """Per category, the change from each baseline year to `end` split into within-group and mix
    parts for each grouping and measure, and the change with agency ads left out."""
    sources = {"field": """select category, year, field, sum(texts) as texts, sum(words) as words,
                                  sum(texts_matching) as texts_matching, sum(matches) as matches
                           from gold.mart_sweden_job_language
                           join gold.mart_sweden_job_language_totals using (year, field, region)
                           group by all"""}
    mix = "gold.mart_sweden_job_language_mix"
    years = [*bases, end]
    cells: dict = {}
    for grouping, key in GROUPINGS.items():
        source = f"({sources['field']})" if grouping == "field" else mix
        for measure, (n, k) in MEASURES.items():
            for c, y, g, a, b in con.sql(f"""select category, year, {key}, sum({n}), sum({k})
                                             from {source} where year in ({",".join(map(str, years))})
                                             group by all""").fetchall():
                cells.setdefault((grouping, measure, c, y), {})[g] = (float(a), float(b))
    rows = []
    for c in categories:
        for base in bases:
            for grouping in GROUPINGS:
                for measure in MEASURES:
                    # Texts without an occupation are left out of the occupation groupings: their
                    # share falls as the archives record more occupations, which would read as mix.
                    pair = [known(cells.get((grouping, measure, c, y), {}), grouping) for y in (base, end)]
                    r = shift_share(pair[0][0], pair[1][0])
                    rows.append([c, base, grouping, measure, *(round(r[x], 6) for x in (
                        "before", "after", "within", "mix")), r["groups"], pair[0][1], pair[1][1]])
    agencies = con.sql(f"""select year, coalesce(sum(texts) filter (where category = 'competence'), 0),
                                  coalesce(sum(texts) filter (where category = 'competence' and employer_type = 'agency'), 0),
                                  coalesce(sum(texts) filter (where category = 'competence' and employer_type = 'unknown'), 0)
                           from {mix} group by year order by year""").fetchall()
    without = []
    for c in categories:
        for base in bases:
            for measure in MEASURES:
                pick = lambda y, keep: {g: v for g, v in cells.get(("employer", measure, c, y), {}).items()  # noqa: E731
                                        if keep(g)}
                without.append([c, base, measure, *(round(rate(pick(y, lambda g: True)), 6) for y in (base, end)),
                                *(round(rate(pick(y, lambda g: g != "agency")), 6) for y in (base, end))])
    return {
        "end": end, "bases": bases,
        "columns": ["category", "base", "grouping", "measure", "before", "after", "within", "mix", "groups",
                    "known_before", "known_after"],
        "rows": rows,
        "agencies": {"columns": ["year", "texts", "agency_texts", "unknown_employer_texts"],
                     "rows": [list(r) for r in agencies]},
        "without_agencies": {"columns": ["category", "base", "measure", "all_before", "all_after",
                                         "no_agency_before", "no_agency_after"], "rows": without},
        "method": {
            "shift_share": "after - before = within + mix; within weighs each group's change in rate by its mean share of the two years, mix weighs each group's change in share by its mean rate",
            "measures": "share: texts using the category / texts; per_1000_words: matches per thousand words, weighted by words",
            "field": "21 occupation fields after the crosswalk; texts without a field left out (known_before, known_after give the share kept)",
            "occupation": "SSYK 2012 four-digit groups through JobTech's taxonomy; texts without a group left out",
            "employer": "staffing or recruitment agency read from the employer name (AGENCY in ad_language.py), other, or unknown",
        },
    }
