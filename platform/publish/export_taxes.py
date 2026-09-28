"""Export the tax subject to the site.

    python platform/publish/export_taxes.py

JSON under frontend/public/data/taxes/:
    sweden.json         Sweden's tax revenue per tax type and year since 1965: share of GDP and
                        billions of kronor
    countries.json      every OECD country's total and main tax types, share of GDP, since 1965
    wedge.json          labour taxation by country (OECD Taxing Wages): the latest year for four
                        household types and three wage levels, and the tax wedge over time
    municipalities.json the latest year's local income tax, burial and church fee per parish
    decisions.json      Riksdag decisions that changed taxes since 2016: what, from when, the
                        bill and report, how each party voted, and the studies behind them
    household.json      an estimate of the VAT a household pays, per household type and group
                        of spending (SCB HUT)

Test fixture: frontend/tests/fixtures/skattetabeller-<year>.json, Skatteverket's monthly
withholding tables, which the calculator is tested against.

Run after `dbt build --select tag:taxes`.
"""
from __future__ import annotations

import json
import os
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))

import duckdb  # noqa: E402

from common import PUBLIC, ROOT, write_json  # noqa: E402

DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
RAW = Path(os.environ.get("PORTFOLIO_RAW", ROOT / "warehouse/raw"))
RUN_RESULTS = ROOT / "platform/target/taxes/run_results.json"
OUT = PUBLIC / "taxes"
FIXTURES = ROOT / "frontend/tests/fixtures"
MAIN_TYPES = ("_T", "T_1000", "T_1100", "T_1200", "T_2000", "T_3000", "T_4000", "T_5000",
              "T_5111", "T_6000")


def rows(connection, sql: str, parameters=None) -> list[list]:
    return [[round(v, 3) if isinstance(v, float) else v for v in row]
            for row in connection.execute(sql, parameters or []).fetchall()]


def records(connection, sql: str) -> list[dict]:
    cursor = connection.execute(sql)
    names = [c[0] for c in cursor.description]
    return [dict(zip(names, (round(v, 3) if isinstance(v, float) else v for v in row)))
            for row in cursor.fetchall()]


def check_dbt() -> None:
    if not RUN_RESULTS.is_file():
        raise SystemExit(f"No dbt run results at {RUN_RESULTS}; run the tax build first")
    results = json.loads(RUN_RESULTS.read_text(encoding="utf-8"))["results"]
    failed = [r["unique_id"] for r in results if r["status"] in ("fail", "error")]
    if failed:
        raise SystemExit(f"Refusing to export: {failed}")


# Tables kept for past years: the tables differ only in the tax rate, so five spread over
# the range test every rule; the latest year keeps all of them.
PAST_YEAR_TABLES = {29, 32, 35, 38, 42}


def withholding_fixture() -> None:
    """Skatteverket's monthly withholding tables for every fetched year, compact."""
    pages = sorted((RAW / "skatteverket/withholding").glob("*-*.json"))
    by_year = defaultdict(list)
    for page in pages:
        for r in json.loads(page.read_text(encoding="utf-8"))["results"]:
            if r["antal dgr"] != "30B":
                continue
            by_year[int(r["år"])].append(
                [int(r["tabellnr"]), int(r["inkomst fr.o.m."]),
                 int(r["inkomst t.o.m."]) if r["inkomst t.o.m."] else None]
                + [int(r[f"kolumn {i}"]) if r[f"kolumn {i}"] != "" else None for i in range(1, 7)])
    latest = max(by_year, default=0)
    for year, table in by_year.items():
        if year != latest:
            table = [row for row in table if row[0] in PAST_YEAR_TABLES]
        table.sort()
        payload = {"year": year,
                   "source": "Skatteverket, skattetabeller (rowstore "
                             "88320397-5c32-4c16-ae79-d36d95b17b95), månadslön 30B",
                   "columns": ["table", "from", "to", "col1", "col2", "col3", "col4", "col5",
                               "col6"],
                   "rows": table}
        (FIXTURES / f"skattetabeller-{year}.json").write_text(
            json.dumps(payload, separators=(",", ":")), encoding="utf-8")


