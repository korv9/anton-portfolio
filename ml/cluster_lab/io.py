from __future__ import annotations

import hashlib
import importlib.metadata
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
        allow_nan=False, default=str).encode()).hexdigest()


def file_hash(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + f'.{os.getpid()}.tmp')
    with temporary.open('w', encoding='utf-8') as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False, allow_nan=False, default=str)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)


def atomic_parquet(frame, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.tmp')
    frame.to_parquet(temporary, index=False, compression='zstd')
    os.replace(temporary, path)


def versions():
    result = {}
    for package in ['numpy', 'pandas', 'pyarrow', 'duckdb', 'scikit-learn', 'umap-learn',
                    'hdbscan', 'sentence-transformers', 'torch', 'transformers', 'PyYAML', 'matplotlib', 'psutil']:
        try:
            result[package] = importlib.metadata.version(package)
        except importlib.metadata.PackageNotFoundError:
            result[package] = None
    return result


def provenance():
    def git(*args):
        return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()
    paths = sorted(set([*ROOT.glob('ml/cluster_lab/**/*.py'), *ROOT.glob('ml/jobs/*.py'),
                       *ROOT.glob('platform/nlp/symbolic/*.py'),
                       *ROOT.glob('platform/ingest/jobtech/*.py')]))
    return {'commit': git('rev-parse', 'HEAD'), 'branch': git('branch', '--show-current'),
            'worktree_status': git('status', '--short'),
            'dirty_diff_sha256': hashlib.sha256(subprocess.check_output(['git', 'diff'], cwd=ROOT)).hexdigest(),
            'implementation_hashes': {str(p.relative_to(ROOT)): file_hash(p) for p in paths},
            'packages': versions()}
