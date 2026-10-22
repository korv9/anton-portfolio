"""Run a subject from source to site, as platform/pipeline.yml defines it.

    python platform/pipeline.py list
    python platform/pipeline.py run welfare
    python platform/pipeline.py run welfare parliament taxes --only ingest,dbt
    python platform/pipeline.py run symbolic --only dbt:1    # only the first dbt step
    python platform/pipeline.py run --all --ml stale --dry-run
    python platform/pipeline.py pull welfare          # the subject's raw and feature files from R2
    python platform/pipeline.py push welfare
    python platform/pipeline.py push ai_politics --only raw
    python platform/pipeline.py check                 # the data contracts on the delivered files

The same command runs locally and in GitHub Actions. Publishing changes the live site, so it
runs only in Actions or when asked for with --only publish. One failed subject does not stop
the others; the exit code is non-zero if any failed.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent / "publish"))
import ingest_status  # noqa: E402

PLATFORM = Path(__file__).resolve().parent
ROOT = PLATFORM.parent
FEATURES = Path(os.environ.get("PORTFOLIO_FEATURES", ROOT / "warehouse/features"))
PHASES = ("ingest", "dbt", "ml", "export", "publish")
CREDENTIALS = ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET")
STORE = "python platform/publish/warehouse_store.py"


def registry() -> dict:
    return yaml.safe_load((PLATFORM / "pipeline.yml").read_text(encoding="utf-8"))


def flat(items) -> list:
    """YAML aliases (*data_check) nest a list inside a list."""
    return [x for item in items for x in (flat(item) if isinstance(item, list) else [item])]


def expand(command: str) -> list[str]:
    command = re.sub(r"\$\{(\w+)(?::-([^}]*))?\}",
                     lambda m: os.environ.get(m[1]) or m[2] or "", command)
    if "{sha}" in command:
        sha = os.environ.get("GITHUB_SHA") or subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
        command = command.replace("{sha}", sha)
    argv = shlex.split(command)
    return [sys.executable, *argv[1:]] if argv[0] == "python" else argv


def dbt_argv(spec: dict, target: str) -> list[str]:
    # buildable: a test runs only when all of its models are selected or upstream of the selection,
    # so another subject's tests against a shared dimension stay with that subject.
    argv = [sys.executable, "-m", "dbt.cli.main", "build", "--profiles-dir", ".",
            "--indirect-selection", "buildable", "--select", *spec["select"]]
    if spec.get("exclude"):
        argv += ["--exclude", *spec["exclude"]]
    return argv + ["--target-path", f"target/{target}"]


def freshness_argv(spec: dict, target: str) -> list[str]:
    """dbt source freshness for the sources upstream of a dbt step; dbt skips those without a
    freshness config. It runs before the build, so the build's run_results.json stands."""
    select = [s if s.startswith("+") else f"+{s}" for s in spec["select"]]
    return [sys.executable, "-m", "dbt.cli.main", "source", "freshness", "--profiles-dir", ".",
            "--select", *select, "--target-path", f"target/{target}"]


def missing_files(argv: list[str], cwd: Path) -> list[str]:
    """Scripts, delivery specs and dbt paths a command names that are not in the checkout."""
    paths = [a.removeprefix("path:") for a in argv[1:]
             if a.endswith(".py") or a.startswith(("configs/", "path:"))]
    return [p for p in paths if not (cwd / p).exists()]


def built(target: str) -> Path:
    """Written when a subject's ingest, dbt and ML steps have all come through; removed when they
    start. A later invocation (--only export) reads it, so a build that stopped after its first
    dbt step cannot be exported on the strength of that step's passing tests."""
    return PLATFORM / "target" / target / "built"


def mark_built(target: str) -> None:
    built(target).parent.mkdir(parents=True, exist_ok=True)
    built(target).touch()


def tests_passed(target: str) -> bool:
    path = PLATFORM / "target" / target / "run_results.json"
    if not path.is_file() or not built(target).is_file():
        return False
    results = json.loads(path.read_text(encoding="utf-8"))["results"]
    return bool(results) and not any(r["status"] in ("fail", "error", "skipped") for r in results)


