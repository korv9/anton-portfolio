"""Philosophy Lab clustering experiments (docs/cluster-experiments-philosophy.md).

    python -m ml.experiments.philosophy prepare|select|final|export [--deadline-minutes N]

- prepare: the observation table (one row per passage of silver.int_philosophy_passages, with its
  work, translator, original language and genre) and the work-level selection/evaluation split.
  It holds source text, so it stays under warehouse/ml/experiments/philosophy/ (registry.LOCAL).
- select, final: philosophy_runs.py. export: philosophy_export.py.

The champion's sample rule, stop list and distinctive-term method come from the published
pipeline (platform/nlp/philosophy/pipeline.py), loaded from its file so there is one definition.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

from ml.cluster_lab.io import atomic_json, atomic_parquet, digest, read_json
from . import embed as emb
from . import splits
from .registry import FEATURES, LOCAL
from .runtime import heavy, measure

REPO = Path(__file__).resolve().parents[2]
DATABASE = Path(os.environ.get('PORTFOLIO_DB', REPO / 'warehouse' / 'portfolio.duckdb'))
CORPUS_FILE = REPO / 'platform' / 'ingest' / 'philosophy' / 'corpus.json'
DATA = LOCAL / 'philosophy'
WORK = FEATURES / 'experiments' / 'philosophy'
DOMAIN = 'philosophy'
QUESTION = ('Which groups of passages recur across the works of a 13-work philosophy corpus, and how far '
            'do they follow the work, translator, original language or genre instead?')
CORPUS = ('13 public-domain works in English translation from Project Gutenberg '
          '(platform/ingest/philosophy/corpus.json), passages from silver.int_philosophy_passages')
TEXT_VERSION = 'philosophy-passages-v1'
SPLIT_SEED = 0
CONFOUNDERS = ('work', 'translator', 'original_language', 'genre')
# Pinned pretrained models. MiniLM is the published one; the two alternatives read English only,
# which this corpus is (every work is an English text or translation).
MODELS = {
    'minilm': {'model': 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
               'revision': 'e8f8c211226b894fcb81acc59f3b34ba3efd5f42', 'max_tokens': 128},
    'mpnet': {'model': 'sentence-transformers/all-mpnet-base-v2',
              'revision': 'e8c3b32edf5434bc2275fc9bab85f82640a19130', 'max_tokens': 384},
    'bge-small': {'model': 'BAAI/bge-small-en-v1.5',
                  'revision': '5c38ec7c405ec4b44b94cc5a9bb96e735b38267a', 'max_tokens': 512},
}
# Passage units. MiniLM reads at most 128 word pieces, about 95 words, and a median passage has
# about 140 words, so the published unit is cut off for most passages. `chunks80` embeds the whole
# passage as 80-word pieces and averages them; the observation (the passage) stays the same.
UNITS = {'passage': 'the whole passage as one input (truncated by the model)',
         'chunks80': 'mean of the passage\'s 80-word pieces, so the whole passage is read'}
CHUNK_WORDS = 80


@lru_cache(maxsize=1)
def platform_pipeline():
    """The published pipeline module (balanced_sample, ctfidf_terms, PER_DOCUMENT, HDBSCAN)."""
    path = REPO / 'platform' / 'nlp' / 'philosophy' / 'pipeline.py'
    spec = importlib.util.spec_from_file_location('philosophy_pipeline', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def translator_value(translator, language: str, document_id: str) -> str:
    """A named translator; an English original; or a translation whose file names nobody, which is
    kept apart per work (two unnamed translators are not known to be the same person)."""
    if isinstance(translator, str) and translator:
        return translator
    return 'original English' if language == 'en' else f'unnamed ({document_id})'


def observations(passages: pd.DataFrame, documents: list[dict]) -> pd.DataFrame:
    meta = {d['id']: d for d in documents}
    frame = passages.copy()
    frame['observation_id'] = frame['passage_id']
    frame['text_hash'] = [emb.text_hash(t, TEXT_VERSION) for t in frame['text']]
    frame['work'] = frame['document_id']
    frame['title'] = frame['document_id'].map(lambda d: meta[d]['title'])
    frame['original_language'] = frame['document_id'].map(lambda d: meta[d]['original_language'])
    frame['genre'] = frame['document_id'].map(lambda d: meta[d]['genre'])
    frame['translator_name'] = frame['document_id'].map(lambda d: meta[d].get('translator'))
    frame['translator'] = [translator_value(t, l, d) for t, l, d in
                           zip(frame['translator_name'], frame['original_language'], frame['document_id'])]
    return frame.sort_values(['document_id', 'position']).reset_index(drop=True)


def dataset_version(frame: pd.DataFrame) -> str:
    return digest(sorted(zip(frame['observation_id'], frame['text_hash'])))[:16]


def assign_sides(frame: pd.DataFrame, seed: int = SPLIT_SEED) -> tuple[pd.DataFrame, list[str]]:
    """Work-level split (split_groups: document_id in configs/experiments/philosophy.yaml)."""
    mask = splits.split(frame['document_id'], frame['text_hash'], 0.5, seed)
    frame = frame.assign(side=np.where(mask, 'selection', 'evaluation'))
    return frame, splits.check(mask, frame['document_id'], frame['text_hash'])


def prepare() -> dict:
    import duckdb

    con = duckdb.connect(str(DATABASE), read_only=True)
    passages = con.sql('select passage_id, document_id, position, author, tradition, translator as db_translator, '
                       'text from silver.int_philosophy_passages').df()
    con.close()
    documents = json.loads(CORPUS_FILE.read_text(encoding='utf-8'))['documents']
    frame, leaks = assign_sides(observations(passages, documents))
    if leaks:
        raise RuntimeError(f'split leaks: {leaks}')
    sample = sampled(frame)
    summary = {'dataset_version': dataset_version(frame), 'text_version': TEXT_VERSION, 'split_seed': SPLIT_SEED,
               'split_groups': ['document_id'], 'leaks': leaks, 'observations': int(len(frame)), 'sides': {}}
    for side in ('selection', 'evaluation'):
        part, s = frame[frame.side == side], sample[sample.side == side]
        summary['sides'][side] = {
            'observations': int(len(part)), 'sampled': int(len(s)), 'works': sorted(part.document_id.unique()),
            **{f'{c}_values': sorted(part[c].unique()) for c in ('translator', 'original_language', 'genre')}}
    DATA.mkdir(parents=True, exist_ok=True)
    atomic_parquet(frame.drop(columns=['db_translator']), DATA / 'observations.parquet')
    atomic_json(DATA / 'dataset.json', summary)
    atomic_json(WORK / 'dataset.json', summary)  # ids and sizes only, no text
    return summary


def load() -> tuple[pd.DataFrame, dict]:
    if not (DATA / 'observations.parquet').exists():
        prepare()
    return pd.read_parquet(DATA / 'observations.parquet'), read_json(DATA / 'dataset.json')


def sampled(frame: pd.DataFrame, side: str | None = None) -> pd.DataFrame:
    """The published sample rule (at most PER_DOCUMENT passages per work, evenly spaced)."""
    p = platform_pipeline()
    out = p.balanced_sample(frame, p.PER_DOCUMENT)
    return (out if side is None else out[out.side == side]).reset_index(drop=True)


def chunks(text: str, size: int = CHUNK_WORDS) -> list[str]:
    words = text.split()
    return [' '.join(words[i:i + size]) for i in range(0, len(words), size)] or ['']


def vectors(frame: pd.DataFrame, model_key: str, unit: str = 'passage') -> tuple[np.ndarray, dict]:
    """Embeddings in frame order through the shared cache, under the heavy lock."""
    spec = MODELS[model_key]
    with heavy(wait_seconds=3600), measure(WORK) as used:
        if unit == 'passage':
            out = emb.embed(frame['text'].tolist(), frame['text_hash'].tolist(), spec['model'], spec['revision'],
                            TEXT_VERSION, batch=512)
        elif unit == 'chunks80':
            pieces = [chunks(t) for t in frame['text']]
            flat = [c for p in pieces for c in p]
            version = f'{TEXT_VERSION}-chunk{CHUNK_WORDS}'
            flat_v = emb.embed(flat, [emb.text_hash(c, version) for c in flat], spec['model'], spec['revision'],
                               version, batch=512)
            ends = np.cumsum([len(p) for p in pieces])
            out = np.stack([flat_v[e - len(p):e].mean(axis=0) for p, e in zip(pieces, ends)])
        else:
            raise ValueError(f'unknown unit {unit}')
    return out.astype(np.float32), used


def confounders(frame: pd.DataFrame) -> dict:
    return {c: frame[c].to_numpy() for c in CONFOUNDERS}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog='python -m ml.experiments.philosophy')
    parser.add_argument('step', choices=('prepare', 'select', 'final', 'export'))
    parser.add_argument('--deadline-minutes', type=float, default=None)
    args = parser.parse_args(argv)
    if args.step == 'prepare':
        print(json.dumps(prepare(), indent=1, ensure_ascii=False))
        return 0
    if args.step == 'export':
        from .philosophy_export import export
        export()
        return 0
    from . import philosophy_runs
    getattr(philosophy_runs, args.step)(args.deadline_minutes)
    return 0


if __name__ == '__main__':
    sys.exit(main())
