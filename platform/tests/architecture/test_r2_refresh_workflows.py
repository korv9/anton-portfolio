"""Data workflows stay read-only and guarded; the bootstrap and the release tool keep their
contracts. What each refresh runs is tested in test_pipeline_workflows.py."""
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
sys.path.insert(0, str(Path(__file__).resolve().parent))
from data_workflows import REUSABLE, workflow  # noqa: E402

REFRESHERS = {"refresh-jobs.yml": "jobs", "refresh-news.yml": "news",
              "refresh-welfare.yml": "public-data", "refresh-diva.yml": "diva",
              "refresh-job-analysis.yml": "jobs-analysis", "refresh-job-assistant.yml": "job-assistant"}
WORKFLOWS = [*REFRESHERS, "publish-r2.yml", "build-warehouse.yml", "cluster-jobs.yml"]
CREDENTIALS = ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET")
SHA = "a" * 40




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
            # git.exe sits in Git/cmd or, under Git Bash, Git/mingw64/bin; bash.exe is in Git/bin.
            found = [p / "bin/bash.exe" for p in Path(git).resolve().parents if (p / "bin/bash.exe").is_file()]
            candidate = str(found[0]) if found else candidate
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
               FAIL_MATERIALIZE="0", BROKEN_RECEIPT="0", EXISTING_GROUP="", CURRENT_EXIT="0",
               EXISTING_SOURCE_GROUP="")
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
    *release.py\ current*)
      if [ "$CURRENT_EXIT" != 0 ]; then return "$CURRENT_EXIT"; fi
      if [ -n "$EXISTING_SOURCE_GROUP" ] && [[ " $* " == *" --group $EXISTING_SOURCE_GROUP "* ]] && [[ " $* " == *" --manifest-key manifests/pipeline-smoke.json "* ]]; then
        printf '{"release":"%064d"}\n' 2
      elif [ -n "$EXISTING_GROUP" ] && [[ " $* " == *" --group $EXISTING_GROUP "* ]]; then
        printf '{"release":"%064d"}\n' 1
      else printf '{"release":null}\n'; fi ;;
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


@pytest.mark.parametrize("filename", ["refresh-jobs.yml", "refresh-news.yml"])
def test_callers_hold_the_lock_and_bound_the_called_jobs(filename):
    config = yaml.safe_load((ROOT / ".github/workflows" / filename).read_text(encoding="utf-8"))
    (job,) = config["jobs"].values()
    assert job["uses"] == REUSABLE and job["secrets"] == "inherit"
    # The caller's token bounds every called job: only the alert's issue write is added.
    assert job["permissions"] == {"contents": "read", "actions": "read", "issues": "write"}
    assert config["permissions"] == {"contents": "read"}
    assert config[True]["schedule"]
    reusable = yaml.safe_load((ROOT / REUSABLE).read_text(encoding="utf-8"))
    # A called workflow runs inside its caller's run; the same group here would wait on itself.
    assert "concurrency" not in reusable and list(reusable[True]) == ["workflow_call"]
    assert reusable["permissions"] == {"contents": "read"}
    assert "permissions" not in reusable["jobs"]["refresh"]


@pytest.mark.parametrize("filename", WORKFLOWS)
def test_credentials_reject_each_missing_or_whitespace_value(tmp_path, filename):
    # The guard is the first step of the shared setup, which every data workflow uses.
    assert any(step.get("uses") == "./.github/actions/data-setup" for step in steps(filename)), filename
    action = yaml.safe_load((ROOT / ".github/actions/data-setup/action.yml").read_text(encoding="utf-8"))
    guard = action["runs"]["steps"][0]["run"]
    assert all(name in guard for name in CREDENTIALS)
    for name in CREDENTIALS:
        for value in ("", " \n\t"):
            result, calls, outputs = run_script(tmp_path, guard, **{name: value})
            assert result.returncode != 0 or "ok=false" in outputs, f"{filename}: accepts {name}={value!r}"
            assert not calls, f"{filename}: reached ingestion/publication without {name}"
    # Harmless pasted line endings must not make a valid secret into a shell command.
    result, calls, outputs = run_script(tmp_path, guard, **{name: "fixture\n" for name in CREDENTIALS})
    assert result.returncode == 0 and "ok=false" not in outputs, filename


