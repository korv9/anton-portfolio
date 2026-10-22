"""Terraform in infra/: CORS has one source, and only main applies."""
import json
import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[3]


def test_cors_resource_reads_every_key_of_the_committed_policy():
    main = (ROOT / 'infra/cloudflare/main.tf').read_text()
    assert 'file("${path.module}/../../platform/publish/r2-cors.json")' in main
    used = set(re.findall(r'rule\.(\w+)', main))
    for rule in json.loads((ROOT / 'platform/publish/r2-cors.json').read_text()):
        assert set(rule) <= used, set(rule) - used


def test_terraform_workflow_is_read_only_and_applies_only_from_main():
    config = yaml.safe_load((ROOT / '.github/workflows/terraform.yml').read_text())
    assert config['permissions'] == {'contents': 'read'}
    jobs = config['jobs']
    assert 'environment' not in jobs['plan']
    assert jobs['apply']['environment'] == 'terraform'
    assert "github.ref == 'refs/heads/main'" in jobs['apply']['if']
    assert 'terraform apply' not in yaml.safe_dump(jobs['plan'])


def test_state_and_plans_are_never_committed():
    ignored = (ROOT / 'infra/.gitignore').read_text().split()
    assert {'.terraform/', '*.tfstate', '*.tfvars'} <= set(ignored)
