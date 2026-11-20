"""Check what Airflow scheduled, from the JSON its CLI wrote, and summarise it.

    python infra/airflow/check_runs.py <evidence folder>

The folder holds runs-before.json and runs-after.json (`airflow dags list-runs job_ads_near_realtime
-o json`, before and after a restart of the stack) and tasks-<run_id>.json per run (`airflow tasks
states-for-dag-run`). Passes when at least two scheduled runs in a row succeeded with all four tasks
successful, and every run listed before the restart is still listed after it (the metadata persisted).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

TASKS = {"collect", "analyse", "build", "publish"}


def check(folder: Path) -> list[str]:
    before = json.loads((folder / "runs-before.json").read_text())
    after = json.loads((folder / "runs-after.json").read_text())
    problems = []
    # The CLI's JSON has no run type; Airflow names scheduled runs scheduled__<logical date>.
    scheduled = sorted((r for r in after if r["run_id"].startswith("scheduled__")), key=lambda r: r["logical_date"])
    good = []
    for run in scheduled:
        path = folder / f"tasks-{run['run_id']}.json".replace(":", "_").replace("+", "_")
        tasks = {t["task_id"]: t["state"] for t in json.loads(path.read_text())} if path.exists() else {}
        ok = run["state"] == "success" and set(tasks) == TASKS and set(tasks.values()) == {"success"}
        good.append(ok)
        print(run["run_id"], run["state"], run.get("start_date"), run.get("end_date"), tasks)
    if not any(a and b for a, b in zip(good, good[1:])):
        problems.append("no two consecutive scheduled runs succeeded with all four tasks")
    lost = {r["run_id"] for r in before} - {r["run_id"] for r in after}
    if lost:
        problems.append(f"runs missing after the restart: {sorted(lost)}")
    if len(after) <= len(before):
        problems.append("no new run after the restart")
    return problems


if __name__ == "__main__":
    found = check(Path(sys.argv[1]))
    print("\n".join(found) or "airflow: two consecutive scheduled runs succeeded; metadata kept across a restart")
    sys.exit(1 if found else 0)
