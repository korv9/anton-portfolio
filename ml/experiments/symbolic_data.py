"""Symbol Lab observations: the champion's sample, its duplicates, text variants and the split.

The sample is the published one (platform/nlp/symbolic/pipeline.py): at most 15 occurrences per
book and symbol, lowest occurrence ids, leaving out passages silver marks as reprints
(duplicate_of). The prepared table holds source text, so it stays under registry.LOCAL.

Text variants, each its own embedding cache (text version):
- context: previous + matching + next sentence, as published;
- sentence: the matching sentence only;
- masked: the context with the matched alias replaced by [SYMBOL] (transforms.mask_symbol).
A cleaning variant was not added: `boilerplate` finds no residual Gutenberg text, illustration tags
or encoding loss in the sample (docs/cluster-experiments-symbolic.md).
"""
from __future__ import annotations

import hashlib
import importlib.util
import re
from pathlib import Path

import numpy as np
import pandas as pd

from . import splits
from .registry import LOCAL

ROOT = Path(__file__).resolve().parents[2]
DATABASE = ROOT / 'warehouse' / 'portfolio.duckdb'
FOLDER = LOCAL / 'symbolic'
OBSERVATIONS = FOLDER / 'observations.parquet'
PER_PAIR = 15
SPLIT_SEED = 0
NEAR = 0.95  # cosine at or above which two contexts count as near-identical
VARIANTS = {'context': 'symbolic-context-v1', 'sentence': 'symbolic-sentence-v1',
            'masked': 'symbolic-masked-v1'}
BOILERPLATE = {'replacement_char': '�', 'gutenberg': r'(?i)gutenberg', 'illustration': r'(?i)\[illustration',
               'footnote_mark': r'\[\d+\]', 'chapter_heading': r'\bCHAPTER\b', 'underscore_italics': r'_\w'}


