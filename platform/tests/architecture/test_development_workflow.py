"""Keep local checks bounded while preserving the complete merge gate."""
import importlib.util
import json
import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[3]


def script(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / f'scripts/{name}.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_pr_and_main_keep_all_required_jobs_without_duplicate_branch_pushes():
    for name, jobs in [('ci', {'frontend', 'platform'}),
                       ('security', {'dependencies', 'secrets'})]:
        config = yaml.safe_load((ROOT / f'.github/workflows/{name}.yml').read_text())
        events = config.get('on', config.get(True))
        assert events['push']['branches'] == ['main']
        assert 'pull_request' in events and 'workflow_dispatch' in events
        assert jobs <= set(config['jobs'])
        assert all('if' not in config['jobs'][required] for required in jobs)
    security = (ROOT / '.github/workflows/security.yml').read_text()
    assert 'schedule:' in security and 'fetch-depth: 0' in security
    assert '--log-opts="$BASE_SHA..$HEAD_SHA"' in security


def test_security_checks_reuse_the_same_production_build():
    package = json.loads((ROOT / 'package.json').read_text())['scripts']
    ci = (ROOT / '.github/workflows/ci.yml').read_text()
    assert 'npm run test:security:built' in ci
    assert 'npm run build' not in package['test:security:built']
    assert 'npm run build' in package['test:security']


def test_quick_checks_never_start_browser_build_or_live_delivery():
    def plan(mode):
        run = subprocess.run(['node', 'scripts/verify.mjs', mode, '--plan'],
                             cwd=ROOT, capture_output=True, text=True, check=True)
        return json.loads(run.stdout)
    assert plan('quick') == ['check', 'format:check', 'test:unit']
    full = plan('full')
    assert full.count('build') == 1
    assert {'python-tests', 'test:e2e', 'test:security:built'} <= set(full)
    assert 'data:check' not in full
    assert 'data:check' in plan('delivery')
    bad = subprocess.run(['node', 'scripts/verify.mjs', 'unknown', '--plan'],
                         cwd=ROOT, capture_output=True, text=True)
    assert bad.returncode == 2


def test_low_disk_fails_before_any_checks_start(monkeypatch, tmp_path):
    module = script('preflight')
    monkeypatch.setattr(module.shutil, 'disk_usage', lambda _: SimpleNamespace(free=1024))
    with pytest.raises(RuntimeError, match='no files were removed'):
        module.check('full', tmp_path)
    assert list(tmp_path.iterdir()) == []


def test_source_checkout_keeps_worker_and_verification_line_endings_portable():
    output = subprocess.run(['git', 'check-attr', 'eol', '--', 'worker/index.ts',
                             'worker/index.test.ts', 'scripts/verify.mjs'],
                            cwd=ROOT, capture_output=True, text=True, check=True).stdout
    assert len(output.splitlines()) == 3
    assert all(line.endswith(': eol: lf') for line in output.splitlines())


def test_workspace_report_preserves_dirty_unmerged_and_primary_worktrees(tmp_path):
    module = script('workspaces')
    repo = tmp_path / 'primary'
    repo.mkdir()
    def git(path, *args):
        return subprocess.run(['git', '-C', str(path), *args], check=True,
                              capture_output=True, text=True).stdout
    git(repo, 'init', '-b', 'main')
    git(repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
        'commit', '--allow-empty', '-m', 'fixture')
    git(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD')
    clean = tmp_path / 'merged'
    dirty = tmp_path / 'dirty'
    git(repo, 'worktree', 'add', '-b', 'merged', str(clean))
    git(repo, 'worktree', 'add', '-b', 'pending', str(dirty))
    (dirty / 'uncommitted.txt').write_text('work in progress')
    rows = {row['branch']: row for row in module.inventory(repo)}
    assert rows['merged']['review_for_retirement']
    assert not rows['main']['review_for_retirement']
    assert not rows['pending']['review_for_retirement']
    assert (dirty / 'uncommitted.txt').read_text() == 'work in progress'
    (repo / '.git/info/exclude').write_text('private-local/\n')
    private = clean / 'private-local'
    private.mkdir()
    (private / 'profile.json').write_text('private fixture')
    rows = {row['branch']: row for row in module.inventory(repo)}
    assert rows['merged']['ignored_local_files_present']
    assert not rows['merged']['review_for_retirement']
    assert (private / 'profile.json').read_text() == 'private fixture'
    (dirty / 'uncommitted.txt').unlink()
    git(dirty, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
        'commit', '--allow-empty', '-m', 'pending work')
    rows = {row['branch']: row for row in module.inventory(repo)}
    assert not rows['pending']['included_in_cached_origin_main']
    assert not rows['pending']['review_for_retirement']
    assert len(git(repo, 'worktree', 'list').splitlines()) == 3
