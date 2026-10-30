"""Job-ad clustering experiments: selection on one side of the employer split, final evaluation on the other.

Champion: the ml/jobs research settings (docs/job-market-clustering.md) applied to the job-assistant
corpus: title-description-skills text as served, token-chunk mean MiniLM-L12 at the pinned revision,
cosine UMAP 10-D with 60 neighbours and min_dist 0, HDBSCAN min_samples 3, eom. Its min_cluster_size
of 600 was set for 35,861 ads; here it is scaled to the same share (600/35,861 of the ads fitted).
The research run's title-pattern and technology features and its three-seed consensus are not
reproduced: the champion is the semantic-text part of that pipeline on a different, smaller corpus.

Selection (seeds 0-2) compares text (raw vs template-stripped and employer-masked), embedding
(MiniLM-L12 vs Swedish KBLab SBERT vs TF-IDF/SVD) and clustering (HDBSCAN grid vs K-means grid).
PICK_RULE names how at most three candidates are chosen; nothing from the evaluation side is used.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from ml.cluster_lab.io import now
from . import accept, contract, fit, splits
from . import evaluate as ev
from . import jobs_data, jobs_model
from .runtime import Checkpoints

QUESTION = 'Which groups of tasks and skill needs do Data/IT job ads fall into?'
CORPUS = ('Job-assistant store: JobTech Data/IT ads since 2026-07 (CC0), current and removed, deduplicated. '
          'Not the 35,861-ad 2022-2025 research corpus behind frontend/public/data/jobs/cluster-summary.json.')
SELECTION_SEEDS, FINAL_SEEDS = [0, 1, 2], [10, 11, 12, 13, 14]
RESEARCH_MCS = round(600 / 35861, 4)
UMAP = {'kind': 'umap', 'dims': 10, 'neighbors': 60, 'min_dist': 0.0, 'metric': 'cosine'}
TEXTS = {'raw': ('text_raw', 'hash_raw', jobs_data.RAW_VERSION),
         'clean': ('text_clean', 'hash_clean', jobs_data.CLEAN_VERSION)}
CLUSTERINGS = {
    'hdbscan-research-share': {'method': 'hdbscan', 'min_cluster_size': RESEARCH_MCS, 'min_samples': 3, 'selection': 'eom'},
    'hdbscan-mcs10': {'method': 'hdbscan', 'min_cluster_size': 10, 'min_samples': 3, 'selection': 'eom'},
    'hdbscan-mcs40': {'method': 'hdbscan', 'min_cluster_size': 40, 'min_samples': 3, 'selection': 'eom'},
    'kmeans-k8': {'method': 'kmeans', 'k': 8},
    'kmeans-k12': {'method': 'kmeans', 'k': 12},
    'kmeans-k16': {'method': 'kmeans', 'k': 16},
}
# Run once, champion text and embedding only, to record that the research value does not transfer.
RESEARCH_ABSOLUTE = {'method': 'hdbscan', 'min_cluster_size': 600, 'min_samples': 3, 'selection': 'eom'}
PICK_RULE = ('Among non-champion selection fits that meet the absolute criteria of configs/experiments/jobs.yaml '
             '(those failing them only fill empty places), rank by seed ARI, then representation silhouette; '
             'take the best HDBSCAN fit, the best K-means fit, and the best fit whose text or embedding differs '
             'from both.')
LIMITATIONS = [
    'About three months of ads from one occupation field; groups describe this window only.',
    'Cluster ids are run-bound; group names are generated c-TF-IDF terms, not reviewed.',
    'The champion reproduces the research pipeline\'s semantic text only (no title/technology features, no consensus).',
    'Template stripping is measured per employer on the whole snapshot before the split (no labels involved).',
]


def pipeline(text: str, embedding: str, clustering: dict) -> dict:
    t = TEXTS[text]
    return {'text': {'variant': text, 'version': t[2], 'template_min_ads': jobs_data.TEMPLATE_MIN_ADS,
                     'template_min_chars': jobs_data.TEMPLATE_MIN_CHARS, 'mask_employer': text == 'clean'},
            'embedding': {'key': embedding, **jobs_model.EMBEDDINGS[embedding]},
            'representation': {'kind': 'raw'}, 'reduction': dict(UMAP), 'clustering': dict(clustering),
            'map': '2-D UMAP of the representation (60 neighbours, min_dist 0.08)'}


CHAMPION = pipeline('raw', 'minilm-l12', CLUSTERINGS['hdbscan-research-share'])


def sides(frame: pd.DataFrame) -> np.ndarray:
    """True = selection side. Employer and identical cleaned text keep related ads on one side."""
    mask = splits.split(frame.employer, frame.hash_clean, 0.5, seed=0)
    problems = splits.check(mask, frame.employer, frame.hash_clean)
    if problems:
        raise RuntimeError(f'split leaks: {problems}')
    return mask


def vectors(frame: pd.DataFrame, pipe: dict, transformer=None, deadline=None, **kw):
    column, hashes, version = TEXTS[pipe['text']['variant']]
    if pipe['text']['version'] != version:
        raise ValueError(f"pipeline was built on text {pipe['text']['version']}, the current preprocessing is {version}: "
                         'a model on an older text version cannot embed new ads; run select and final again')
    return jobs_model.encode(frame[column].tolist(), frame[hashes].tolist(), version, pipe['embedding']['key'],
                             transformer=transformer, deadline=deadline, **kw)


def confounders(frame: pd.DataFrame) -> dict:
    """employer is the confounder; occupation (JobTech's label) is reported for reference only."""
    return {'employer': frame.employer.to_numpy(), 'occupation': frame.occupation.to_numpy()}


def run_units(units: dict, checkpoints: Checkpoints, deadline=None) -> dict:
    """Run each unit once; finished units are skipped on a rerun, so an interrupted run resumes."""
    for key, work in units.items():
        if checkpoints.done(key):
            continue
        if deadline is not None and deadline.expired():
            raise TimeoutError(f'deadline reached before {key}; rerun to resume')
        checkpoints.put(key, work())
    return {k: checkpoints.get(k) for k in units}


def absolute_ok(metrics: dict) -> bool:
    rules, sha = accept.criteria('jobs')
    floor = [r for r in rules if 'at_least' in r or 'at_most' in r]
    return accept.check({'metrics': metrics}, None, floor, sha)['passed']


def pick(results: dict) -> list[str]:
    """Apply PICK_RULE to {key: {'pipeline', 'metrics'}}; returns at most three keys."""
    pool = [k for k, r in results.items() if r['pipeline'] != CHAMPION and r.get('metrics')]

    def rank(k):
        m = results[k]['metrics']
        return (absolute_ok(m), (m['seed_stability'] or {}).get('ari_mean') or 0, m['separation_representation'] or -1)

    pool.sort(key=rank, reverse=True)
    chosen = []
    for method in ('hdbscan', 'kmeans'):
        best = next((k for k in pool if results[k]['pipeline']['clustering']['method'] == method), None)
        if best:
            chosen.append(best)
    used = {(results[k]['pipeline']['text']['variant'], results[k]['pipeline']['embedding']['key']) for k in chosen}
    other = next((k for k in pool if k not in chosen and (results[k]['pipeline']['text']['variant'],
                                                          results[k]['pipeline']['embedding']['key']) not in used), None)
    return chosen + ([other] if other else [])


def selection_units(frame: pd.DataFrame, deadline=None) -> dict:
    """{key: callable} for every selection fit; vectors are computed once per text and embedding."""
    units, store = {}, {}
    conf = confounders(frame)

    def unit(text, emb, name, clustering):
        def work():
            pipe = pipeline(text, emb, clustering)
            if (text, emb) not in store:
                store[(text, emb)] = vectors(frame, pipe, deadline=deadline)[0]
            _, _, metrics = fit.evaluate_candidate(store[(text, emb)], pipe, SELECTION_SEEDS, conf)
            return {'pipeline': pipe, 'metrics': metrics}
        return work

    for text in TEXTS:
        for emb in jobs_model.EMBEDDINGS:
            for name, clustering in CLUSTERINGS.items():
                units[f'{text}__{emb}__{name}'] = unit(text, emb, name, clustering)
    units['raw__minilm-l12__hdbscan-mcs600'] = unit('raw', 'minilm-l12', 'mcs600', RESEARCH_ABSOLUTE)
    return units


def make_run(frame: pd.DataFrame, pipe: dict, seeds: list, role: str, metrics: dict, resources: dict,
             label: str, sample: dict) -> dict:
    version = jobs_data.dataset_version(frame)
    run = {'domain': 'jobs', 'question': QUESTION, 'corpus': CORPUS, 'sample': sample, 'dataset_version': version,
           'pipeline': pipe, 'seeds': list(seeds), 'role': role, 'metrics': metrics, 'resources': resources,
           'limitations': LIMITATIONS, 'created_at': now(), 'label': label}
    run['run_id'] = contract.run_id('jobs', version, pipe, list(seeds), role)
    return run


def temporal(model: dict, train: pd.DataFrame, later: pd.DataFrame, pipe: dict, transformer=None) -> dict:
    """Fit on older ads, assign newer ones: coverage, and agreement with a refit that includes them."""
    if later.empty:
        return {'new_ads': 0}
    new_vectors, _ = vectors(later, pipe, transformer=transformer)
    assigned, _ = jobs_model.assign(model, new_vectors)
    both = pd.concat([train, later], ignore_index=True)
    all_vectors, fitted = vectors(both, pipe)
    refit = jobs_model.fit_model(all_vectors, pipe, model['seed'], fitted)['labels'][len(train):]
    return {'new_ads': int(len(later)), 'assigned_share': float((assigned >= 0).mean()),
            'refit_coverage': float((refit >= 0).mean()),
            'agreement_ari_with_refit': ev.pair_ari(assigned, refit), 'noise_excluded': True}


# Words every ad uses whatever its tasks (fixed by reading the first export's terms, before any review).
AD_FILLER = ('title description skills programmeringsspråk erfarenhet arbeta arbetar arbete söker hos inom dig din dina '
             'ditt samt både rollen roll god goda ansökan verksamhet tjänsten tjänst uppdrag uppdraget kunder kund '
             'möjlighet bolag företag våra vår oss välkommen tekniska teknisk lösningar arbetet erbjuder kunskap '
             'kunskaper meriterande krav ser gärna stor stort tillsammans experience team work working role you will '
             'skills knowledge looking join')


def terms(texts: list[str], labels: np.ndarray, top: int = 8) -> dict[int, list[str]]:
    """Generated c-TF-IDF terms per group (unreviewed), with the repo's class-based TF-IDF."""
    import sys
    from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS
    sys.path.insert(0, str(jobs_data.ROOT / 'platform' / 'nlp' / 'symbolic'))
    from rank_clusters import ctfidf
    from ml.research.consensus import SWEDISH
    stops = set(SWEDISH) | set(ENGLISH_STOP_WORDS) | set(AD_FILLER.split()) | {jobs_data.MASK.lower()}
    words = ctfidf({int(c): [t for t, l in zip(texts, labels) if l == c] for c in sorted(set(labels) - {-1})},
                   top=top, stop_words_override=sorted(stops), token_pattern=r'(?u)\b[^\W\d_][^\W\d_]{2,}\b')
    out: dict[int, list[str]] = {}
    for w in words:
        out.setdefault(w['cluster_id'], []).append(w['term'])
    return out
