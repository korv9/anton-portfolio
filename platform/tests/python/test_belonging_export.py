"""SWEDEN D: library totals per municipality are missing, not partial sums, when an organisation
omits a term, and impossible zeros (visits without service points or the reverse) are missing."""
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("export_belonging", ROOT / "platform/publish/sweden/export_belonging.py")
export_belonging = importlib.util.module_from_spec(spec)
spec.loader.exec_module(export_belonging)


def obs(term, sigel, year, value, group="Folkbibliotek"):
    return {"library": {"@id": f"http://bibdb.libris.kb.se/library/{sigel}"}, "sampleYear": year,
            "targetGroup": group, term: value}


def run(rows):
    observations = {t: [obs(*r) for r in rows if r[0] == t] for t in export_belonging.TERMS}
    return export_belonging.aggregate(observations, {"A": "0001", "B": "0001", "C": "0002", "X": None},
                                      {"0001": 10.0, "0002": 20.0})


def test_sums_complete_organisations_and_nulls_partial_sums():
    cells, left_out, missing = run([
        ("BemanService01", "A", 2020, 2), ("BemanService01", "B", 2020, 1),
        ("Besok01", "A", 2020, 500), ("Besok01", "B", 2020, 300),
        ("Aktiv99", "A", 2020, 40),  # B did not report borrowers
        ("Besok01", "X", 2020, 9),
        ("Besok01", "A", 2020, 1, "Skolbibliotek"),
    ])
    assert cells[("0001", 2020)] == {"service_points": 3, "visits": 800, "active_borrowers": None}
    assert missing == {"active_borrowers: an organisation did not report": 1}
    assert left_out == {"no municipality in Biblioteksdatabasen": 1}


def test_impossible_zeros_are_missing():
    cells, _, missing = run([
        ("BemanService01", "C", 2021, 1), ("Besok01", "C", 2021, 0),
        ("BemanService01", "C", 2022, 0), ("Besok01", "C", 2022, 64110),
        ("BemanService01", "C", 2023, 0), ("Besok01", "C", 2023, 0),
    ])
    assert cells[("0002", 2021)] == {"service_points": 1, "visits": None}
    assert cells[("0002", 2022)] == {"service_points": None, "visits": 64110}
    assert cells[("0002", 2023)] == {"service_points": 0, "visits": 0}
    assert missing == {"visits: 0 with staffed service points": 1, "service_points: 0 with visits": 1}