def _transforms():
    spec = importlib.util.spec_from_file_location(
        'symbolic_transforms', ROOT / 'platform' / 'nlp' / 'symbolic' / 'transforms.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


mask_symbol = _transforms().mask_symbol


def normalised_hash(text: str) -> str:
    """Hash of the text lower-cased with only letters and digits kept: reprints that differ in
    punctuation, spacing or encoding loss get the same hash."""
    return hashlib.sha256(re.sub(r'[\W_]+', ' ', text.lower()).strip().encode()).hexdigest()


def text_of(frame: pd.DataFrame, variant: str) -> list[str]:
    if variant == 'context':
        return frame.context.tolist()
    if variant == 'sentence':
        return frame.sentence.tolist()
    if variant == 'masked':
        return [mask_symbol(c, t) for c, t in zip(frame.context, frame.matched_term)]
    raise ValueError(f'unknown text variant {variant}')


def load(database: Path = DATABASE, per_pair: int = PER_PAIR) -> pd.DataFrame:
    import duckdb

    con = duckdb.connect(str(database), read_only=True)
    try:
        frame = con.execute(
            'select o.occurrence_id, o.context, o.sentence, o.matched_term, o.document_id, o.tradition, '
            'o.symbol_id, d.title, d.author from silver.int_symbol_occurrences o '
            'left join gold.dim_symbolic_document d using (document_id) where o.duplicate_of is null '
            'qualify row_number() over (partition by o.document_id, o.symbol_id order by o.occurrence_id) <= ? '
            'order by o.occurrence_id', [per_pair]).df()
        silver = con.execute('select count(*), count(duplicate_of) from silver.int_symbol_occurrences').fetchone()
    finally:
        con.close()
    frame.attrs['silver'] = {'occurrences': int(silver[0]), 'duplicate_of_marked': int(silver[1])}
    return frame


def with_hashes(frame: pd.DataFrame) -> pd.DataFrame:
    from .embed import text_hash

    frame = frame.copy()
    frame['text_hash'] = [text_hash(c, VARIANTS['context']) for c in frame.context]
    frame['norm_hash'] = [normalised_hash(c) for c in frame.context]
    return frame


def duplicates(frame: pd.DataFrame) -> dict:
    """Identical and normalised-identical contexts in the sample, and how many span books."""
    out = {}
    for key in ('text_hash', 'norm_hash'):
        books = frame.groupby(key).document_id.nunique()
        sizes = frame.groupby(key).size()
        out[key] = {'groups_with_repeats': int((sizes > 1).sum()),
                    'rows_in_repeats': int(sizes[sizes > 1].sum()),
                    'groups_across_books': int((books > 1).sum()),
                    'rows_across_books': int(frame[key].isin(books[books > 1].index).sum())}
    return out


def near_pairs(vectors: np.ndarray, books: np.ndarray, threshold: float = NEAR, chunk: int = 2048) -> np.ndarray:
    """Pairs (i, j), i < j, from different books whose cosine is at least `threshold`."""
    books = np.asarray(books).astype(str)
    found = []
    for start in range(0, len(vectors), chunk):
        sims = vectors[start:start + chunk] @ vectors.T
        rows, cols = np.nonzero(sims >= threshold)
        rows = rows + start
        keep = (cols > rows) & (books[rows] != books[cols])
        found.append(np.stack([rows[keep], cols[keep]], axis=1))
    return np.concatenate(found) if found else np.zeros((0, 2), dtype=int)


def boilerplate(frame: pd.DataFrame) -> dict:
    """Contexts that still carry source markup or encoding loss after cleaning, and how
    concentrated each kind is in a few books (book-specific residue a model could cluster on)."""
    out = {}
    for name, pattern in BOILERPLATE.items():
        hit = frame.context.str.contains(pattern, regex=name != 'replacement_char')
        per_book = frame[hit].document_id.value_counts()
        out[name] = {'contexts': int(hit.sum()), 'share': round(float(hit.mean()), 4),
                     'books': int(len(per_book)),
                     'top_book_share_of_hits': round(float(per_book.iloc[0] / hit.sum()), 3) if hit.any() else None}
    return out


def link_keys(norm_hashes: np.ndarray, near: np.ndarray | None) -> np.ndarray:
    """The normalised hash, replaced by one shared key inside each near-identical component."""
    keys = np.asarray(norm_hashes).astype(object).copy()
    if near is None or not len(near):
        return keys
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components

    n = len(keys)
    graph = coo_matrix((np.ones(len(near)), (near[:, 0], near[:, 1])), shape=(n, n))
    _, label = connected_components(graph, directed=False)
    linked = np.zeros(n, dtype=bool)
    linked[near.ravel()] = True
    keys[linked] = [f'near:{c}' for c in label[linked]]
    return keys


def split_side(frame: pd.DataFrame, near: np.ndarray | None = None, seed: int = SPLIT_SEED) -> tuple[np.ndarray, dict]:
    """Selection mask by book (configs/experiments/symbolic.yaml split_groups: document_id).
    Text identity uses the normalised hash, so a reprint with different punctuation also stays on
    one side, and near-identical pairs across books share one link key, so they do too."""
    link = link_keys(frame.norm_hash.to_numpy(), near)
    mask = splits.split(frame.document_id, link, 0.5, seed=seed)
    leaks = splits.check(mask, frame.document_id, frame.text_hash)
    leaks += splits.check(mask, frame.document_id, frame.norm_hash)
    report = {'selection': int(mask.sum()), 'evaluation': int((~mask).sum()),
              'selection_books': int(frame.document_id[mask].nunique()),
              'evaluation_books': int(frame.document_id[~mask].nunique()), 'leaks': sorted(set(leaks))}
    if near is not None and len(near):
        report['near_identical_pairs_across_sides'] = int((mask[near[:, 0]] != mask[near[:, 1]]).sum())
    return mask, report


def version(frame: pd.DataFrame) -> str:
    """Dataset version: hash of the observation ids and their text hashes."""
    h = hashlib.sha256()
    for i, t in sorted(zip(frame.occurrence_id, frame.text_hash)):
        h.update(f'{i}\t{t}\n'.encode())
    return h.hexdigest()[:16]
