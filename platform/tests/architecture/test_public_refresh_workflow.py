"""Writer lock, failure checkpoints and validation before public-data upload."""
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[3]


def test_public_refresh_preserves_the_manual_writer_lock_and_check_order():
    workflow = yaml.safe_load((ROOT / ".github/workflows/refresh-welfare.yml").read_text())
    manual = yaml.safe_load((ROOT / ".github/workflows/build-warehouse.yml").read_text())
    assert workflow["concurrency"] == manual["concurrency"]
    assert workflow["concurrency"]["cancel-in-progress"] is False
    job = workflow["jobs"]["refresh"]
    assert job["timeout-minutes"] >= 180
    steps = job["steps"]
    restore = next(i for i, s in enumerate(steps) if s.get("id") == "restore")
    for topic in ("welfare", "parliament", "taxes"):
        i = next(i for i, s in enumerate(steps) if s.get("id") == topic)
        assert restore < i
        assert steps[i]["continue-on-error"] is True
    save = next(s for s in steps if s.get("name") == "Save all available checkpoints")
    assert "always()" in save["if"] and "steps.restore.outcome == 'success'" in save["if"]
    assert "--prune" in save["run"]
    gate = next(i for i, s in enumerate(steps) if s.get("name") == "Require successful subject builds")
    export = next(i for i, s in enumerate(steps) if s.get("name") == "Export delivery files")
    check = next(i for i, s in enumerate(steps) if "validate_public_data.py" in s.get("run", ""))
    upload = next(i for i, s in enumerate(steps) if "publish/upload.py" in s.get("run", ""))
    status = next(i for i, s in enumerate(steps) if "publish_status.py" in s.get("run", ""))
    assert gate < export < check < upload < status
    assert "npm run data:check" in steps[check]["run"]
