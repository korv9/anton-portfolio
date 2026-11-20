"""The Airflow evidence check passes two consecutive successful scheduled runs that survive a restart."""
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("check_runs", ROOT / "infra/airflow/check_runs.py")
check_runs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check_runs)


def run(minute, state="success"):
    return {"run_id": f"scheduled__2026-11-02T14:{minute}:00+00:00", "state": state,
            "logical_date": f"2026-11-02T14:{minute}:00+00:00"}


def write(folder, before, after, states):
    (folder / "runs-before.json").write_text(json.dumps(before))
    (folder / "runs-after.json").write_text(json.dumps(after))
    for r in after:
        name = f"tasks-{r['run_id']}.json".replace(":", "_").replace("+", "_")
        tasks = [{"task_id": t, "state": states.get(r["run_id"], "success")} for t in check_runs.TASKS]
        (folder / name).write_text(json.dumps(tasks))


def test_consecutive_runs_and_kept_metadata(tmp_path):
    runs = [run("00"), run("10"), run("20")]
    write(tmp_path, runs[:2], runs, {})
    assert check_runs.check(tmp_path) == []
    write(tmp_path, runs[:2], runs[1:], {runs[2]["run_id"]: "failed"})
    found = check_runs.check(tmp_path)
    assert any("consecutive" in f for f in found) and any("missing after the restart" in f for f in found)
