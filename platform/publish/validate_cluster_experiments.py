"""Check cluster-experiments/ before release: each run file against its schema, and the index
against the run files (every listed run has a file with the same status, one champion at most).
No folder means nothing is registered yet, which passes.

    python platform/publish/validate_cluster_experiments.py --root frontend/public/data
"""
import argparse
import json
import sys
from pathlib import Path

import jsonschema

SCHEMAS = Path(__file__).resolve().parents[2] / "configs" / "delivery" / "schemas" / "clusters"


def problems(root: Path) -> list[str]:
    folder = root / "cluster-experiments"
    if not folder.is_dir():
        return []
    out = []
    run_schema = json.loads((SCHEMAS / "experiments-run.json").read_text(encoding="utf-8"))
    runs = {}
    for path in sorted((folder / "runs").glob("*.json")):
        body = json.loads(path.read_text(encoding="utf-8"))
        try:
            jsonschema.validate(body, run_schema)
        except jsonschema.ValidationError as error:
            out.append(f"{path.name}: {error.message}")
            continue
        if body["run_id"] != path.stem:
            out.append(f"{path.name}: run_id {body['run_id']} does not match the file name")
        runs[body["run_id"]] = body
    index = folder / "index.json"
    if not index.is_file():
        return out + (["runs/ has files but index.json is missing"] if runs else [])
    data = json.loads(index.read_text(encoding="utf-8"))
    try:
        jsonschema.validate(data, json.loads((SCHEMAS / "experiments-index.json").read_text(encoding="utf-8")))
    except jsonschema.ValidationError as error:
        return out + [f"index.json: {error.message}"]
    for domain, entry in data["domains"].items():
        champions = [r["run_id"] for r in entry["runs"] if r["status"] == "champion"]
        if champions != ([entry["champion"]] if entry["champion"] else []):
            out.append(f"{domain}: champion {entry['champion']} does not match the runs' statuses {champions}")
        for r in entry["runs"]:
            body = runs.get(r["run_id"])
            if body is None:
                out.append(f"{domain}: {r['run_id']} is listed but has no valid run file")
            elif body["status"] != r["status"] or body["run"]["domain"] != domain:
                out.append(f"{domain}: {r['run_id']} disagrees with its run file on status or domain")
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("frontend/public/data"))
    found = problems(parser.parse_args().root)
    for line in found:
        print(line, file=sys.stderr)
    return 1 if found else 0


if __name__ == "__main__":
    raise SystemExit(main())
