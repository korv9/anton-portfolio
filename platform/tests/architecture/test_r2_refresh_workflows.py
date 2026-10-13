"""Refresh workflows publish validated groups and preserve failure/restore boundaries."""
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[3]
REFRESHERS = {"refresh-jobs.yml": "jobs", "refresh-news.yml": "news",
              "refresh-welfare.yml": "public-data", "refresh-diva.yml": "diva",
              "refresh-job-analysis.yml": "jobs-analysis"}
WORKFLOWS = [*REFRESHERS, "publish-r2.yml", "build-warehouse.yml"]
CREDENTIALS = ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET")
SHA = "a" * 40


def workflow(filename):
    return yaml.safe_load((ROOT / ".github/workflows" / filename).read_text(encoding="utf-8"))


def steps(filename):
    return [step for job in workflow(filename)["jobs"].values() for step in job["steps"]]


def commands(filename, executable, action=None):
    found = []
    for index, step in enumerate(steps(filename)):
        script = step.get("run", "").replace("\\\n", " ")
        for line in script.splitlines():
            if line.lstrip().startswith("#"):
                continue
            match = re.search(re.escape(executable) + r"\s+([^\n]+)", line)
            if match:
                # Command substitutions may wrap the argv in $(...) or an assignment.
                argv = shlex.split(match[1].rstrip(")"))
                if action is None or argv[0] == action:
                    found.append((index, step, argv))
    return found


def option(argv, flag):
    assert flag in argv, f"Missing {flag}: {argv}"
    return argv[argv.index(flag) + 1]


def bash():
    candidate = shutil.which("bash")
    if os.name == "nt":
        git = shutil.which("git")
        if git:
            candidate = str(Path(git).resolve().parents[1] / "bin/bash.exe")
    assert candidate and Path(candidate).is_file(), "Bash is needed to verify runner error handling"
    return candidate


def run_script(tmp_path, script, **overrides):
    """Run actual Bash control flow; Python/pip/npm boundaries use offline stubs."""
    tmp_path.mkdir(parents=True, exist_ok=True)
    (tmp_path / "frontend/public/data/diva").mkdir(parents=True, exist_ok=True)
    (tmp_path / "frontend/public/data/catalog.json").write_text('{"files": []}')
    output = tmp_path / "output"
    output.write_text("")
    events = tmp_path / "events"
    events.write_text("")
    env = dict(os.environ, **{name: "fixture" for name in CREDENTIALS}, GITHUB_SHA=SHA,
               GITHUB_OUTPUT=str(output), RUNNER_TEMP=str(tmp_path), EVENT_LOG=str(events),
               PYTHON_EXECUTABLE=sys.executable, SUMMARY_EXIT="0", FAIL_GROUP="", CHECK_EXIT="0",
               FAIL_MATERIALIZE="0", BROKEN_RECEIPT="0")
    env.update(overrides)
    script = re.sub(r"\$\{\{\s*github.sha\s*\}\}", SHA, script)
    script = re.sub(r"\$\{\{\s*[^}]+\}\}", "false", script)
    stub = r'''
python() {
  if [ "${1:-}" = -c ] || [ "${1:-}" = - ]; then
    "$PYTHON_EXECUTABLE" "$@"; return $?
  fi
  printf '%s\t' "$@" >> "$EVENT_LOG"; printf '\n' >> "$EVENT_LOG"
  case "$*" in
    *summarize_news.py*) return "$SUMMARY_EXIT" ;;
    *release.py*publish*)
      if [ -n "$FAIL_GROUP" ] && [[ " $* " == *" --group $FAIL_GROUP "* ]]; then return 1; fi
      if [ "$BROKEN_RECEIPT" = 1 ]; then printf 'invalid receipt\n'; return 0; fi
      printf '{"release":"%064d"}\n' 0 ;;
    *release.py*materialize*) if [ "$FAIL_MATERIALIZE" = 1 ]; then return 1; fi ;;
    *validate*) return "$CHECK_EXIT" ;;
  esac
}
pip() { return 0; }
npm() { if [[ "$*" == *data:check* ]]; then return "$CHECK_EXIT"; fi; }
'''
    result = subprocess.run([bash(), "--noprofile", "--norc", "-e", "-o", "pipefail", "-c", stub + script],
                            cwd=tmp_path, env=env, capture_output=True, text=True, timeout=30)
    calls = [line.split("\t")[:-1] for line in events.read_text().splitlines()] if events.exists() else []
    return result, calls, output.read_text()


