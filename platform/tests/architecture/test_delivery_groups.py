"""Every file a release group names is left out of baseline, which takes all the rest."""
import json
from fnmatch import fnmatch
from pathlib import Path

DELIVERY = Path(__file__).resolve().parents[3] / "configs" / "delivery"


def test_baseline_excludes_every_file_another_group_owns():
    spec = lambda name: json.loads((DELIVERY / name).read_text(encoding="utf-8"))
    excluded = spec("baseline.json")["exclude"]
    overlaps = [(path.name, p)
                for path in DELIVERY.glob("*.json") if path.name != "baseline.json"
                for p in spec(path.name).get("files", []) + spec(path.name).get("optional_files", [])
                if not any(fnmatch(p, pattern) for pattern in excluded)]
    assert overlaps == []