class Runner:
    def __init__(self, dry_run: bool):
        self.dry_run = dry_run
        self.missing: list[str] = []

    def __call__(self, argv: list[str], cwd: Path = ROOT, ok_exit=()) -> None:
        shown = " ".join("python" if a == sys.executable else a for a in argv)
        print(f"  $ {shown}" + ("" if cwd == ROOT else "   (in platform/)"), flush=True)
        if self.dry_run:
            self.missing += missing_files(argv, cwd)
            return
        env = dict(os.environ, DBT_SEND_ANONYMOUS_USAGE_STATS="false")
        code = subprocess.run(argv, cwd=cwd, env=env).returncode
        if code and code not in ok_exit:
            raise RuntimeError(f"exit {code}: {shown}")
        if code:
            print(f"::warning::exit {code} is allowed for this step; continuing: {shown}", flush=True)


def ml_argv(step: dict, mode: str) -> list[str] | None:
    """The stage's command, or None when its stored output stands."""
    stale_arg, marker = step.get("stale_arg"), step.get("marker")
    stored = marker and (FEATURES / marker).is_file()
    if stored and (mode == "missing" or (mode == "stale" and not stale_arg)):
        return None
    return expand(step["ml"]) + ([stale_arg] if stale_arg and mode != "always" else [])


def run_subject(name: str, subject: dict, phases: set[str], ml: str, run: Runner) -> None:
    target = subject.get("target", name)
    has_dbt = any("dbt" in step for step in subject["steps"])
    seen: dict[str, int] = {}
    building = False
    for step in subject["steps"]:
        phase = next(p for p in PHASES if p in step)
        seen[phase] = seen.get(phase, 0) + 1
        if phase not in phases and f"{phase}:{seen[phase]}" not in phases:
            continue
        if not run.dry_run and has_dbt and (phase == "export") == building:
            # Entering the build steps, or leaving them for the exports with none failed.
            building = not building
            built(target).unlink(missing_ok=True)
            if not building:
                mark_built(target)
        if step.get("when_env") and not os.environ.get(step["when_env"]) and not run.dry_run:
            print(f"  skipped ({step['when_env']} is not set): {step[phase]}")
            continue
        if phase == "dbt":
            if step["dbt"].get("freshness"):
                # Warn-only: a stale or unreadable source is reported and never stops the build.
                run(freshness_argv(step["dbt"], target), cwd=PLATFORM, ok_exit=(1, 2))
            run(dbt_argv(step["dbt"], target), cwd=PLATFORM)
        elif phase == "ml":
            argv = ml_argv(step, ml)
            if argv:
                run(argv)
            else:
                print(f"  kept {step['marker']} (--ml {ml}): {step['ml']}")
        else:
            if phase == "export" and has_dbt and not run.dry_run and not tests_passed(target):
                raise RuntimeError(f"no passing dbt build in platform/target/{target}; not exporting")
            run(expand(step[phase]), ok_exit=step.get("ok_exit", ()))
    if building:
        mark_built(target)


def publish(config: dict, names: list[str], failed: dict, phases: set[str], run: Runner) -> None:
    """Each group once, and only when all of its subjects came through this run."""
    subjects = config["subjects"]
    for group in dict.fromkeys(subjects[n]["group"] for n in names if "group" in subjects[n]):
        members = [n for n, s in subjects.items()
                   if s.get("group") == group and (n in names or not s.get("manual"))]
        absent = [n for n in members if n not in names or n in failed]
        print(f"\n== publish {group}", flush=True)
        if absent and phases != {"publish"}:
            print(f"  skipped: {', '.join(absent)} did not succeed in this run")
            continue
        if not run.dry_run and not all(os.environ.get(k, "").strip() for k in CREDENTIALS):
            failed[f"publish {group}"] = "R2 credentials are not set"
            continue
        try:
            for command in flat(config["groups"][group]["publish"]):
                run(expand(command))
        except RuntimeError as error:
            failed[f"publish {group}"] = str(error)


