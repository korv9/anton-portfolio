"""The workflows call platform/pipeline.py, and platform/pipeline.yml keeps the order, the
restore guards and the validation that each publication depends on."""
import importlib.util
import json
import re
import shlex
import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform/architecture"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import registry as architecture  # noqa: E402
from data_workflows import workflow  # noqa: E402

PIPELINE = yaml.safe_load((ROOT / "platform/pipeline.yml").read_text(encoding="utf-8"))
SUBJECTS, GROUPS = PIPELINE["subjects"], PIPELINE["groups"]
PHASES = ("ingest", "dbt", "ml", "export")
# Workflow, the subjects it runs, and the delivery group it publishes.
REFRESHERS = {"refresh-jobs.yml": (["market"], "jobs"), "refresh-news.yml": (["news"], "news"),
              "refresh-welfare.yml": (["welfare", "parliament", "taxes"], "public-data"),
              "refresh-diva.yml": (["diva"], "diva"),
              "refresh-job-analysis.yml": (["jobs_analysis"], "jobs-analysis"),
              "refresh-job-assistant.yml": (["job_assistant"], "job-assistant")}
DATA_WORKFLOWS = [*REFRESHERS, "build-warehouse.yml", "publish-r2.yml"]




def steps(filename):
    return [step for job in workflow(filename)["jobs"].values() for step in job["steps"]]


def cli(filename, command):
    """(step index, step, argv after the command) for each `pipeline.py <command>` line."""
    found = []
    for index, step in enumerate(steps(filename)):
        for line in step.get("run", "").splitlines():
            match = re.search(r"platform/pipeline\.py\s+" + command + r"\b(.*)", line)
            if match:
                found.append((index, step, shlex.split(match[1])))
    return found


def flat(items):
    return [x for item in items for x in (flat(item) if isinstance(item, list) else [item])]


def commands(subject):
    """A subject's steps as (phase, command or dbt spec)."""
    return [(phase, step[phase]) for step in SUBJECTS[subject]["steps"] for phase in PHASES if phase in step]


def position(items, text):
    return next(i for i, item in enumerate(items) if text in str(item))