def main() -> None:
    check_dbt()
    connection = duckdb.connect(str(DATABASE), read_only=True)
    types = records(connection, "select * from gold.dim_tax_type order by tax_code")
    countries = records(connection, "select * from gold.dim_tax_country order by country_code")

    write_json(OUT / "sweden.json", {
        "types": types,
        "columns": ["year", "tax_code", "pct_gdp", "sek_billion"],
        "rows": rows(connection, """
            select year, tax_code, pct_gdp, amount_national / 1e9
            from gold.fct_tax_revenue where country_code = 'SWE'
            order by year, tax_code"""),
        "source": "OECD Revenue Statistics, general government",
    })
    write_json(OUT / "countries.json", {
        "types": [t for t in types if t["tax_code"] in MAIN_TYPES],
        "countries": countries,
        "columns": ["country_code", "year", "tax_code", "pct_gdp"],
        "rows": rows(connection, f"""
            select country_code, year, tax_code, pct_gdp
            from gold.fct_tax_revenue
            where tax_code in {MAIN_TYPES} and pct_gdp is not null
            order by country_code, year, tax_code"""),
        "source": "OECD Revenue Statistics, general government",
    })

    latest = connection.execute("select max(year) from gold.fct_tax_wedge").fetchone()[0]
    write_json(OUT / "wedge.json", {
        "year": latest,
        "countries": countries,
        "households": {
            "S_C0": ["Single, no children", "Ensamstående utan barn"],
            "S_C2": ["Single, two children", "Ensamstående med två barn"],
            "C_C0": ["Couple, no children", "Sambo/gift utan barn"],
            "C_C2": ["Couple, two children", "Sambo/gift med två barn"],
        },
        "latest": records(connection, f"""
            select * exclude (year) from gold.fct_tax_wedge where year = {latest}
            order by country_code, household_type, wage_level, spouse_wage_level"""),
        "series_columns": ["country_code", "year", "household_type", "tax_wedge_pct"],
        "series": rows(connection, """
            select country_code, year, household_type, tax_wedge_pct
            from gold.fct_tax_wedge
            where wage_level = 'AW100' and spouse_wage_level in ('_Z', 'NOEARN_UNEMP')
              and household_type in ('S_C0', 'C_C2') and tax_wedge_pct is not null
            order by all"""),
        "source": "OECD Taxing Wages",
    })

    rate_year = connection.execute("select max(year) from gold.fct_municipal_tax_rate").fetchone()[0]
    municipalities = defaultdict(lambda: {"parishes": []})
    for code, name, parish, local, burial, church in connection.execute(f"""
            select municipality_code, municipality_name, parish_name, local_income_tax_rate,
                   burial_rate, church_rate
            from gold.fct_municipal_tax_rate where year = {rate_year}
            order by municipality_name, parish_name""").fetchall():
        entry = municipalities[code]
        entry.update({"code": code, "name": name.title(), "local_rate": round(local, 3)})
        entry["parishes"].append([parish.title(), round(burial, 3), round(church, 3)])
    write_json(OUT / "municipalities.json", {
        "year": rate_year,
        "municipalities": sorted(municipalities.values(), key=lambda m: m["name"]),
        "source": "Skatteverket, skattesatser per kommun och församling",
    })

    decisions = records(connection, """
        select decision_key as key, in_force, in_force_year as year, component, direction,
               title_sv, title_en, bill, bill_title, bill_section, bill_date, department,
               report, origin, source_url, petrol_sek_per_litre, diesel_sek_per_litre, months
        from gold.dim_tax_decision order by in_force, decision_key""")
    votes = defaultdict(dict)
    for row in records(connection, """
            select decision_key, session, point, vote_date, outcome, government_won, party,
                   position, role
            from gold.fct_tax_decision_vote order by decision_key, party"""):
        vote = votes[row["decision_key"]]
        vote.update({k: row[k] for k in ("session", "point", "vote_date", "outcome",
                                         "government_won")})
        vote.setdefault("parties", {})[row["party"]] = [row["position"], row["role"]]
    studies = defaultdict(list)
    for row in records(connection, """
            select d.decision_key, s.kind, s.designation, s.title, s.source_url as url
            from gold.fct_tax_decision_study as d join gold.dim_study as s using (study_key)
            order by d.decision_key, s.kind desc, s.designation"""):
        studies[row.pop("decision_key")].append(row)
    for decision in decisions:
        decision["components"] = decision.pop("component").split("|")
        decision["vote"] = votes.get(decision["key"])
        decision["studies"] = studies.get(decision["key"], [])
        decision["in_force"] = str(decision["in_force"])
        decision["bill_date"] = decision["bill_date"] and str(decision["bill_date"])
        if decision["vote"]:
            decision["vote"]["vote_date"] = str(decision["vote"]["vote_date"])
    write_json(OUT / "decisions.json", {
        "decisions": decisions,
        "components": {
            "in_work_credit": ["In-work tax credit", "Jobbskatteavdrag"],
            "raised_allowance": ["Higher basic allowance at 65/66", "Förhöjt grundavdrag"],
            "state_tax": ["State income tax", "Statlig inkomstskatt"],
            "public_service": ["Public service fee", "Public service-avgift"],
            "sickness_reduction": ["Sickness and activity compensation",
                                   "Sjuk- och aktivitetsersättning"],
            "earned_income_reduction": ["Earned income reduction",
                                        "Skattereduktion för förvärvsinkomst"],
            "temporary_work_reduction": ["Temporary work income reduction",
                                         "Tillfällig skattereduktion för arbetsinkomst"],
            "senior_age": ["Age limits for older people", "Åldersgränser för äldre"],
            "isk": ["Investment savings account (ISK)", "Investeringssparkonto (ISK)"],
            "capital": ["Capital income", "Kapitalinkomst"],
            "employer": ["Employer contributions", "Arbetsgivaravgifter"],
            "fuel": ["Tax on petrol and diesel", "Skatt på bensin och diesel"],
            "vat": ["VAT", "Moms"],
            "corporate": ["Corporate tax", "Bolagsskatt"],
            "property": ["Property tax and fee", "Fastighetsskatt och fastighetsavgift"],
            "wealth": ["Wealth tax", "Förmögenhetsskatt"],
        },
        "method": ("Each decision is named from the budget bill's chapter on taxes, a separate "
                   "bill, or the enacted law text in the committee report. Party positions "
                   "are from the first substantive roll call of that report; for a budget "
                   "framework report (FiU1) that vote settles the whole budget, taxes "
                   "included."),
    })

    household = defaultdict(lambda: {"groups": []})
    hut_year = None
    for row in records(connection, """
            select household_type, household_sv, household_en, year, spending_group, name_sv,
                   name_en, vat_rate, sek_per_household, vat_sek, note_sv
            from gold.fct_household_vat where sek_per_household is not null
            order by household_type, spending_group"""):
        entry = household[row["household_type"]]
        entry.update({"key": row["household_type"], "name": [row["household_en"],
                                                             row["household_sv"]]})
        hut_year = row["year"]
        entry["groups"].append({"group": row["spending_group"],
                                "name": [row["name_en"], row["name_sv"]],
                                "vat_rate": row["vat_rate"],
                                "spending": round(row["sek_per_household"]),
                                "vat": round(row["vat_sek"]), "note": row["note_sv"]})
    write_json(OUT / "household.json", {
        "year": hut_year,
        "households": list(household.values()),
        "method": ("Spending per household (SCB, Hushållens utgifter) is in prices including "
                   "VAT; the VAT in it is spending x rate / (1 + rate). Only groups with one "
                   "clear rate are counted: rent, health care, insurance, interest and fees "
                   "carry no VAT or a mix, so the estimate is a floor."),
        "source": "SCB, Hushållens utgifter (HUT) 2021, tabell HUThush",
    })

    withholding_fixture()
    print(f"taxes: {len(decisions)} decisions, {len(types)} tax types, {len(countries)} countries, wedge {latest}, "
          f"rates {rate_year} ({len(municipalities)} municipalities)")


if __name__ == "__main__":
    main()
