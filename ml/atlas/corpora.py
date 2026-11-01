"""Six corpora in one table, embedded with one multilingual model.

Every row is one passage: a Riksdag party-leader debate passage, a symbol occurrence in myth and
dream literature, a philosophy passage, a provision of a Swedish law, a paragraph of the EU AI Act
(Swedish and English), or the opening of a job advert. Each keeps the corpus' own grouping
(`group`: party, tradition, author, law, article, occupation), the unit its passages are
correlated within (`unit`: debate, book, work, law, article, employer) and a year where one exists.

All use paraphrase-multilingual-MiniLM-L12-v2 at a pinned revision, through the shared embedding
cache. The three experiment corpora reuse their own text versions, so their cached vectors are
read, not recomputed.
"""
from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import pandas as pd

from ml.experiments import debates_data, embed
from ml.experiments import philosophy as ph
from ml.experiments import symbolic as sy

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / 'frontend/public/data'
MODEL = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
REVISION = 'e8f8c211226b894fcb81acc59f3b34ba3efd5f42'
ADS = ROOT / 'warehouse/raw/job_assistant/ads.json'
AD_WORDS = 90  # about what MiniLM reads (128 word pieces)
MIN_CHARS = 60
COLUMNS = ['corpus', 'item_id', 'unit', 'group', 'label', 'year', 'language', 'text', 'text_hash']


def _frame(rows: list[dict], version: str) -> pd.DataFrame:
    frame = pd.DataFrame(rows)
    frame['text_hash'] = [embed.text_hash(t, version) for t in frame.text]
    return frame


def debates() -> tuple[pd.DataFrame, str]:
    obs = pd.read_parquet(debates_data.FOLDER / 'observations.parquet')
    return pd.DataFrame({
        'corpus': 'debates', 'item_id': obs.observation_id, 'unit': obs.debate_id, 'group': obs.party,
        'label': obs.speaker + ', ' + obs.session, 'year': obs.year.astype(int), 'language': 'sv',
        'text': obs.text, 'text_hash': obs.text_hash}), debates_data.TEXT_VERSIONS['current']


def symbols() -> tuple[pd.DataFrame, str]:
    obs = sy.observations()
    version = sy.data.VARIANTS['context']
    return pd.DataFrame({
        'corpus': 'symbols', 'item_id': obs.occurrence_id, 'unit': obs.document_id, 'group': obs.tradition,
        'label': obs.symbol_id + ' in ' + obs.title, 'year': None, 'language': 'en',
        'text': obs.context, 'text_hash': [embed.text_hash(t, version) for t in obs.context]}), version


def philosophy() -> tuple[pd.DataFrame, str]:
    obs = ph.sampled(ph.load()[0])
    return pd.DataFrame({
        'corpus': 'philosophy', 'item_id': obs.passage_id, 'unit': obs.document_id, 'group': obs.author,
        'label': obs.title, 'year': None, 'language': 'en', 'text': obs.text,
        'text_hash': obs.text_hash}), ph.TEXT_VERSION


def laws() -> tuple[pd.DataFrame, str]:
    from ml.mlkit import data
    snapshots = json.loads((PUBLIC / 'gold/tables/dim_law_snapshot.json').read_text(encoding='utf-8'))

    def load(snapshot):
        provisions = data._unwrap(json.loads(data._cached(snapshot['detail_path'].removeprefix('/data/'))))
        year = re.search(r'\((\d{4}):', snapshot['title'])
        return [{'corpus': 'laws', 'item_id': p['provision_id'], 'unit': snapshot['document_id'],
                 'group': snapshot['title'],
                 'label': f"{p['label']} {snapshot['title']}", 'year': int(year.group(1)) if year else None,
                 'language': 'sv', 'text': p['text']}
                for p in provisions if len(p.get('text') or '') >= MIN_CHARS]

    with ThreadPoolExecutor(max_workers=8) as pool:
        rows = [row for batch in pool.map(load, snapshots) for row in batch]
    return _frame(rows, 'atlas-laws-v1'), 'atlas-laws-v1'


def ai_act() -> tuple[pd.DataFrame, str]:
    rows = []
    for language in ('sv', 'en'):
        articles = json.loads((PUBLIC / f'ai-act/article-text-{language}.json').read_text(encoding='utf-8'))
        for article, text in articles.items():
            # Numbered paragraphs ("1. ...", "2. ...") are the unit; an unnumbered article is one.
            parts = [p.strip() for p in re.split(r'\n\s*(?=\d+\.\s)', text) if len(p.strip()) >= MIN_CHARS]
            for n, part in enumerate(parts, 1):
                rows.append({'corpus': 'ai_act', 'item_id': f'{language}:{article}:{n}', 'unit': article,
                             'group': article,
                             'label': f'{article.replace("art_", "Article ")}({n}) {language}', 'year': 2024,
                             'language': language, 'text': part})
    return _frame(rows, 'atlas-ai-act-v1'), 'atlas-ai-act-v1'


def jobs() -> tuple[pd.DataFrame, str]:
    """Current adverts, duplicates dropped. Only the headline is ever published, not the text."""
    ads = json.loads(ADS.read_text(encoding='utf-8'))
    rows = [{'corpus': 'jobs', 'item_id': ad['id'], 'unit': ad.get('organisation_number') or ad['id'],
             'group': ad.get('occupation') or 'unknown',
             'label': ad.get('headline') or '', 'year': int((ad.get('published') or '0000')[:4]),
             'language': 'sv',
             'text': ' '.join(f"{ad.get('headline') or ''}. {ad.get('description') or ''}".split()[:AD_WORDS])}
            for ad in ads if not ad.get('duplicate_of')]
    return _frame(rows, 'atlas-jobs-v1'), 'atlas-jobs-v1'


LOADERS = {'debates': debates, 'symbols': symbols, 'philosophy': philosophy, 'laws': laws,
           'ai_act': ai_act, 'jobs': jobs}


def load_all(names=LOADERS) -> tuple[pd.DataFrame, np.ndarray]:
    """All corpora and their vectors, in row order. Embeds only what the cache lacks."""
    frames, vectors = [], []
    for name in names:
        frame, version = LOADERS[name]()
        frame = frame.drop_duplicates('text_hash').reset_index(drop=True)
        print(f'  {name}: {len(frame):,} passages', flush=True)
        vectors.append(embed.embed(frame.text.tolist(), frame.text_hash.tolist(), MODEL, REVISION, version,
                                   batch=1024))
        frames.append(frame[COLUMNS])
    return pd.concat(frames, ignore_index=True), np.vstack(vectors).astype(np.float32)
