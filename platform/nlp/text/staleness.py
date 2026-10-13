"""Whether an ML stage's stored output still matches its inputs.

A stage hashes what it is about to embed (`digest`), records the hash in its run.json, and with
--if-stale does nothing when the stored hash is the same (`stands`). platform/pipeline.py passes
--if-stale for `--ml stale`, so a stage reruns when its corpus changed, not only when run.json
is missing. A run.json written before the stage recorded a hash counts as stale.
"""
from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable
from pathlib import Path


def digest(parts: Iterable[str]) -> str:
    return hashlib.sha256("\n".join(parts).encode()).hexdigest()


def stands(run_json: Path, key: str, value: str) -> bool:
    return run_json.is_file() and json.loads(run_json.read_text(encoding="utf-8")).get(key) == value


if __name__ == "__main__":
    import tempfile

    with tempfile.TemporaryDirectory() as directory:
        run = Path(directory) / "run.json"
        assert not stands(run, "input_sha256", digest(["a"]))
        run.write_text(json.dumps({"input_sha256": digest(["a", "b"])}))
        assert stands(run, "input_sha256", digest(["a", "b"]))
        assert not stands(run, "input_sha256", digest(["a", "c"]))
        run.write_text("{}")
        assert not stands(run, "input_sha256", digest(["a"]))
    print("ok")
