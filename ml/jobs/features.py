"""Auditable text cleanup and normalised multi-view feature fusion, without metadata labels."""
from __future__ import annotations

from collections import Counter
from html import unescape
from html.parser import HTMLParser
import hashlib
import json
import re

import numpy as np
import pandas as pd

from .embeddings import embed, DEFAULT_MODEL, REPRESENTATION
from .prepare import normalise, semantic_text, text_hash
from .sweep import cached_embeddings

FEATURE_VERSION = 'technical-multiview-v1'
RECIPES = {
    'baseline': {'raw': 1.},
    'clean': {'clean': 1.},
    'clean-title': {'clean': .8, 'title': .2},
    'clean-skills': {'clean': .75, 'skills': .25},
    'balanced': {'clean': .65, 'title': .15, 'skills': .2},
    'technical': {'clean': .5, 'title': .15, 'skills': .35},
    'raw-skills': {'raw': .7, 'skills': .3},
    'lexical': {'clean': .5, 'lexical': .2, 'title': .1, 'skills': .2},
}
TOKEN_PATTERN = r'(?u)(?:\.\w+|\w[\w+#.-]*)'
MARKETING = re.compile(r'(?:friskvårdsbidrag|tjänstepension|wellness allowance|apply (?:now|today)|'
                       r'välkommen (?:med|att skicka) din ansökan|skicka din ansökan|sista ansökningsdag)', re.I)
CONTACT = re.compile(r'https?://\S+|[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}')


class TextOnly(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in ('p', 'br', 'li', 'div', 'h1', 'h2', 'h3'):
            self.parts.append('\n')

    def handle_endtag(self, tag):
        if tag in ('p', 'li', 'div'):
            self.parts.append('\n')

    def handle_data(self, data):
        self.parts.append(data)


def segments(description):
    text = unescape(str(description or ''))
    if re.search(r'</?(?:p|div|br|li)\b', text, re.I):
        parser = TextOnly()
        parser.feed(text)
        text = ''.join(parser.parts)
    return [normalise(s) for s in re.split(r'(?<=[.!?])\s+|[\r\n]+', text) if normalise(s)]


def clean_descriptions(jobs):
    vocabulary = sorted({s for values in jobs.skills for s in values})
    technical = re.compile(r'(?<!\w)(?:' + '|'.join(map(re.escape, vocabulary)) + r')(?!\w)', re.I) if vocabulary else None
    pieces = [segments(d) for d in jobs.description]
    unique = jobs.drop_duplicates('text_hash')
    counts = Counter(s.casefold() for d in unique.description for s in set(segments(d)))
    threshold = max(8, int(np.ceil(len(unique) * .005)))
    cleaned, audit = [], []
    for row, parts in zip(jobs.itertuples(), pieces):
        kept, removed = [], []
        for part in parts:
            has_technology = technical is not None and technical.search(part) is not None
            repeated = counts[part.casefold()] >= threshold and len(part.split()) >= 6
            if not has_technology and (repeated or MARKETING.search(part)):
                removed.append(part)
            else:
                kept.append(normalise(CONTACT.sub(' ', part)))
        # Never turn an ad into an empty text or silently drop it from the corpus.
        text = '\n'.join(s for s in kept if s) or normalise(row.description)
        cleaned.append(text)
        audit.append({'job_id': row.job_id, 'original_characters': len(str(row.description)),
                      'clean_characters': len(text), 'removed_segments': removed})
    removed_counts = Counter(s for row in audit for s in row['removed_segments'])
    report = {'version': FEATURE_VERSION, 'repeated_segment_threshold': threshold,
              'document_frequency_unit': 'distinct original text hashes',
              'original_characters': sum(a['original_characters'] for a in audit),
              'clean_characters': sum(a['clean_characters'] for a in audit),
              'ads_with_removed_segments': sum(bool(a['removed_segments']) for a in audit),
              'top_removed_segments': [{'text': s, 'ads': n} for s, n in removed_counts.most_common(30)],
              'skill_missing_share': float(jobs.skills.map(len).eq(0).mean())}
    return cleaned, audit, report


def fuse(blocks, weights):
    from sklearn.preprocessing import normalize
    if not weights or any(w <= 0 for w in weights.values()) or not np.isclose(sum(weights.values()), 1.):
        raise ValueError('Feature weights must be positive and sum to one')
    parts = [normalize(np.asarray(blocks[key], dtype='float32')) * np.sqrt(weight)
             for key, weight in weights.items()]
    matrix = normalize(np.concatenate(parts, axis=1)).astype('float32')
    if not np.isfinite(matrix).all() or (np.linalg.norm(matrix, axis=1) < .99).any():
        raise ValueError('Invalid fused features')
    return matrix


def tfidf_svd(texts, dimensions, seed=42):
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.decomposition import TruncatedSVD
    from sklearn.preprocessing import normalize
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), token_pattern=TOKEN_PATTERN,
                                 min_df=2, max_df=.9, sublinear_tf=True, max_features=20000)
    sparse = vectorizer.fit_transform(texts)
    dimensions = min(dimensions, sparse.shape[1] - 1, sparse.shape[0] - 1)
    if dimensions < 2:
        return normalize(sparse).toarray().astype('float32'), {'vocabulary_size': sparse.shape[1], 'dimensions': sparse.shape[1]}
    fitted = TruncatedSVD(n_components=dimensions, random_state=seed)
    matrix = normalize(fitted.fit_transform(sparse)).astype('float32')
    return matrix, {'vocabulary_size': sparse.shape[1], 'dimensions': dimensions,
                    'explained_variance': float(fitted.explained_variance_ratio_.sum())}


