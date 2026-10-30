"""Running experiments: resource measurement, resumable checkpoints and the heavy-compute lock.

- `measure` records wall time, peak resident memory and free disk around a block.
- `Checkpoints` keeps one JSON per finished unit (a candidate × seed fit) in a run folder; a rerun
  skips finished units, so an interrupted job resumes. Files are written atomically.
- `heavy` is one machine-wide lock: only one embedding or fit job runs at a time, so parallel
  workers cannot exhaust memory or write the same artifact.
- `Deadline` stops a job with margin before a time limit (GitHub-hosted jobs stop at six hours).
"""
from __future__ import annotations

from contextlib import contextmanager
import os
import shutil
import threading
import time
from pathlib import Path

import psutil

from ml.cluster_lab.io import atomic_json, read_json
from .registry import ROOT, lock


@contextmanager
def measure(path: Path | str = '.'):
    """Yields a dict filled on exit: seconds, peak_rss_mb (sampled every 0.2 s), disk_free_gb."""
    process, result, stop = psutil.Process(), {}, threading.Event()
    peak = [process.memory_info().rss]

    def sample():
        while not stop.wait(0.2):
            peak[0] = max(peak[0], process.memory_info().rss)

    watcher = threading.Thread(target=sample, daemon=True)
    started = time.perf_counter()
    watcher.start()
    try:
        yield result
    finally:
        stop.set()
        watcher.join()
        result.update(seconds=round(time.perf_counter() - started, 2),
                      peak_rss_mb=round(max(peak[0], process.memory_info().rss) / 2**20, 1),
                      disk_free_gb=round(shutil.disk_usage(Path(path).resolve().anchor or '.').free / 2**30, 1),
                      cpu_count=os.cpu_count())


class Checkpoints:
    def __init__(self, folder: Path):
        self.folder = Path(folder)
        self.folder.mkdir(parents=True, exist_ok=True)

    def path(self, key: str) -> Path:
        return self.folder / f'{key}.json'

    def done(self, key: str) -> bool:
        return self.path(key).exists()

    def get(self, key: str):
        return read_json(self.path(key))

    def put(self, key: str, value) -> None:
        atomic_json(self.path(key), value)

    def all(self) -> dict:
        return {p.stem: read_json(p) for p in sorted(self.folder.glob('*.json'))}


@contextmanager
def heavy(wait_seconds: float = 0):
    """The machine-wide heavy-compute lock, waiting up to `wait_seconds` for it."""
    path = ROOT / 'heavy.lock'
    deadline = time.monotonic() + wait_seconds
    while True:
        held = lock(path)
        try:
            held.__enter__()
            break
        except RuntimeError:
            if time.monotonic() >= deadline:
                raise
            time.sleep(10)
    try:
        yield
    finally:
        held.__exit__(None, None, None)


class Deadline:
    """`expired()` turns true `margin_minutes` before `limit_minutes` after creation."""

    def __init__(self, limit_minutes: float | None, margin_minutes: float = 30):
        self.end = None if not limit_minutes else time.monotonic() + (limit_minutes - margin_minutes) * 60

    def expired(self) -> bool:
        return self.end is not None and time.monotonic() >= self.end