def test_weekly_retention_is_a_dry_run_unless_the_owner_opts_in(tmp_path):
    (step,) = [s for s in steps("build-warehouse.yml") if "retention.py" in s.get("run", "")]
    assert "--apply" not in step["run"]
    assert step["env"] == {"APPLY": "${{ vars.RETENTION_APPLY == 'true' && '--apply' || '' }}"}
    for apply in ("", "--apply"):
        summary = tmp_path / f"summary{apply}"
        result, calls, _ = run_script(tmp_path / f"run{apply}", step["run"], APPLY=apply,
                                      GITHUB_STEP_SUMMARY=str(summary))
        assert result.returncode == 0, result.stderr
        ((*_, last),) = [call for call in calls if "platform/publish/retention.py" in call]
        assert (last == "--apply") == bool(apply)
        assert "### Release retention" in summary.read_text()


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
    assert all("--prefer-active" in call for call in calls if "materialize" in call)
    activation_groups = {call.split("=", 1)[0] for call in acts[0][acts[0].index("activate") + 1:]
                         if "=" in call}
    assert groups == activation_groups
    smoke = "manifests/pipeline-smoke.json"
    result, calls, _ = run_script(tmp_path, "\n".join(scripts), MANIFEST_KEY=smoke)
    assert result.returncode == 0, result.stderr
    assert all(option(call, "--manifest-key") == smoke
               for call in calls if "publish" in call or "activate" in call)
    result, calls, _ = run_script(tmp_path, "\n".join(scripts), EXISTING_GROUP="public-data")
    assert result.returncode == 0, result.stderr
    assert not any("publish" in call and option(call, "--group") == "public-data" for call in calls)
    assert any("public-data=" + "0" * 63 + "1" in call for call in calls if "activate" in call)
    result, calls, _ = run_script(tmp_path, "\n".join(scripts), EXISTING_GROUP="jobs",
                                 SOURCE_MANIFEST_KEY=smoke, EXISTING_SOURCE_GROUP="baseline")
    assert result.returncode == 0, result.stderr
    assert not any("publish" in call and option(call, "--group") in {"jobs", "baseline"} for call in calls)
    assert any("baseline=" + "0" * 63 + "2" in call for call in calls if "activate" in call)
    assert any("jobs=" + "0" * 63 + "1" in call for call in calls if "activate" in call)
    result, calls, _ = run_script(tmp_path, "\n".join(scripts), CURRENT_EXIT="1")
    assert result.returncode != 0
    assert not any("publish" in call or "activate" in call for call in calls)
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
    for group in ("baseline", "jobs", "jobs-analysis", "news", "public-data", "diva", "sweden"):
        spec = json.loads((ROOT / f"configs/delivery/{group}.json").read_text())
        for path in release.selected(public, spec):
            assert path not in owners, f"{path} belongs to both {owners.get(path)} and {group}"
            owners[path] = group
    assert owners["jobs/market.json"] == "jobs"
    assert owners["parliament/news.json"] == "news"
    assert owners["diva/clusters.json"] == "diva"
    assert owners["sweden/measurement/summary.json"] == "sweden"
    assert owners["gold/marts/jobs.json"] == "jobs-analysis"


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


@pytest.mark.parametrize("breakage", [None, "empty", "malformed", "missing"])
def test_configured_sweden_contract_gates_tracked_exports(tmp_path, monkeypatch, breakage):
    """The tracked exports pass; an emptied, malformed or absent gated file stops prepare."""
    import jsonschema
    sys.path.insert(0, str(ROOT / "platform/publish"))
    import release

    shutil.copytree(ROOT / "frontend/public/data/sweden", tmp_path / "sweden")
    shutil.copytree(ROOT / "frontend/public/data/clusters", tmp_path / "clusters")
    spec = json.loads((ROOT / "configs/delivery/sweden.json").read_text())
    trends = tmp_path / "sweden/futures/trends.json"
    connections = tmp_path / "sweden/connections/connections.json"
    if breakage == "empty":
        trends.write_text(json.dumps({**json.loads(trends.read_text(encoding="utf-8")), "themes": []}))
    elif breakage == "malformed":
        data = json.loads(connections.read_text(encoding="utf-8"))
        del data["run_id"]
        connections.write_text(json.dumps(data))
    elif breakage == "missing":
        (tmp_path / "sweden/similarity/geometry.json").unlink()
    monkeypatch.chdir(ROOT)
    if breakage is None:
        assert "sweden/futures/trends.json" in release.prepare(tmp_path, spec, "sweden")
    else:
        with pytest.raises(FileNotFoundError if breakage == "missing" else jsonschema.ValidationError):
            release.prepare(tmp_path, spec, "sweden")


def test_cluster_jobs_accepts_only_known_trees_and_never_pushes_a_failed_raw_rebuild():
    """The corpus rebuild writes the raw tree, so a failed run must not overwrite stored files."""
    text = (ROOT / ".github/workflows/cluster-jobs.yml").read_text(encoding="utf-8")
    assert '[ "$TREE" != features ] && [ "$TREE" != raw ]' in text
    assert 'if [ "$TREE" = raw ]; then echo "Run failed: raw files are not pushed."; exit 0; fi' in text
    config = yaml.safe_load((ROOT / "configs/cluster_lab/jobs_corpus.yaml").read_text(encoding="utf-8"))
    assert config["datasets"]