def load_cli():
    # Not `import pipeline`: the symbolic tests import nlp/symbolic/pipeline.py under that name.
    spec = importlib.util.spec_from_file_location("orchestration_cli", ROOT / "platform/pipeline.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize("filename", DATA_WORKFLOWS)
def test_data_workflows_share_the_writer_lock_and_the_setup(filename):
    config = workflow(filename)
    # queue: max keeps every waiting run; the default cancels all but the newest pending one.
    assert config["concurrency"] == {"group": "data-refresh", "cancel-in-progress": False, "queue": "max"}
    uses = [step.get("uses", "") for step in steps(filename)]
    assert next(i for i, use in enumerate(uses) if use.startswith("actions/checkout@")) < uses.index("./.github/actions/data-setup"), filename
    for script in (step.get("run", "") for step in steps(filename)):
        # Sequences, selectors and raw paths live in the registry, not in YAML.
        assert not re.search(r"dbt build|warehouse_store\.py|--path |upload\.py|npm run", script), filename


@pytest.mark.parametrize("filename", DATA_WORKFLOWS)
def test_a_failed_data_job_opens_an_issue_from_a_job_of_its_own(filename):
    jobs = workflow(filename)["jobs"]
    alert = jobs.pop("alert")
    (data,) = jobs
    assert alert["needs"] == data and f"needs.{data}.result" in alert["if"] and "!cancelled()" in alert["if"]
    assert alert["permissions"] == {"contents": "read", "actions": "read", "issues": "write"}
    assert "environment" not in alert, "the alert needs no data secrets"
    assert alert["steps"][-1] == {"uses": "./.github/actions/failure-issue",
                                  "with": {"result": f"${{{{ needs.{data}.result }}}}"}}


def test_pipeline_schedules_match_the_workflow_crons():
    """pipeline.yml's schedule documents the cron of the workflow that runs the subject."""
    crons = {name: [entry["cron"] for entry in workflow(name)[True].get("schedule", [])]
             for name in DATA_WORKFLOWS}
    runner = {subject: name for name, (subjects, _) in REFRESHERS.items() for subject in subjects}
    used = {name: set() for name in crons}
    for subject, config in SUBJECTS.items():
        if config.get("manual"):
            assert config["schedule"] in ("manual", "every push"), subject
            continue
        # A subject without manual: true runs in its refresh workflow or in the weekly --all.
        name = runner.get(subject, "build-warehouse.yml")
        assert config["schedule"] in crons[name], f"{subject}: {config['schedule']} is not a cron of {name}"
        used[name].add(config["schedule"])
    for name, schedule in crons.items():
        assert set(schedule) == used[name], f"{name} runs on a cron no subject documents"


@pytest.mark.parametrize("filename", REFRESHERS)
def test_refresh_runs_its_subjects_and_publishes_their_group(filename):
    subjects, group = REFRESHERS[filename]
    ran = [arg for _, _, argv in cli(filename, "run") for arg in argv if not arg.startswith("-")]
    assert set(subjects) <= set(ran), filename
    assert {SUBJECTS[name]["group"] for name in subjects} == {group}
    publications = [shlex.split(c) for c in flat(GROUPS[group]["publish"]) if "release.py publish" in c]
    assert len(publications) == 1
    argv = publications[0]
    assert argv[argv.index("--group") + 1] == group
    assert argv[argv.index("--code-sha") + 1] == "{sha}", "the published commit must be explicit"
    assert json.loads((ROOT / argv[argv.index("--spec") + 1]).read_text())["schema_version"] == 2


def test_no_group_or_subject_uses_the_unversioned_uploader():
    assert "upload.py" not in (ROOT / "platform/pipeline.yml").read_text(encoding="utf-8")


def test_raw_pushes_wait_for_a_successful_restore():
    for filename in ("refresh-jobs.yml", "refresh-welfare.yml", "refresh-diva.yml", "build-warehouse.yml"):
        setup = next(step for step in steps(filename) if step.get("uses") == "./.github/actions/data-setup")
        assert setup["id"] == "setup" and setup["with"]["pull"], f"{filename}: restore needs an outcome id"
        pushes = cli(filename, "push")
        assert pushes, filename
        for _, step, argv in pushes:
            # A push with no condition runs only when every earlier step, the restore included, succeeded.
            assert "if" not in step or "steps.setup.outcome == 'success'" in step["if"], \
                f"{filename}: raw push can overwrite a failed restore"


def test_public_refresh_keeps_checkpoints_the_gate_and_the_check_order():
    filename = "refresh-welfare.yml"
    job = workflow(filename)["jobs"]["refresh"]
    assert job["timeout-minutes"] >= 180
    all_steps = job["steps"]
    restore = next(i for i, s in enumerate(all_steps) if s.get("id") == "setup")
    assert all_steps[restore]["with"]["pull"].split() == ["welfare", "parliament", "taxes"]
    order = []
    for topic in ("welfare", "parliament", "taxes"):
        i = next(i for i, s in enumerate(all_steps) if s.get("id") == topic)
        assert restore < i and all_steps[i]["continue-on-error"] is True
        assert f"pipeline.py run {topic} " in all_steps[i]["run"]
        order.append(i)
    assert order == sorted(order)
    save = next(s for s in all_steps if "always()" in s.get("if", "") and "pipeline.py push" in s.get("run", ""))
    assert "steps.setup.outcome == 'success'" in save["if"]
    assert save["run"].split()[-3:] == ["welfare", "parliament", "taxes"]
    gate = next(i for i, s in enumerate(all_steps)
                if all(f"steps.{topic}.outcome" in " ".join(s.get("env", {}).values())
                       for topic in ("welfare", "parliament", "taxes")))
    publish = next(i for i, s in enumerate(all_steps) if "--only publish" in s.get("run", ""))
    assert max(order) < gate < publish
    assert "if" not in all_steps[publish] and not all_steps[publish].get("continue-on-error")
    for topic in ("welfare", "parliament", "taxes"):
        assert SUBJECTS[topic]["prune"] is True
    raw = SUBJECTS["parliament"]["raw"]
    assert "riksdagen/studies" in raw and "riksdagen/_checkpoints" in raw


def test_public_group_is_exported_checked_and_materialized_before_publication():
    publish = flat(GROUPS["public-data"]["publish"])
    schema, check, validate = (position(publish, name) for name in
                               ("export_schema.py", "validate_politics.py", "validate_public_data.py"))
    materialize, release, status = (position(publish, name) for name in
                                    ("release.py materialize", "release.py publish", "publish_status.py"))
    assert schema < check < validate < materialize < release < status
    assert "configs/delivery/public-data.json" in publish[materialize]
    for topic in ("welfare", "parliament", "taxes"):
        assert commands(topic)[-1] == ("export", f"python platform/publish/export_{topic}.py")


def test_news_restores_the_active_summary_first_and_tolerates_only_a_missing_summary(tmp_path):
    news = SUBJECTS["news"]["steps"]
    assert "release.py materialize" in news[0]["ingest"] and "--prefer-active" in news[0]["ingest"]
    assert "configs/delivery/news.json" in news[0]["ingest"]
    assert position(news, "news_ingest.py") > 0
    summary = next(step for step in news if "summarize_news.py" in step.get("export", ""))
    assert summary["when_env"] == "ANTHROPIC_API_KEY" and summary["ok_exit"] == [2]
    assert news.index(summary) == len(news) - 1, "publication follows the summary"
    module = load_cli()
    run = module.Runner(dry_run=False)
    run([sys.executable, "-c", "raise SystemExit(2)"], ok_exit=summary["ok_exit"])
    with pytest.raises(RuntimeError):
        run([sys.executable, "-c", "raise SystemExit(1)"], ok_exit=summary["ok_exit"])


def test_ml_stage_runs_when_its_output_is_missing_or_its_inputs_may_have_changed(tmp_path, monkeypatch):
    module = load_cli()
    monkeypatch.setattr(module, "FEATURES", tmp_path)
    step = {"ml": "python stage.py", "marker": "stage/run.json", "stale_arg": "--if-stale"}
    assert module.ml_argv(step, "missing")[-1] == "--if-stale"
    (tmp_path / "stage").mkdir()
    (tmp_path / "stage/run.json").write_text("{}")
    assert module.ml_argv(step, "missing") is None
    assert module.ml_argv(step, "stale")[-2:] == ["stage.py", "--if-stale"]
    assert module.ml_argv(step, "always")[-1] == "stage.py"
    for subject in ("ai_politics", "symbolic", "philosophy", "concepts"):
        stage = next(s for s in SUBJECTS[subject]["steps"] if "ml" in s)
        assert stage["stale_arg"] == "--if-stale", subject


def test_export_needs_the_whole_build_not_only_a_passing_first_dbt_step(tmp_path, monkeypatch):
    module = load_cli()
    monkeypatch.setattr(module, "PLATFORM", tmp_path)
    target = tmp_path / "target/subject"
    target.mkdir(parents=True)
    (target / "run_results.json").write_text(json.dumps({"results": [{"status": "pass"}]}))
    assert not module.tests_passed("subject")
    module.mark_built("subject")
    assert module.tests_passed("subject")
    (target / "run_results.json").write_text(json.dumps({"results": [{"status": "pass"}, {"status": "fail"}]}))
    assert not module.tests_passed("subject")


def test_daily_jobs_do_not_depend_on_the_heavy_manual_report():
    daily = str(commands("market"))
    manual = str(commands("jobs_analysis"))
    assert "run_history_pipeline.py" not in daily and "legacy/build_gold.py" not in daily
    assert "run_history_pipeline.py" in manual and "legacy/build_gold.py" in manual
    assert SUBJECTS["jobs_analysis"]["manual"] is True
    assert any("configs/delivery/jobs-analysis.json" in c and "materialize" in c
               for c in flat(GROUPS["jobs-analysis"]["publish"]))


def dbt_tags() -> set[str]:
    text = (ROOT / "platform/dbt_project.yml").read_text(encoding="utf-8")
    return {t.strip() for group in re.findall(r"\+tags: \[([^\]]+)\]", text) for t in group.split(",")}


def test_the_weekly_run_builds_every_dbt_subject_before_the_warehouse_is_stored():
    filename = "build-warehouse.yml"
    build = next(i for i, _, argv in cli(filename, "run") if "--all" in argv and "dbt" in argv[argv.index("--only") + 1])
    store = next(i for i, step, argv in cli(filename, "push") if "--all" in argv and "if" not in step)
    publish = next(i for i, _, argv in cli(filename, "run") if "publish" in argv[argv.index("--only") + 1])
    retention = next(i for i, s in enumerate(steps(filename)) if "retention.py" in s.get("run", ""))
    assert build < store < publish < retention
    setup = steps(filename)[0:2][1]["with"]
    assert setup["pull"] == "--all" and setup["ml"] == "true"
    weekly = {name: s for name, s in SUBJECTS.items() if not s.get("manual")}
    selected = {sel.lstrip("+") for s in weekly.values() for step in s["steps"] if "dbt" in step
                for sel in step["dbt"]["select"]}
    # Manual subjects (built on demand from stored counts) are not part of the weekly run.
    manual = {sel.lstrip("+").removeprefix("tag:") for s in SUBJECTS.values() if s.get("manual")
              for step in s["steps"] if "dbt" in step for sel in step["dbt"]["select"]}
    # serving is part of the welfare build; the job-ad detail models belong to jobs_analysis.
    for tag in sorted(dbt_tags() - {"serving", "jobs"} - manual):
        assert f"tag:{tag}" in selected, f"tag:{tag} is not built by `pipeline.py run --all`"


def test_every_ml_stage_that_feeds_dbt_and_every_new_source_is_in_the_weekly_run():
    weekly = str([commands(name) for name, s in SUBJECTS.items() if not s.get("manual")])
    for stage in architecture.ML:
        if any(r.endswith("_features") for r in stage.get("raw", [])):
            assert stage["path"] in weekly, f"{stage['id']} ({stage['path']}) is not in the weekly run"
    for script in ["eu_ai_act/run.py", "riksdagen/ingest_speeches.py", "symbolic/ingest_corpus.py",
                   "philosophy/ingest_corpus.py", "jobtech/ingest_governance_terms.py"]:
        assert f"platform/ingest/{script}" in weekly, script


def test_source_freshness_runs_before_the_build_and_never_fails_it():
    module = load_cli()
    calls = []

    class Recorder:
        dry_run = True

        def __call__(self, argv, cwd=None, ok_exit=(), hide=()):
            calls.append((argv, tuple(ok_exit)))

    step = {"select": ["tag:x", "+y"], "freshness": True}
    module.run_subject("s", {"steps": [{"dbt": step}]}, {"dbt"}, "missing", Recorder())
    (fresh, fresh_ok), (build, _) = calls
    assert fresh[3:5] == ["source", "freshness"] and fresh_ok == (1, 2)
    assert fresh[fresh.index("--select") + 1:][:2] == ["+tag:x", "+y"] and "build" in build
    flagged = {name for name, s in SUBJECTS.items() for st in s["steps"] if st.get("dbt", {}).get("freshness")}
    assert flagged == {"ai_act", "ai_politics", "symbolic", "philosophy", "quality", "news", "sfs"}


def test_step_secrets_reach_only_their_step():
    module = load_cli()
    calls = []

    class Recorder:
        dry_run = True

        def __call__(self, argv, cwd=None, ok_exit=(), hide=()):
            calls.append((argv[-1], hide))

    steps = [{"ingest": "python a.py", "secrets": ["AI_TOKEN"]}, {"ingest": "python b.py"}]
    module.run_subject("s", {"steps": steps}, {"ingest"}, "missing", Recorder())
    assert calls == [("a.py", ()), ("b.py", ("AI_TOKEN",))]
    rank = next(st for st in SUBJECTS["job_assistant"]["steps"] if "rank.py" in st.get("ingest", ""))
    assert rank["secrets"] == ["CLOUDFLARE_API_TOKEN"] and rank["ok_exit"] == [1]
