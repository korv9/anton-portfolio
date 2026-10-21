"""SWEDEN A: the keyword recount and the agency check behind the page's classification limits."""
import csv
import importlib.util
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("export_measurement", ROOT / "platform/publish/sweden/export_measurement.py")
export_measurement = importlib.util.module_from_spec(spec)
spec.loader.exec_module(export_measurement)


def fixture():
    con = duckdb.connect()
    con.sql("create schema gold")
    con.sql("create schema seeds")
    con.sql("""create table gold.mart_sweden_measurement_items as select * from (values
               ('kolada', 'U01413', 'Avsaknad av tillit till andra, andel (%)', 'health', 'Folkhälsomyndigheten', 'municipality'),
               ('kolada', 'U01', 'Läkarbesök, antal/inv', 'health', 'Socialstyrelsen', 'municipality'),
               ('scb', 'T1', 'Hälsa och tillit efter kön', 'health', 'SCB', 'national'),
               ('scb', 'T2', 'Folkmängd efter region', 'other', 'SCB', 'municipality'))
               as t(catalogue, item_id, title, domain_id, institution, geo_resolution)""")
    con.sql("""create table seeds.domain_keywords as select * from (values
               ('health', 'hälsa|läkarbesök'), ('wellbeing', 'tillit')) as t(domain_id, pattern)""")
    con.sql("""create table seeds.other_agencies as select * from (values
               ('Socialstyrelsen', 'socialstyrelse', 'health'),
               ('Myndigheten för stöd till trossamfund', 'trossamfund', 'spirituality'))
               as t(agency, pattern, holds)""")
    return con


def test_sensitivity_counts_agreeing_moved_and_unmatched_items():
    s = export_measurement.sensitivity(fixture())
    # T1 matches health and wellbeing (agrees), U01413 only wellbeing (moves), T2 nothing.
    assert (s["items"], s["agree"], s["moved"], s["unmatched"]) == (4, 2, 1, 1)
    assert s["moved_share"] == 0.25
    assert s["domains"] == {"health": {"scb": 1, "kolada": 1}, "wellbeing": {"scb": 1, "kolada": 1}}
    assert s["flows"] == [{"from": "health", "to": "wellbeing", "scb": 1, "kolada": 1}]


def test_elsewhere_keeps_agencies_absent_from_both_catalogues():
    found = {a["agency"]: a for a in export_measurement.elsewhere(fixture())}
    assert found["Socialstyrelsen"]["items"] == 1 and found["Socialstyrelsen"]["domains"] == {"health": 1}
    assert found["Myndigheten för stöd till trossamfund"]["items"] == 0


def test_every_research_domain_has_a_keyword_pattern():
    seeds = ROOT / "platform/seeds/sweden"
    with (seeds / "research_domains.csv").open(encoding="utf-8") as f:
        domains = {r["domain_id"] for r in csv.DictReader(f)} - {"other"}
    with (seeds / "domain_keywords.csv").open(encoding="utf-8") as f:
        keywords = list(csv.DictReader(f))
    assert {r["domain_id"] for r in keywords} == domains
    # Every pattern must compile in DuckDB's RE2; the school subject is not faith.
    con = duckdb.connect()
    for r in keywords:
        con.execute("select regexp_matches('x', ?)", [r["pattern"]])
    spirit = next(r["pattern"] for r in keywords if r["domain_id"] == "spirituality")
    assert not con.execute("select regexp_matches('betyg i religionskunskap', ?)", [spirit]).fetchone()[0]
