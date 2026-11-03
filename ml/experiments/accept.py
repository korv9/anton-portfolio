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
  {common_gain: party}                                 less aligned with this field than the champion,
                                                       on commonly assigned rows, by more than the seed spread

A point estimate from one seed cannot say a gain is real, and noise-free K-means and HDBSCAN are
not scored on the same rows unless they are made to be, so `common_gain` reads `common_rows`, passed
as `common` to `check`. Amended 2026-11-01 for future decisions (docs/ml-gate-amendments.md).
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import yaml
from sklearn.metrics import adjusted_mutual_info_score

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
    if not spec.get('criteria'):
        raise ValueError(f'{path} lists no criteria: an empty rule set would pass every candidate')
    return spec['criteria'], file_hash(path)


def common_rows(candidate: list[np.ndarray], champion: list[np.ndarray], fields: dict) -> dict:
    """Per field and seed, AMI of both labelings on the rows both assign. Gain is the fall in AMI
    from champion to candidate; spread is the largest per-seed gain minus the smallest."""
    if len(candidate) != len(champion) or len(candidate) < 2:
        raise ValueError('common_rows needs two or more paired labelings')
    out = {}
    for name, field in fields.items():
        field, gains, shares = np.asarray(field).astype(str), [], []
        for mine, theirs in zip(candidate, champion):
            both = (mine >= 0) & (theirs >= 0)
            shares.append(float(both.mean()))
            gains.append(float(adjusted_mutual_info_score(theirs[both], field[both])
                               - adjusted_mutual_info_score(mine[both], field[both])))
        out[name] = {'gain': float(np.mean(gains)), 'spread': float(max(gains) - min(gains)),
                     'per_seed': gains, 'common_share': float(np.mean(shares))}
    return out


def margin(report: dict) -> float | None:
    """Gain minus spread of a report's common_gain rows; the smallest if there are several."""
    margins = [r['gain'] - r['spread'] for r in report['criteria'] if 'common_gain' in r and 'gain' in r]
    return min(margins) if margins else None


def pick(reports: dict[str, dict]) -> str | None:
    """The passed candidate with the largest margin. In dict order only when margins tie or are absent."""
    passed = [k for k, r in reports.items() if r['passed']]
    return max(passed, key=lambda k: margin(reports[k]) if margin(reports[k]) is not None else float('-inf'),
               default=None)


def check(candidate: dict, champion: dict | None, rules: list[dict], rules_sha: str,
          common: dict | None = None) -> dict:
    rows, failed = [], []
    for rule in rules:
        if 'common_gain' in rule:
            scored = (common or {}).get(rule['common_gain'])
            ok = bool(scored and scored['gain'] > scored['spread'])
            rows.append({**rule, **(scored or {'note': 'no common-row comparison'}), 'passed': ok})
            if rule.get('required', True) and not ok:
                failed.append(rule.get('name', rule['common_gain']))
            continue
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
        if mine is None or not np.isfinite(mine):
            ok, note = False, 'candidate lacks this metric or it is not finite'
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
