"""Acceptance: may a candidate replace the champion? Criteria are fixed before the final evaluation.

Criteria live in `configs/experiments/<domain>.yaml` and are read here, never computed from the
results. Each is checked on its own and reported with both values; there is no weighted total.
A candidate passes only when every `required` criterion holds. The criteria file's hash goes into
the report, so a report always names the exact rules it was judged by.

A criterion is one of:
  {metric: a.b.c, at_least: 0.6}                       absolute floor
  {metric: a.b.c, at_most: 0.4}                        absolute ceiling
  {metric: a.b.c, not_worse_than_champion: 0.02}       may be at most 0.02 worse (direction: higher|lower)
  {metric: a.b.c, better_than_champion: 0.02}          must improve by at least 0.02
"""
from __future__ import annotations

from pathlib import Path

import yaml

from ml.cluster_lab.io import file_hash

CONFIG = Path(__file__).resolve().parents[2] / 'configs' / 'experiments'


def value(metrics: dict, path: str):
    for part in path.split('.'):
        if not isinstance(metrics, dict) or part not in metrics:
            return None
        metrics = metrics[part]
    return metrics


def criteria(domain: str, folder: Path = CONFIG) -> tuple[list[dict], str]:
    path = folder / f'{domain}.yaml'
    spec = yaml.safe_load(path.read_text(encoding='utf-8'))
    if not spec.get('frozen_at'):
        raise ValueError(f'{path} has no frozen_at date: criteria must be fixed before the final evaluation')
    return spec['criteria'], file_hash(path)


def check(candidate: dict, champion: dict | None, rules: list[dict], rules_sha: str) -> dict:
    rows, failed = [], []
    for rule in rules:
        if 'any_of' in rule:
            # At least one of the alternatives must hold, e.g. "more stable or less dominated".
            inner = check(candidate, champion, [{**r, 'required': True} for r in rule['any_of']], rules_sha)
            ok = any(r['passed'] for r in inner['criteria'])
            rows.append({'name': rule['name'], 'any_of': inner['criteria'], 'passed': ok})
            if rule.get('required', True) and not ok:
                failed.append(rule['name'])
            continue
        metric, higher = rule['metric'], rule.get('direction', 'higher') == 'higher'
        mine = value(candidate['metrics'], metric)
        theirs = value(champion['metrics'], metric) if champion else None
        ok, note = None, ''
        if mine is None:
            ok, note = False, 'candidate lacks this metric'
        elif 'at_least' in rule:
            ok = mine >= rule['at_least']
        elif 'at_most' in rule:
            ok = mine <= rule['at_most']
        elif theirs is None:
            ok, note = (True, 'no champion value to compare') if champion is None else (False, 'champion lacks this metric')
        else:
            gain = (mine - theirs) if higher else (theirs - mine)
            if 'not_worse_than_champion' in rule:
                ok = gain >= -rule['not_worse_than_champion']
            else:
                ok = gain >= rule['better_than_champion']
        required = rule.get('required', True)
        rows.append({**rule, 'candidate': mine, 'champion': theirs, 'passed': bool(ok), 'note': note})
        if required and not ok:
            failed.append(rule.get('name', metric))
    return {'passed': not failed, 'failed': failed, 'criteria': rows, 'criteria_sha256': rules_sha,
            'champion_run_id': champion['run_id'] if champion else None}