def command_run(args, config: dict) -> int:
    subjects = config["subjects"]
    names = [n for n, s in subjects.items() if not s.get("manual")] if args.all else args.subjects
    phases = set(args.only.split(",")) if args.only else set(PHASES)
    if unknown := [n for n in names if n not in subjects] + sorted(
            p for p in phases if p.split(":")[0] not in PHASES):
        raise SystemExit(f"Unknown: {', '.join(unknown)}")
    if not names:
        raise SystemExit("Name a subject or pass --all (python platform/pipeline.py list)")
    if args.full_refresh:
        os.environ["PORTFOLIO_FULL_REFRESH"] = "1"
    # Publishing is opt-in outside Actions: a local run never moves the live site by accident.
    if not args.only and not args.dry_run and os.environ.get("GITHUB_ACTIONS") != "true":
        phases.discard("publish")
    run, failed = Runner(args.dry_run), {}
    for name in names:
        print(f"\n== {name}", flush=True)
        if blocked := [n for n in subjects[name].get("needs", []) if n in failed]:
            failed[name] = f"needs {', '.join(blocked)}"
            continue
        started = datetime.now(timezone.utc).isoformat(timespec="seconds")
        try:
            run_subject(name, subjects[name], phases, args.ml, run)
        except RuntimeError as error:
            failed[name] = str(error)
        if "ingest" in phases and not run.dry_run and any("ingest" in s for s in subjects[name]["steps"]):
            try:
                ingest_status.record(name, subjects[name], started, failed.get(name))
            except Exception as error:  # noqa: BLE001 - the status page must not fail a subject
                print(f"::warning::ingestion status of {name} not recorded: {error}", flush=True)
    if "publish" in phases:
        publish(config, names, failed, phases, run)
    for path in dict.fromkeys(run.missing):
        failed[path] = "file not found"
    print("\n" + ("All succeeded." if not failed else "Failed:"))
    for name, reason in failed.items():
        print(f"  {name}: {reason}")
    return 1 if failed else 0


def command_store(args, config: dict) -> int:
    """Pull or push the raw and feature files of the named subjects (everything with --all)."""
    run, subjects = Runner(args.dry_run), config["subjects"]
    if args.all:
        if args.action == "pull":
            run(expand(f"{STORE} pull --only raw"))
            run(expand(f"{STORE} pull --only features"))
        else:
            run(expand(f"{STORE} push"))
            run(expand(f"{STORE} status"))
        return 0
    chosen = [subjects[n] for n in args.subjects]
    for tree in ("raw", "features"):
        paths = list(dict.fromkeys(p for s in chosen for p in s.get(tree, [])))
        if not paths or args.only not in (None, tree):
            continue
        prune = args.action == "push" and tree == "raw" and all(s.get("prune") for s in chosen)
        run(expand(f"{STORE} {args.action} --only {tree}") + (["--prune"] if prune else [])
            + [x for p in paths for x in ("--path", p)])
    return 0


def write_modes(subject: dict) -> str:
    """The declared write mode per layer: raw=mirror warehouse=overwrite raw=merge(path) ..."""
    return " ".join(f"{layer}=" + (mode if isinstance(mode, str) else f"merge({','.join(mode['merge'])})")
                    for layer, mode in subject["write"].items())


def command_list(config: dict) -> int:
    print(f"{'subject':<19}{'group':<15}{'schedule':<14}{'sla':<6}{'phases':<26}write")
    for name, subject in config["subjects"].items():
        phases = " ".join(dict.fromkeys(next(p for p in PHASES if p in step) for step in subject["steps"]))
        needs = f"   needs {', '.join(subject['needs'])}" if subject.get("needs") else ""
        print(f"{name:<19}{subject.get('group', '-'):<15}{subject['schedule']:<14}"
              f"{subject['sla']['fresh_within']:<6}{phases:<26}{write_modes(subject)}{needs}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("list")
    commands.add_parser("check")
    for name in ("run", "pull", "push"):
        sub = commands.add_parser(name)
        sub.add_argument("subjects", nargs="*")
        sub.add_argument("--all", action="store_true",
                         help="Every subject that is not marked manual")
        sub.add_argument("--dry-run", action="store_true",
                         help="Print every command and check that the files it names exist")
        sub.set_defaults(action=name)
    for name in ("pull", "push"):
        commands.choices[name].add_argument("--only", choices=["raw", "features"])
    run = commands.choices["run"]
    run.add_argument("--only", help="Comma-separated phases: " + ", ".join(PHASES))
    run.add_argument("--full-refresh", action="store_true",
                     help="Refetch history as well as current data (PORTFOLIO_FULL_REFRESH=1)")
    run.add_argument("--ml", choices=["missing", "always", "stale"], default="missing",
                     help="missing: only stages with no stored output; stale: also when inputs changed")
    args = parser.parse_args()
    config = registry()
    if args.command == "list":
        return command_list(config)
    if args.command == "check":
        for command in flat(config["definitions"]["data_check"]):
            Runner(False)(expand(command))
        return 0
    return command_run(args, config) if args.command == "run" else command_store(args, config)


if __name__ == "__main__":
    sys.exit(main())
