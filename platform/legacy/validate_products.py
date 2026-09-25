"""Check published product data against pinned upstream exports."""
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "frontend/public"


def main():
    catalog = json.loads((PUBLIC / "data/products/catalog.json").read_text(encoding="utf-8"))
    assert {row["id"] for row in catalog} == {"politics", "jobs", "drugcomb", "allegoria", "thesis", "homie"}
    assert len(catalog) == 6
    datasets = json.loads((PUBLIC / "data/products/datasets.json").read_text(encoding="utf-8"))
    assert len({row["id"] for row in datasets}) == len(datasets) == 22
    for dataset in datasets:
        path = PUBLIC / dataset["csv"].lstrip("/")
        assert hashlib.sha256(path.read_bytes()).hexdigest() == dataset["sha256"], path
        with path.open(encoding="utf-8-sig", newline="") as handle:
            original = list(csv.DictReader(handle))
        records = json.loads((PUBLIC / dataset["path"].lstrip("/")).read_text(encoding="utf-8"))
        assert len(records) == len(original) == dataset["rows"]
        assert all(set(record) == set(dataset["columns"]) for record in records)
        for source, record in zip(original, records):
            for key, value in source.items():
                if value == "" or value.lower() == "nan":
                    assert record[key] is None
                elif isinstance(record[key], (int, float)):
                    assert float(value) == record[key], (path, key, value)
                else:
                    assert value == record[key], (path, key, value)
    report = json.loads((PUBLIC / "data/products/drugcomb/report.json").read_text(encoding="utf-8"))
    assert len(report["source"]["revision"]) == 40
    assert report["source"]["raw_data_included"] is False
    assert report["funnel"][-1]["rows"] == report["overview"]["combinations"] == 396498
    assert all(a["rows"] >= b["rows"] for a, b in zip(report["funnel"], report["funnel"][1:]))
    for model in {row["model"] for row in report["metrics"]}:
        rows = [row for row in report["metrics"] if row["model"] == model]
        assert {row["scheme"] for row in rows} == {"random", "cold_pair", "cold_drug", "cold_cell"}
        assert all(row["pearson"] is None or -1 <= row["pearson"] <= 1 for row in rows)
    for figure in ('an_01_zip_distribution', 'an_02_replicate_agreement', 'ml_06_enrichment', 'ml_07_calibration'):
        assert (PUBLIC / f'data/products/drugcomb/figures/{figure}.png').is_file()
        assert (PUBLIC / f'data/products/drugcomb/figures/{figure}.svg').is_file()
    print('Verified six project contracts, 22 DrugComb tables, evaluation splits and figure links.')


if __name__ == '__main__':
    main()