@pytest.mark.parametrize("filename", WORKFLOWS)
def test_refresh_permissions_and_git_are_read_only(filename):
    config = workflow(filename)
    for job in config["jobs"].values():
        permissions = job.get("permissions", config.get("permissions", {}))
        assert permissions.get("contents") == "read", filename
        for step in job["steps"]:
            script = step.get("run", "")
            assert not re.search(r"\bgit\s+(?:-\S+\s+)*(commit|push)\b", script), filename


@pytest.mark.parametrize("filename,group", REFRESHERS.items())
def test_refresh_uses_scoped_publisher_and_explicit_code_sha(filename, group):
    publications = commands(filename, "platform/publish/release.py", "publish")
    assert publications, f"{filename}: no versioned group publication"
    assert any(option(argv, "--group") == group for _, _, argv in publications)
    for _, step, argv in publications:
        assert "--code-sha" in argv, filename
        assert "GITHUB_SHA" in option(argv, "--code-sha") or "github.sha" in step["run"], filename
        spec = json.loads((ROOT / option(argv, "--spec")).read_text())
        assert spec["schema_version"] == 2
        assert not step.get("continue-on-error"), filename
    assert not commands(filename, "platform/publish/upload.py"), filename


@pytest.mark.parametrize("filename", WORKFLOWS)
def test_credentials_reject_each_missing_or_whitespace_value(tmp_path, filename):
    guards = [step["run"] for step in steps(filename)
              if all(name in step.get("run", "") for name in CREDENTIALS)]
    assert guards, f"{filename}: no complete credential guard"
    guard = guards[0]
    for name in CREDENTIALS:
        for value in ("", " \n\t"):
            result, calls, outputs = run_script(tmp_path, guard, **{name: value})
            assert result.returncode != 0 or "ok=false" in outputs, f"{filename}: accepts {name}={value!r}"
            assert not calls, f"{filename}: reached ingestion/publication without {name}"
    # Harmless pasted line endings must not make a valid secret into a shell command.
    result, calls, outputs = run_script(tmp_path, guard, **{name: "fixture\n" for name in CREDENTIALS})
    assert result.returncode == 0 and "ok=false" not in outputs, filename


@pytest.mark.parametrize("exit_code,expected", [(0, 0), (2, 0), (1, 1)])
def test_news_only_optional_summary_exit_is_tolerated(tmp_path, exit_code, expected):
    summary = next(step for step in steps("refresh-news.yml") if "summarize_news.py" in step.get("run", ""))
    assert not summary.get("continue-on-error")
    result, calls, _ = run_script(tmp_path, summary["run"], SUMMARY_EXIT=str(exit_code))
    assert result.returncode == expected, result.stderr
    assert any("platform/publish/summarize_news.py" in call for call in calls)


def test_news_restores_active_optional_summary_before_rebuilding_headlines():
    restored = commands("refresh-news.yml", "platform/publish/release.py", "materialize")
    assert len(restored) == 1
    index, _, argv = restored[0]
    assert option(argv, "--spec") == "configs/delivery/news.json" and "--prefer-active" in argv
    fetch = next(i for i, step in enumerate(steps("refresh-news.yml"))
                 if "ingest/news/news_ingest.py" in step.get("run", ""))
    assert index < fetch
    for _, step, _ in commands("refresh-news.yml", "platform/publish/release.py", "publish"):
        assert "always()" not in step.get("if", "") and "failure()" not in step.get("if", "")


