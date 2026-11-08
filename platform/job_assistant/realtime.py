"""The job assistant's near real-time flow by polling, one stage per call, as Airflow runs it.

    python platform/job_assistant/realtime.py collect    # JobStream since the cursor (ads.py)
    python platform/job_assistant/realtime.py analyse    # clusters and matches of new or changed ads
    python platform/job_assistant/realtime.py build      # dbt tag:job_assistant, export, delivery check
    python platform/job_assistant/realtime.py publish    # the checked files through release.py
    python platform/job_assistant/realtime.py status
    python platform/job_assistant/realtime.py push       # the store to R2 (pipeline.py push), under the lock

Each stage records its own state in warehouse/raw/job_assistant/pipeline.json, so a failed stage is
run again without repeating the ones before it: collect owns the cursor (state.json, moved only after
ads.json is written); analyse and build record the cursor they consumed, publish the build it shipped.
A stage whose input has not changed since it last succeeded does nothing. Every stage holds one lock
file, so a manual run and a scheduled run never write the store at once. Each stage appends one line
to realtime_runs.jsonl: duration, outcome, counts, embedding use and, for publish, the latency from
the source's own change time to the published result.

Publication goes through the existing delivery path: release.py publish --group job-assistant, which
reruns export.py --check before upload. It uploads only with JOB_ADS_PUBLISH=r2; otherwise the
checked files stay in frontend/public/data/job-assistant/ as the validated publication candidate.
Nothing is committed and the site is not rebuilt.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import ads  # noqa: E402

LOCK_STALE = timedelta(minutes=45)  # longer than any stage's Airflow timeout


def folder() -> Path:
    return ads.store_dir()


def now() -> datetime:
    return datetime.now(timezone.utc)


def read(name: str, default=None):
    path = folder() / name
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def alive(pid: int) -> bool:
    """Whether a process runs; unknown (True) where neither psutil nor a POSIX signal 0 can tell."""
    try:
        import psutil
        return psutil.pid_exists(pid)
    except ImportError:
        if os.name != "posix":
            return True
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        pass
    return True


@contextmanager
def lock():
    """One writer at a time. A lock whose process has gone (a task killed on timeout), or one older
    than LOCK_STALE, is taken over. It sits beside the store, not in it: pipeline.py push uploads
    every file under raw/job_assistant, and a lock pushed with the store would come back on a pull.
    The .tmp suffix keeps a whole-tree push (warehouse_store.tree_files) from uploading it too."""
    path = folder().with_name("job_assistant.lock.tmp")
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        age = now() - datetime.fromtimestamp(path.stat().st_mtime, timezone.utc)
        owner = path.read_text().split()[0] if path.read_text().strip() else ""
        if age < LOCK_STALE and (not owner.isdigit() or alive(int(owner))):
            raise RuntimeError(f"another run holds {path} ({age.seconds}s old)")
        path.unlink()
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    os.write(fd, f"{os.getpid()} {now().isoformat()}".encode())
    os.close(fd)
    try:
        yield
    finally:
        path.unlink(missing_ok=True)


def stage(name: str, fn) -> dict:
    """Run one stage under the lock and record it, ok or failed, in pipeline.json and the run log."""
    with lock():
        started, t = now(), time.monotonic()
        status = read("pipeline.json", {})
        entry = {"stage": name, "started": started.isoformat(timespec="seconds")}
        try:
            entry.update(fn(status) or {})
            entry["outcome"] = entry.get("outcome", "ok")
        except BaseException as error:  # SystemExit too: rank.py exits on an invalid profile
            entry["outcome"] = f"failed: {type(error).__name__}: {str(error)[:300]}"
            raise
        finally:
            entry["seconds"] = round(time.monotonic() - t, 2)
            entry["finished"] = now().isoformat(timespec="seconds")
            # `ok` is the last run that did the work; a skip leaves it, a failure keeps the one before.
            done = entry if entry["outcome"] == "ok" else (status.get(name) or {}).get("ok")
            status[name] = {"last": entry, "ok": done}
            ads.write_atomic(folder() / "pipeline.json", status)
            with (folder() / "realtime_runs.jsonl").open("a", encoding="utf-8", newline="\n") as out:
                out.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return entry


def cursor() -> str | None:
    return (read("state.json") or {}).get("fetched_until")


def collect(status: dict, http=None) -> dict:
    # JobStream indexes an event a little after it happens; asking up to a minute ago keeps the window whole.
    until = datetime.now(ads.LOCAL).replace(tzinfo=None, second=0, microsecond=0) - timedelta(minutes=1)
    overlap = timedelta(minutes=int(os.environ.get("JOB_STREAM_OVERLAP_MINUTES", "10")))
    record = ads.run(until, http=http, overlap=overlap)
    windows = record["windows"]
    total = {k: sum(w.get(k, 0) for w in windows) for k in ("items", "new", "changed", "removed", "unchanged", "stale")}
    times = [t for w in windows for t in (w.get("earliest"), w.get("latest")) if t]
    # Changes not yet published accumulate until publish succeeds, so a failed publish keeps them.
    pending = status.get("pending_changes") or {}
    if times:
        pending = {"earliest": min(times + [pending.get("earliest") or times[0]]),
                   "latest": max(times + [pending.get("latest") or times[0]]),
                   "count": (pending.get("count") or 0) + total["new"] + total["changed"] + total["removed"]}
        status["pending_changes"] = pending
    return {"fetched_until": cursor(), "windows": len(windows), "empty_answers": sum(1 for w in windows if not w.get("items")),
            **total, "ads": record["ads"], "current": record["current"]}


def analyse(status: dict, http=None) -> dict:
    done = (status.get("analyse") or {}).get("ok") or {}
    if done.get("input") == cursor() and done.get("model") == current_model():
        return {"outcome": "skipped", "input": cursor(), "model": done.get("model")}
    import rank
    # ml/jobs/assign.py as a command: the job assistant never imports ml (ml/experiments/tests/test_separation.py).
    run([sys.executable, "-m", "ml.jobs.assign", "--store", str(ads.store_dir())], "realtime-assign.log")
    assigned = json.loads((ROOT / "tmp/realtime-assign.log").read_text(encoding="utf-8").strip().splitlines()[-1])
    profile, why = rank.approved_profile(None)
    result = rank.run(profile, rank.ai.session() if profile else None, why=why)
    note = result["note"]
    return {"input": cursor(), "model": assigned["model"], "assigned": assigned["assigned"],
            "embedding": assigned["embedding"], "signals": assigned["signals"],
            "matches": len(result["matches"]), "profile": why["reason"],
            "workers_ai_neurons": round((note.get("neurons_after") or 0) - (note.get("neurons_before") or 0), 2)}


def current_model() -> str:
    return json.loads((ROOT / "ml/jobs/registry.json").read_text(encoding="utf-8"))["current"]


def run(argv: list[str], log: str, cwd: Path = ROOT) -> None:
    """Run a step, its output in tmp/<log>; a non-zero exit raises with the last lines."""
    out = ROOT / "tmp" / log
    out.parent.mkdir(exist_ok=True)
    with out.open("w", encoding="utf-8") as f:
        # Steps that start `python` themselves (release.py runs export.py) get this interpreter too: in the
        # Airflow image the first python on PATH is Airflow's, without the portfolio's packages.
        env = {**os.environ, "PATH": os.pathsep.join([str(Path(sys.executable).parent), os.environ.get("PATH", "")])}
        code = subprocess.run(argv, cwd=cwd, stdout=f, stderr=subprocess.STDOUT, env=env).returncode
    if code:
        tail = out.read_text(encoding="utf-8", errors="replace").splitlines()[-5:]
        raise RuntimeError(f"{' '.join(argv[1:4])} exited {code}: " + " | ".join(tail))


def build(status: dict) -> dict:
    analysed = ((status.get("analyse") or {}).get("ok") or {}).get("input")
    done = (status.get("build") or {}).get("ok") or {}
    if analysed != cursor():
        raise RuntimeError(f"analysis is at {analysed}, the store at {cursor()}: run analyse first")
    if done.get("input") == analysed:
        return {"outcome": "skipped", "input": analysed}
    py = sys.executable
    # The same dbt call as pipeline.py's job_assistant subject, without the site-wide catalogue steps.
    run([py, "-m", "dbt.cli.main", "build", "--profiles-dir", ".", "--indirect-selection", "buildable",
         "--select", "tag:job_assistant", "--target-path", "target/job_assistant_realtime"], "realtime-dbt.log",
        ROOT / "platform")
    run([py, "platform/job_assistant/export.py"], "realtime-export.log")
    run([py, "platform/job_assistant/export.py", "--check", "frontend/public/data"], "realtime-check.log")
    data = json.loads((ROOT / "frontend/public/data/job-assistant/ads.json").read_text(encoding="utf-8"))
    return {"input": analysed, "generated_at": data["generated_at"], "counts": data["counts"]}


def publish(status: dict) -> dict:
    built = ((status.get("build") or {}).get("ok") or {})
    done = (status.get("publish") or {}).get("ok") or {}
    if not built:
        raise RuntimeError("nothing built yet: run build first")
    mode = os.environ.get("JOB_ADS_PUBLISH", "local")
    # A build only checked (local) is still uploaded once publication turns on.
    if done.get("generated_at") == built["generated_at"] and done.get("mode") in (mode, "r2"):
        return {"outcome": "skipped", "generated_at": built["generated_at"]}
    if mode == "r2":
        run([sys.executable, "-m", "portfolio.publish.release", "publish", "--group", "job-assistant",
             "--root", "frontend/public/data", "--spec", "configs/delivery/job-assistant.json"], "realtime-release.log")
    else:
        run([sys.executable, "platform/job_assistant/export.py", "--check", "frontend/public/data"], "realtime-check.log")
    at = now()
    pending = status.pop("pending_changes", None) or {}
    latency = {}
    if pending:
        def minutes(stamp):
            source = datetime.strptime(stamp, ads.STAMP).replace(tzinfo=ads.LOCAL)
            return round((at - source).total_seconds() / 60, 1)
        latency = {"changes": pending["count"], "max_minutes": minutes(pending["earliest"]),
                   "min_minutes": minutes(pending["latest"])}
    return {"mode": mode, "generated_at": built["generated_at"], "input": built["input"],
            "published_at": at.isoformat(timespec="seconds"), "latency": latency}


STAGES = {"collect": collect, "analyse": analyse, "build": build, "publish": publish}


def main() -> None:
    name = sys.argv[1] if len(sys.argv) > 1 else "status"
    if name == "status":
        print(json.dumps(read("pipeline.json", {}), ensure_ascii=False, indent=1))
        return
    if name == "push":
        # Under the lock, so the store is never uploaded while a stage is writing it.
        with lock():
            # The cluster model's CPU embedding cache goes with the store, so the next window on a
            # runner reuses it instead of embedding every open ad again (ml/jobs/embeddings.embed).
            for cache in (ROOT / "warehouse/ml/jobs").glob("embeddings-*.parquet"):
                shutil.copyfile(cache, folder() / cache.name)
            run([sys.executable, "platform/pipeline.py", "push", "job_assistant"], "realtime-push.log")
        return
    print(json.dumps(stage(name, STAGES[name]), ensure_ascii=False))


if __name__ == "__main__":
    main()
