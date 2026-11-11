"""Claude Code Stop hook: record the labelled items of the answer that just finished.

Claude Code passes a JSON object on stdin with `transcript_path`. Only the last assistant
message is read, and only its text; the user's messages, tool calls and earlier turns are never
opened. The text goes through extract.py (which stores fields, never the text) and the committed
views are rebuilt. Nothing here blocks the session: every failure is printed and exit is 0.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
# Windows defaults pipes to the ANSI code page; children inherit UTF-8 so Swedish survives.
CHILD_ENV = {**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"}


def last_answer(transcript: Path) -> str:
    """Text of the final assistant message in a Claude Code transcript (JSON lines)."""
    text = ""
    for line in transcript.read_text(encoding="utf-8", errors="replace").splitlines():
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if row.get("type") != "assistant":
            continue
        content = (row.get("message") or {}).get("content") or []
        parts = [c["text"] for c in content if isinstance(c, dict) and c.get("type") == "text"]
        if parts:
            text = "\n".join(parts)
    return text


def main() -> int:
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):  # tests swap in StringIO
            stream.reconfigure(encoding="utf-8")
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, OSError):
        return 0
    if payload.get("stop_hook_active"):
        return 0
    path = Path(payload.get("transcript_path") or "")
    if not path.is_file():
        return 0
    text = last_answer(path)
    if not text:
        return 0
    run = [sys.executable, str(HERE / "extract.py"), "--mode", "auto"]
    done = subprocess.run(run, input=text, capture_output=True, text=True, encoding="utf-8", env=CHILD_ENV)
    out = (done.stdout + done.stderr).strip()
    if done.returncode != 0:
        print(f"idea-lineage: extraction failed ({done.returncode}): {out[-400:]}")
        return 0
    if "appended to" in out:
        build = subprocess.run([sys.executable, str(HERE / "views.py"), "root"],
                               capture_output=True, text=True, encoding="utf-8", env=CHILD_ENV)
        status = "views rebuilt" if build.returncode == 0 else f"view build failed: {build.stderr[-200:]}"
        print("idea-lineage: " + "; ".join(l for l in out.splitlines() if l.startswith(("  ", "note:", "appended")))
              + f"; {status}")
    elif "skipped" in out:
        print("idea-lineage: " + "; ".join(l for l in out.splitlines() if "skipped" in l))
    return 0


if __name__ == "__main__":
    sys.exit(main())