def feature_identity(jobs, revision):
    import importlib.metadata
    from pathlib import Path
    versions = {p: importlib.metadata.version(p) for p in ('numpy', 'scikit-learn', 'sentence-transformers')}
    body = '\n'.join(jobs.job_id + ':' + jobs.text_hash) + json.dumps(jobs.skills.tolist(), ensure_ascii=False)
    implementation = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    return hashlib.sha256((body + DEFAULT_MODEL + revision + REPRESENTATION + FEATURE_VERSION
                           + implementation + json.dumps(versions, sort_keys=True)).encode()).hexdigest()[:16]


def build_blocks(jobs, directory, revision):
    from sklearn.feature_extraction.text import TfidfTransformer
    from sklearn.preprocessing import MultiLabelBinarizer

    folder = directory / 'features' / feature_identity(jobs, revision)
    target = folder / 'blocks.npz'
    if target.exists():
        loaded = np.load(target)
        return {k: loaded[k] for k in loaded.files}, json.loads((folder / 'report.json').read_text(encoding='utf-8')), folder
    folder.mkdir(parents=True, exist_ok=True)
    raw = cached_embeddings(jobs, directory, DEFAULT_MODEL, revision)
    clean, audit, report = clean_descriptions(jobs)
    pd.DataFrame(audit).to_parquet(folder / 'cleaning-audit.parquet', index=False)
    print(f'Cleanup: {report["ads_with_removed_segments"]} ads affected; '
          f'{1-report["clean_characters"]/report["original_characters"]:.1%} characters removed; '
          f'{report["skill_missing_share"]:.1%} ads have no detected skills', flush=True)
    clean_jobs = jobs[['job_id']].assign(text=[semantic_text(r.title, d, r.skills) for r, d in zip(jobs.itertuples(), clean)])
    clean_jobs['text_hash'] = clean_jobs.text.map(lambda t: text_hash(FEATURE_VERSION + ':clean\n' + t))
    clean_vectors, cache = embed(clean_jobs, directory, DEFAULT_MODEL, revision)
    # Titles use an independent lexical model. All available descriptions enter the
    # cleaned semantic encoder; titles are not substitutes for role metadata labels.
    titles, title_info = tfidf_svd(jobs.title, 48)
    lexical, lexical_info = tfidf_svd(clean, 128)
    encoder = MultiLabelBinarizer(sparse_output=True)
    skills = TfidfTransformer().fit_transform(encoder.fit_transform(jobs.skills)).toarray().astype('float32')
    blocks = {'raw': raw, 'clean': clean_vectors, 'title': titles, 'skills': skills, 'lexical': lexical}
    report.update({'feature_id': folder.name, 'model': DEFAULT_MODEL, 'revision': revision,
                   'title': title_info, 'lexical': lexical_info, 'skill_vocabulary': encoder.classes_.tolist(),
                   'block_dimensions': {k: v.shape[1] for k, v in blocks.items()}, 'clean_embedding_cache': cache,
                   'recipes': RECIPES})
    (folder / 'report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False), encoding='utf-8')
    np.savez_compressed(target, **blocks)
    print(f'Feature blocks saved: {folder}', flush=True)
    return blocks, report, folder
