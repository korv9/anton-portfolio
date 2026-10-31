"""Build the atlas: six corpora in one space, clustered, with links between corpora.

    python -m ml.atlas.build embed      # load and embed every corpus (cache hits are free)
    python -m ml.atlas.build analyse    # centre, check, cluster, link; writes the public files

Nothing here is supervised: corpus, party, tradition and the rest are never inputs. They are
used afterwards to read the result, and to measure how much the centring removed.
"""
from __future__ import annotations

import argparse
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, TfidfVectorizer

from . import corpora, links, space

WORK = corpora.ROOT / 'warehouse/features/atlas'
OUT = corpora.PUBLIC / 'atlas'
MIN_CLUSTER, MIN_SAMPLES = 150, 15
MIXED_SHARE = 0.2   # a cluster is mixed when at least two corpora each hold this share
EXAMPLE_CHARS = 220
PAIRS = [('debates', 'philosophy'), ('debates', 'symbols'), ('debates', 'laws'),
         ('philosophy', 'symbols'), ('jobs', 'laws'), ('jobs', 'ai_act'), ('ai_act', 'laws'),
         ('debates', 'jobs')]
SWEDISH = set('''och att det som en på är av för med till den har inte om ett de jag vi så men
kan ska från eller vid också detta denna dessa när där här nu vara var har hade sig sin sina sitt
man mot efter under över bara alla andra eftersom även utan mycket då skall får måste kommer blir
varit vilket vilka genom inom samt enligt ni han hon dem oss vår våra vårt deras era hur vad'''.split())


def embed() -> None:
    started = time.time()
    frame, vectors = corpora.load_all()
    WORK.mkdir(parents=True, exist_ok=True)
    frame.to_parquet(WORK / 'passages.parquet', index=False)
    np.save(WORK / 'vectors.npy', vectors)
    print(f'{len(frame):,} passages, {time.time() - started:.0f} s')


def terms(frame: pd.DataFrame, labels: np.ndarray, top: int = 8) -> dict[int, list[str]]:
    """Distinctive words per cluster (class-based TF-IDF). Generated, not reviewed."""
    ids = sorted(set(labels) - {-1})
    documents = [' '.join(frame.text[labels == c].tolist()) for c in ids]
    vectoriser = TfidfVectorizer(token_pattern=r'(?u)\b[^\W\d_]{4,}\b', lowercase=True, min_df=2,
                                 max_df=0.5, stop_words=sorted(ENGLISH_STOP_WORDS | SWEDISH),
                                 sublinear_tf=True)
    matrix = vectoriser.fit_transform(documents)
    vocabulary = vectoriser.get_feature_names_out()
    return {c: [str(vocabulary[j]) for j in matrix[i].toarray()[0].argsort()[::-1][:top]]
            for i, c in enumerate(ids)}


def example(row) -> dict:
    text = '' if row.corpus == 'jobs' else re.sub(r'\s+', ' ', row.text)[:EXAMPLE_CHARS]
    return {'corpus': row.corpus, 'label': row.label, 'text': text}


def clusters(frame: pd.DataFrame, labels: np.ndarray, centred: np.ndarray) -> list[dict]:
    words = terms(frame, labels)
    out = []
    for c in sorted(set(labels) - {-1}):
        rows = np.flatnonzero(labels == c)
        shares = frame.corpus[rows].value_counts(normalize=True).round(4).to_dict()
        centroid = space.normalise(centred[rows].mean(axis=0, keepdims=True))[0]
        nearest = rows[np.argsort(-(centred[rows] @ centroid))]
        picked, seen = [], set()
        for r in nearest:   # the passage nearest the centre from each corpus present
            if frame.corpus[r] not in seen and shares.get(frame.corpus[r], 0) >= 0.05:
                seen.add(frame.corpus[r])
                picked.append(example(frame.loc[r]))
        out.append({'id': int(c), 'size': int(len(rows)), 'shares': shares,
                    'mixed': sum(s >= MIXED_SHARE for s in shares.values()) >= 2,
                    'groups': frame.group[rows].value_counts().head(5).to_dict(),
                    'terms': words[c], 'examples': picked})
    return out


def write(name: str, payload) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')


def analyse() -> None:
    started = time.time()
    frame = pd.read_parquet(WORK / 'passages.parquet')
    vectors = space.normalise(np.load(WORK / 'vectors.npy'))
    centred = space.centre(frame, vectors)
    aligned = space.whiten(frame, vectors)
    checks = {name: {'purity': space.purity(frame, s), 'translation': space.translation_match(frame, s)}
              for name, s in (('raw', vectors), ('centred', centred), ('whitened', aligned))}
    print(json.dumps(checks), flush=True)
    cache = WORK / f'clusters-{MIN_CLUSTER}-{MIN_SAMPLES}-{space.SHRINK}.npz'
    if cache.exists():
        saved = np.load(cache)
        labels, flat = saved['labels'], saved['flat']
    else:
        labels, flat = space.cluster(aligned, MIN_CLUSTER, MIN_SAMPLES)
        np.savez(cache, labels=labels, flat=flat)
    print(f'clustered, {time.time() - started:.0f} s', flush=True)
    found = clusters(frame, labels, aligned)
    pairs = []
    for a, b in PAIRS:
        rows = links.affinity(frame, aligned, a, b)
        pairs.append({'from': a, 'to': b, 'links': links.strongest(rows), 'all': len(rows)})
        print(f'  {a} -> {b}: {len(pairs[-1]["links"])} clear links of {len(rows)}', flush=True)
    names = sorted(frame.corpus.unique())
    lo, hi = flat.min(axis=0), flat.max(axis=0)
    xy = np.round((flat - lo) / (hi - lo) * 1000).astype(int)
    write('points.json', {'corpora': names, 'x': xy[:, 0].tolist(), 'y': xy[:, 1].tolist(),
                          'corpus': [names.index(c) for c in frame.corpus], 'cluster': labels.tolist()})
    write('clusters.json', found)
    write('links.json', pairs)
    write('meta.json', {
        'generated_at': datetime.now(timezone.utc).isoformat(timespec='minutes'),
        'model': f'{corpora.MODEL}@{corpora.REVISION[:12]}', 'passages': len(frame),
        'alignment': f'per-corpus ZCA whitening, shrinkage {space.SHRINK}',
        'by_corpus': frame.corpus.value_counts().to_dict(),
        'clustering': {'reduction': 'UMAP 10-d, cosine, 15 neighbours', 'method': 'HDBSCAN',
                       'min_cluster_size': MIN_CLUSTER, 'min_samples': MIN_SAMPLES,
                       'map': 'separate 2-d UMAP, 30 neighbours'},
        'clusters': len(found), 'mixed_clusters': sum(c['mixed'] for c in found),
        'noise_share': round(float((labels == -1).mean()), 4), 'checks': checks,
        'links': {'neighbours': links.K, 'min_passages': links.MIN_PASSAGES,
                  'interval': f'{links.ITERATIONS} resamples of debates, books, works, laws, articles '
                              'or employers'},
        'terms_reviewed': False, 'seconds': round(time.time() - started)})
    print(f'{len(found)} clusters, {sum(c["mixed"] for c in found)} mixed, '
          f'noise {(labels == -1).mean():.1%}, {time.time() - started:.0f} s')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('step', choices=['embed', 'analyse'])
    {'embed': embed, 'analyse': analyse}[parser.parse_args().step]()


if __name__ == '__main__':
    main()