def test_shared_raw_writers_keep_lock_restore_guards_and_bootstrap_order():
    public = workflow("refresh-welfare.yml")
    manual = workflow("build-warehouse.yml")
    assert public["concurrency"] == manual["concurrency"]
    assert public["concurrency"]["cancel-in-progress"] is False
    for filename in ("refresh-jobs.yml", "refresh-welfare.yml", "build-warehouse.yml"):
        pulls = commands(filename, "platform/publish/warehouse_store.py", "pull")
        restores = {step["id"] for _, step, _ in pulls if "id" in step}
        assert restores, f"{filename}: restore needs an outcome id"
        for _, step, argv in commands(filename, "platform/publish/warehouse_store.py", "push"):
            if "--only" in argv and option(argv, "--only") == "raw":
                assert any(f"steps.{restore}.outcome == 'success'" in step.get("if", "")
                           for restore in restores), f"{filename}: raw push can overwrite failed restore"
    indices = [next(i for i, step in enumerate(steps("refresh-welfare.yml"))
                    if f"ingest/run_{topic}.py" in step.get("run", ""))
               for topic in ("welfare", "parliament", "taxes")]
    assert indices == sorted(indices)
    restores = commands("refresh-welfare.yml", "platform/publish/warehouse_store.py", "pull")
    assert restores[0][0] < indices[0]
    restore_args = restores[0][2]
    assert "riksdagen/studies" in restore_args and "riksdagen/_checkpoints" in restore_args


def test_public_group_materialization_and_validation_precede_publication():
    filename = "refresh-welfare.yml"
    publications = commands(filename, "platform/publish/release.py", "publish")
    assert publications, "public-data needs the versioned publisher"
    position = publications[0][0]
    materialized = commands(filename, "platform/publish/release.py", "materialize")
    assert any((i < position or (i == position and step["run"].index("release.py materialize")
                                < step["run"].index("release.py publish")))
               and option(argv, "--spec") == "configs/delivery/public-data.json"
               for i, step, argv in materialized), "public-data must carry the complete approved group"
    validation = [i for i, step in enumerate(steps(filename))
                  if "validate_public_data.py" in step.get("run", "")]
    assert validation and max(validation) < position
    exports = [i for i, step in enumerate(steps(filename)) if "publish/export_" in step.get("run", "")]
    assert exports and max(exports) < max(validation)


def test_initial_bootstrap_stages_groups_then_activates_once(tmp_path):
    filename = "publish-r2.yml"
    staged = commands(filename, "platform/publish/release.py", "publish")
    activated = commands(filename, "platform/publish/release.py", "activate")
    assert staged and len(activated) == 1, "bootstrap must stage groups then activate one snapshot"
    assert all("--stage-only" in argv and "--code-sha" in argv for _, _, argv in staged)
    # Execute publication control flow, including dynamic loops and optional DiVA selection.
    scripts = [step["run"] for step in steps(filename) if "release.py" in step.get("run", "")]
    result, calls, _ = run_script(tmp_path, "\n".join(scripts))
    assert result.returncode == 0, result.stderr
    pubs = [call for call in calls if "publish" in call]
    acts = [call for call in calls if "activate" in call]
    groups = {option(call, "--group") for call in pubs}
    assert {"baseline", "jobs", "jobs-analysis", "news", "public-data"} == groups
    assert "diva" not in groups, "bootstrap must not invent a DiVA group without published files"
    assert len(acts) == 1 and calls.index(acts[0]) > max(calls.index(call) for call in pubs)
    assert all(option(call, "--code-sha") == SHA for call in pubs)
    activation_groups = {call.split("=", 1)[0] for call in acts[0][acts[0].index("activate") + 1:]
                         if "=" in call}
    assert groups == activation_groups
    (tmp_path / "frontend/public/data/diva/clusters.json").write_text('{"clusters":[],"points":[]}')
    result, calls, _ = run_script(tmp_path, "\n".join(scripts))
    assert result.returncode == 0, result.stderr
    assert any("publish" in call and option(call, "--group") == "diva" for call in calls)
    result, calls, _ = run_script(tmp_path, "\n".join(scripts), FAIL_GROUP="public-data")
    assert result.returncode != 0, "a failed staged group must stop bootstrap"
    assert not any("activate" in call for call in calls), "failed stage must not activate a partial bootstrap"
    for failure in ({"FAIL_MATERIALIZE": "1"}, {"BROKEN_RECEIPT": "1"}):
        result, calls, _ = run_script(tmp_path, "\n".join(scripts), **failure)
        assert result.returncode != 0, f"Bootstrap masks {failure}"
        assert not any("activate" in call for call in calls), f"Bootstrap activates after {failure}"


