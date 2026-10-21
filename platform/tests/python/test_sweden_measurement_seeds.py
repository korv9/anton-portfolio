"""SWEDEN A: the page says spirituality's zero is structural, which holds while no seed maps to it."""
import csv
from pathlib import Path

SEEDS = Path(__file__).resolve().parents[2] / "seeds/sweden"


def test_spirituality_has_no_subject_or_area_mapping():
    for name in ("scb_subject_domains.csv", "kolada_area_domains.csv"):
        with (SEEDS / name).open(encoding="utf-8") as f:
            assert all(row["domain_id"] != "spirituality" for row in csv.DictReader(f)), name
