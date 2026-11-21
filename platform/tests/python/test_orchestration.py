"""platform/pipeline.py: the registry resolves, and a failed subject does not stop the others."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def cli(*args):
    return subprocess.run([sys.executable, "platform/pipeline.py", *args], cwd=ROOT,
                          capture_output=True, text=True)


def test_every_subject_resolves_to_commands_and_files_that_exist():
    result = cli("run", "--all", "--dry-run")
    assert result.returncode == 0, result.stdout + result.stderr
    assert "--select tag:welfare --target-path target/welfare" in result.stdout
    assert "== publish baseline" in result.stdout


def test_export_waits_for_a_passing_dbt_build_and_later_subjects_still_run():
    # No dbt target exists for either subject in a fresh checkout or after this ran before.
    result = cli("run", "cross_domain", "quality", "--only", "export")
    assert result.returncode == 1
    assert result.stdout.count("not exporting") == 2, result.stdout


def test_one_subject_publishes_its_group_and_a_failed_one_does_not():
    # public-data has welfare, parliament and taxes. The workflow restores the active releases
    # first, so welfare alone publishes the group with the other two subjects' files as they are.
    alone = cli("run", "welfare", "--only", "publish", "--dry-run")
    assert alone.returncode == 0, alone.stdout
    assert "portfolio.publish.release publish --group public-data" in alone.stdout
    # A subject that failed in the run (here: its needs did) stops its group.
    import importlib.util
    spec = importlib.util.spec_from_file_location("orchestration_cli", ROOT / "platform/pipeline.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    failed = {"welfare": "ingest failed"}
    module.publish(module.registry(), ["welfare", "parliament"], failed, {"publish"}, module.Runner(True))
    assert failed["publish public-data"] == "welfare did not succeed"


def test_with_needs_adds_what_a_subject_reads_in_pipeline_order():
    result = cli("run", "parliament", "--with-needs", "--only", "publish", "--dry-run")
    assert "Subjects with their needs: welfare parliament" in result.stdout, result.stdout