def test_publication_specs_have_disjoint_real_file_owners():
    sys.path.insert(0, str(ROOT / "platform/publish"))
    import release
    public = ROOT / "frontend/public/data"
    owners = {}
    for group in ("baseline", "jobs", "jobs-analysis", "news", "public-data", "diva"):
        spec = json.loads((ROOT / f"configs/delivery/{group}.json").read_text())
        for path in release.selected(public, spec):
            assert path not in owners, f"{path} belongs to both {owners.get(path)} and {group}"
            owners[path] = group
    assert owners["jobs/market.json"] == "jobs"
    assert owners["parliament/news.json"] == "news"
    assert owners["diva/clusters.json"] == "diva"
    assert owners["gold/marts/jobs.json"] == "jobs-analysis"


def test_daily_jobs_do_not_depend_on_the_heavy_manual_report():
    daily = "\n".join(step.get("run", "") for step in steps("refresh-jobs.yml"))
    manual = "\n".join(step.get("run", "") for step in steps("refresh-job-analysis.yml"))
    assert "run_history_pipeline.py" not in daily and "legacy/build_gold.py" not in daily
    assert "run_history_pipeline.py" in manual and "legacy/build_gold.py" in manual
    assert any("configs/delivery/jobs-analysis.json" in argv
               for _, _, argv in commands("refresh-job-analysis.yml", "platform/publish/release.py", "materialize"))


def test_release_cli_staging_uses_one_activation_and_preserves_snapshot_on_failure(tmp_path, monkeypatch, capsys):
    sys.path.insert(0, str(ROOT / "platform/tests/python"))
    from test_release import S3, spec, write
    import release

    s3 = S3()
    monkeypatch.setattr(release, "client", lambda: (s3, "fixture-bucket"))
    pointers = {}
    for group, path in (("baseline", "sample.json"), ("jobs", "jobs/market.json"),
                        ("news", "parliament/news.json")):
        write(tmp_path, path, b'{"fixture":true}')
        spec_path = tmp_path / f"{group}-spec.json"
        spec_path.write_text(json.dumps(spec(path)))
        monkeypatch.setattr(sys, "argv", ["release.py", "publish", "--group", group,
                                         "--root", str(tmp_path), "--spec", str(spec_path),
                                         "--code-sha", SHA, "--stage-only"])
        release.main()
        pointers[group] = json.loads(capsys.readouterr().out)
        manifest = release.group_manifest(s3, "fixture-bucket", pointers[group])
        assert manifest["code_sha"] == SHA
        assert release.CURRENT not in s3.objects
        assert all(entry["key"] in s3.reads for entry in manifest["files"].values())

    arguments = ["release.py", "activate"]
    for group, pointer in pointers.items():
        arguments.extend(["--release", f"{group}={pointer['release']}"])
    monkeypatch.setattr(sys, "argv", arguments)
    release.main()
    active = json.loads(capsys.readouterr().out)
    assert set(active["groups"]) == set(pointers)
    assert s3.puts[-1] == release.CURRENT and s3.puts.count(release.CURRENT) == 1
    previous = s3.objects[release.CURRENT]["Body"]
    # A CLI validation failure must neither upload nor replace the approved snapshot.
    write(tmp_path, "jobs/market.json", b'{"fixture":NaN}')
    monkeypatch.setattr(sys, "argv", ["release.py", "publish", "--group", "jobs", "--root", str(tmp_path),
                                     "--spec", str(tmp_path / "jobs-spec.json"), "--code-sha", SHA])
    before = list(s3.puts)
    with pytest.raises(SystemExit) as stopped:
        release.main()
    assert stopped.value.code == 1
    assert s3.puts == before and s3.objects[release.CURRENT]["Body"] == previous


def test_configured_diva_contract_rejects_phantom_cluster_links_before_upload(tmp_path, monkeypatch):
    sys.path.insert(0, str(ROOT / "platform/tests/python"))
    from test_release import S3, write
    import release

    write(tmp_path, "diva/clusters.json", b'{"clusters":[{"id":0}],"points":[{"x":0,"y":0,"c":99}]}')
    spec = json.loads((ROOT / "configs/delivery/diva.json").read_text())
    monkeypatch.chdir(ROOT)
    s3 = S3()
    with pytest.raises((ValueError, subprocess.CalledProcessError)):
        release.publish(s3, "fixture-bucket", "diva", tmp_path, spec, code_sha=SHA)
    assert not s3.puts and release.CURRENT not in s3.objects
