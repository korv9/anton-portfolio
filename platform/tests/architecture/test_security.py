"""Security boundaries for PR jobs, release jobs and the static site's policy."""
import importlib.util
import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location('security_headers', ROOT / 'scripts/check_security_headers.py')
CHECK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECK)


def test_pr_ci_has_no_cloud_credentials_and_releases_require_main():
    ci = (ROOT / '.github/workflows/ci.yml').read_text()
    assert 'secrets.' not in ci
    assert 'R2_' not in ci
    for path in (ROOT / '.github/workflows').glob('*.yml'):
        config = yaml.safe_load(path.read_text())
        for job in config['jobs'].values():
            if job.get('environment') == 'anton-portfolio':
                assert job['if'] == "github.ref == 'refs/heads/main'", path.name


def test_remote_actions_are_pinned_to_commits():
    for path in (ROOT / '.github').rglob('*.yml'):
        for use in re.findall(r'^\s*-?\s*uses:\s*(\S+)', path.read_text(), re.M):
            assert use.startswith('./') or re.fullmatch(r'[\w.-]+/[\w./-]+@[a-f0-9]{40}', use), (path, use)


def test_python_locks_match_the_declared_direct_dependencies():
    platform = ROOT / 'platform'
    inputs = {
        'ci': ['requirements.txt'],
        'ml': ['requirements.txt', 'requirements-symbolic.txt', 'requirements-ml.in'],
        'news': ['requirements.txt', 'requirements-news.in'],
        'security': ['requirements-security.in'],
    }
    for name, paths in inputs.items():
        lock = (platform / f'requirements-{name}.lock').read_text()
        locked = dict(re.findall(r'^([\w.-]+)==([^\s\\]+)', lock, re.M))
        for path in paths:
            source = (platform / path).read_text()
            for package, version in re.findall(r'^([\w.-]+)==([^\s#]+)', source, re.M):
                assert locked.get(package.lower().replace('_', '-')) == version, (name, package)
            for wheel in re.findall(r'^torch @ (\S+)', source, re.M):
                assert f'torch @ {wheel}' in lock


def test_policy_rejects_missing_headers_and_script_relaxations():
    rule = (ROOT / 'frontend/public/_headers').read_text().split('/*\n')[1].split('\n\n')[0]
    headers = dict(line.strip().split(': ', 1) for line in rule.splitlines() if line.strip())
    assert CHECK.validate_headers(headers) == []
    assert CHECK.validate_headers({})
    # The deployed policy allows the Cloudflare beacon and nothing else outside the site.
    beacon = "script-src 'self' https://static.cloudflareinsights.com"
    assert beacon in headers['Content-Security-Policy']
    for relaxation in ("'unsafe-inline'", "'unsafe-eval'", 'https:'):
        for spot in ("script-src 'self'", beacon):
            relaxed = {**headers, 'Content-Security-Policy': headers['Content-Security-Policy'].replace(
                spot, f'{spot} {relaxation}')}
            assert CHECK.validate_headers(relaxed), (spot, relaxation)
