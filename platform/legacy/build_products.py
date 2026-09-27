"""Build product report contracts from checked-in, pinned CSV exports."""
import csv
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
# Line-ending-normalised, so a hash taken on a Windows checkout matches on Linux and in CI.
from common import sha_of  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "frontend/public/data/products"


def typed(value):
    if value == "" or value.lower() == "nan":
        return None
    try:
        number = float(value)
        return int(number) if number.is_integer() else number
    except ValueError:
        return value


def build():
    catalog = json.loads((ROOT / "platform/products/catalog.json").read_text(encoding="utf-8"))
    PUBLIC.mkdir(parents=True, exist_ok=True)
    (PUBLIC / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    provenance = json.loads((ROOT / "platform/products/drugcomb/source.json").read_text(encoding="utf-8"))
    datasets = []
    tables = {}
    for path in sorted((PUBLIC / "drugcomb/tables").glob("*.csv")):
        with path.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            columns = reader.fieldnames
            records = [{key: typed(value) for key, value in row.items()} for row in reader]
        tables[path.stem] = records
        target = path.with_suffix(".json")
        target.write_text(json.dumps(records, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
        datasets.append({"id": "drugcomb_" + path.stem, "label": path.stem.replace("_", " "),
                         "product": "drugcomb", "rows": len(records), "columns": columns,
                         "path": "/data/products/drugcomb/tables/" + target.name,
                         "csv": "/data/products/drugcomb/tables/" + path.name,
                         "sha256": sha_of(path.read_bytes())})
    if not tables:
        raise ValueError("DrugComb table exports are missing")
    report = {"source": provenance, "metrics": tables["metrics"], "funnel": tables["data_funnel"],
              "overview": tables["sql_kpi_overview"][0], "lineages": tables["sql_synergy_by_lineage"],
              "datasets": datasets}
    (PUBLIC / "drugcomb/report.json").write_text(json.dumps(report, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    (PUBLIC / "datasets.json").write_text(json.dumps(datasets, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Built {len(catalog)} product entries and {len(datasets)} DrugComb datasets")


if __name__ == "__main__":
    build()
