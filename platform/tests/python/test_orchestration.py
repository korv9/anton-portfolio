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


def test_only_publish_keeps_the_group_completeness_check():
    # public-data has welfare, parliament and taxes; one of them is not the whole group.
    partial = cli("run", "welfare", "--only", "publish", "--dry-run")
    assert partial.returncode == 1 and "portfolio.publish.release publish" not in partial.stdout
    assert "publish public-data: parliament, taxes not in this run" in partial.stdout
    whole = cli("run", "welfare", "parliament", "taxes", "--only", "publish", "--dry-run")
    assert whole.returncode == 0, whole.stdout
    assert "portfolio.publish.release publish --group public-data" in whole.stdout
