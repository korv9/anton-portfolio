"""Prove a refactor changes no published file: record what a run writes, then compare two runs.

    python scripts/export_proof.py record <out.json> -- <command ...>
    python scripts/export_proof.py compare <before.json> <after.json>

record starts from the committed frontend/public/data, runs the command, and records every file
written during it: sha256 with CRLF normalised to LF and the run's own "generated_at" blanked,
the exact sha256, and the text of catalog.json and delivery.json. It restores public/data after.

compare passes when every file matches; catalog.json and delivery.json are compared without the
byte counts, hashes and run_id they embed, which follow from the other files. Used by
.github/workflows/export-proof.yml (docs/package.md, step 3).
"""
import hashlib
import json
import re
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DATA = "frontend/public/data"
STAMP = re.compile(rb'"generated_at": ?"[^"]*"')
CATALOGUE = ("catalog.json", "delivery.json")


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True, check=True).stdout


def entry(path: Path) -> dict:
    raw = path.read_bytes()
    lf = raw.replace(b"\r\n", b"\n")
    out = {"sha256": hashlib.sha256(STAMP.sub(b'"generated_at":""', lf)).hexdigest(),
           "exact": hashlib.sha256(raw).hexdigest()}
    if path.name in CATALOGUE:
        out["text"] = raw.decode("utf-8")
    return out


def record(out: Path, command: list[str]) -> int:
    git("checkout", "--", DATA)
    git("clean", "-fdq", "--", DATA)
    start = time.time() - 1
    code = subprocess.run(command, cwd=REPO).returncode
    written = {p.relative_to(REPO).as_posix(): entry(p) for p in sorted((REPO / DATA).rglob("*"))
               if p.is_file() and p.stat().st_mtime >= start}
    out.write_text(json.dumps(written, indent=1), encoding="utf-8")
    print(f"{len(written)} files recorded -> {out} (command exit {code})")
    git("checkout", "--", DATA)
    git("clean", "-fdq", "--", DATA)
    return code


def structural(text: str):
    data = json.loads(text)
    if isinstance(data, dict):
        data.pop("run_id", None)
        for file in data.get("files", []):
            for key in ("bytes", "sha256", "run_id"):
                file.pop(key, None)
    return data


def compare(before: dict, after: dict) -> list[str]:
    problems = [f"only before: {p}" for p in sorted(set(before) - set(after))]
    problems += [f"only after: {p}" for p in sorted(set(after) - set(before))]
    for path in sorted(set(before) & set(after)):
        a, b = before[path], after[path]
        same = (structural(a["text"]) == structural(b["text"]) if "text" in a
                else a["sha256"] == b["sha256"])
        if not same:
            problems.append(f"differs: {path}")
    return problems


def main(argv: list[str]) -> int:
    if argv[:1] == ["record"] and "--" in argv:
        return record(Path(argv[1]), argv[argv.index("--") + 1:])
    if argv[:1] == ["compare"] and len(argv) == 3:
        before, after = (json.loads(Path(p).read_text(encoding="utf-8")) for p in argv[1:])
        problems = compare(before, after)
        exact = sum(before[p]["exact"] == after[p]["exact"] for p in set(before) & set(after))
        print(f"{len(before)} vs {len(after)} files; {exact} identical byte for byte")
        print("\n".join(problems) or "IDENTICAL")
        return 1 if problems or not before else 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
