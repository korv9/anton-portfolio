"""Model registry per domain: every run with its status, and an append-only history of decisions.

A domain has at most one champion. `promote` makes a candidate champion only when its acceptance
report passed; the previous champion becomes `retired` in the history and stays loadable, so
`rollback` can restore it. Rejected runs stay listed: negative results are results.

The registry is a JSON file under `warehouse/features/experiments/registry/<domain>/registry.json`,
written atomically and guarded by an OS lock so two writers cannot interleave. It sits in the
features tree, so `warehouse_store.py push --only features --path experiments` keeps it in R2; it
holds ids, parameters and measures, never source text.
"""
from __future__ import annotations

from contextlib import contextmanager
import json
import os
from pathlib import Path

from ml.cluster_lab.io import atomic_json, now
from .contract import STATUSES, validate

FEATURES = Path(os.environ.get('PORTFOLIO_FEATURES') or Path(__file__).resolve().parents[2] / 'warehouse' / 'features')
# A reproduction (EXPERIMENTS_REPRO=<label>) refits from scratch under experiments/repro/<label>:
# its own registry, checkpoints, embeddings, summaries and exports. Stored results stay untouched.
REPRO = os.environ.get('EXPERIMENTS_REPRO', '').strip()
EXPERIMENTS = FEATURES / 'experiments' / 'repro' / REPRO if REPRO else FEATURES / 'experiments'
ROOT = Path(os.environ.get('PORTFOLIO_EXPERIMENTS') or EXPERIMENTS / 'registry')
# Prepared datasets hold source text and stay local (docs/incidents/2026-10-22-third-party-text-in-r2.md).
LOCAL = Path(__file__).resolve().parents[2] / 'warehouse' / 'ml' / 'experiments'


@contextmanager
def lock(path: Path):
    """Exclusive, non-blocking OS lock on `path`; raises when another process holds it."""
    path.parent.mkdir(parents=True, exist_ok=True)
    stream = path.open('a+b')
    if stream.tell() == 0:
        stream.write(b'0')
        stream.flush()
    stream.seek(0)
    try:
        if os.name == 'nt':
            import msvcrt
            msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError as error:
        stream.close()
        raise RuntimeError(f'{path} is held by another process') from error
    try:
        yield
    finally:
        stream.close()


class Registry:
    def __init__(self, domain: str, root: Path | None = None):
        self.domain = domain
        self.folder = Path(root or ROOT) / domain
        self.path = self.folder / 'registry.json'

    def load(self) -> dict:
        if not self.path.exists():
            return {'domain': self.domain, 'runs': {}, 'history': []}
        return json.loads(self.path.read_text(encoding='utf-8'))

    def _write(self, state: dict) -> None:
        champions = [r for r, e in state['runs'].items() if e['status'] == 'champion']
        if len(champions) > 1:
            raise ValueError(f'{self.domain} would have {len(champions)} champions')
        atomic_json(self.path, state)

    @contextmanager
    def edit(self):
        with lock(self.folder / 'registry.lock'):
            state = self.load()
            yield state
            self._write(state)

    def register(self, run: dict, status: str = 'candidate', reason: str = '') -> dict:
        """Add a validated run. An existing entry keeps its status (ids are content hashes)."""
        problems = validate(run)
        if problems:
            raise ValueError(f"run {run.get('run_id')} is invalid: {'; '.join(problems)}")
        if status not in STATUSES:
            raise ValueError(f'unknown status {status}')
        with self.edit() as state:
            if run['domain'] != self.domain:
                raise ValueError(f"run is for {run['domain']}, registry is {self.domain}")
            if run['run_id'] in state['runs']:
                return state['runs'][run['run_id']]
            if status == 'champion' and any(e['status'] == 'champion' for e in state['runs'].values()):
                raise ValueError('use promote to replace a champion')
            entry = {'status': status, 'run': run, 'registered_at': now()}
            state['runs'][run['run_id']] = entry
            state['history'].append({'at': now(), 'run_id': run['run_id'], 'action': f'register:{status}',
                                     'reason': reason})
            return entry

    def champion(self) -> dict | None:
        return next((e['run'] for e in self.load()['runs'].values() if e['status'] == 'champion'), None)

    def decide(self, run_id: str, report: dict) -> str:
        """Record an acceptance report: a failed one rejects the candidate, a passed one leaves it
        a candidate for `promote`. The report is kept on the entry either way."""
        with self.edit() as state:
            entry = state['runs'][run_id]
            if entry['status'] != 'candidate':
                raise ValueError(f"{run_id} is {entry['status']}, not a candidate")
            entry['acceptance'] = report
            if not report['passed']:
                entry['status'] = 'rejected'
            state['history'].append({'at': now(), 'run_id': run_id,
                                     'action': 'accept' if report['passed'] else 'reject',
                                     'reason': '; '.join(report.get('failed', [])) or 'all criteria met'})
            return entry['status']

    def promote(self, run_id: str, reason: str) -> None:
        with self.edit() as state:
            entry = state['runs'][run_id]
            if entry['status'] != 'candidate' or not entry.get('acceptance', {}).get('passed'):
                raise ValueError(f'{run_id} has no passed acceptance report')
            for other, e in state['runs'].items():
                if e['status'] == 'champion':
                    e['status'] = 'candidate'
                    e['retired_at'] = now()
                    state['history'].append({'at': now(), 'run_id': other, 'action': 'retire', 'reason': reason})
            entry['status'] = 'champion'
            state['history'].append({'at': now(), 'run_id': run_id, 'action': 'promote', 'reason': reason})

    def reinstate(self, invalid: str, original: str, reason: str) -> None:
        """Withdraw a champion whose inputs proved invalid and reinstate the original champion
        pipeline refitted on corrected inputs. This is not a promotion on the criteria: the
        reinstated run is the domain's existing pipeline, and the history records why."""
        with self.edit() as state:
            if state['runs'][invalid]['status'] != 'champion':
                raise ValueError(f'{invalid} is not the champion')
            state['runs'][invalid]['status'] = 'rejected'
            state['history'].append({'at': now(), 'run_id': invalid, 'action': 'withdraw', 'reason': reason})
            state['runs'][original]['status'] = 'champion'
            state['history'].append({'at': now(), 'run_id': original, 'action': 'reinstate', 'reason': reason})

    def rollback(self, reason: str, demote_to: str = 'rejected') -> str:
        """Restore the champion before the current one. Returns the restored run id.

        The current champion becomes `demote_to`: 'rejected' when it is broken, 'candidate' when
        it was promoted by mistake and its passed acceptance report still stands."""
        if demote_to not in ('rejected', 'candidate'):
            raise ValueError(f'cannot demote to {demote_to}')
        with self.edit() as state:
            promotions = [h['run_id'] for h in state['history']
                          if h['action'] in ('promote', 'register:champion', 'rollback', 'reinstate')]
            current = next((r for r, e in state['runs'].items() if e['status'] == 'champion'), None)
            # A rejected run (an invalid input, a failed check) is never brought back.
            previous = next((r for r in reversed(promotions)
                             if r != current and state['runs'][r]['status'] != 'rejected'), None)
            if previous is None:
                raise ValueError('no earlier champion to restore')
            if current:
                state['runs'][current]['status'] = demote_to
                state['history'].append({'at': now(), 'run_id': current, 'action': 'demote', 'reason': reason})
            state['runs'][previous]['status'] = 'champion'
            state['history'].append({'at': now(), 'run_id': previous, 'action': 'rollback', 'reason': reason})
            return previous
