"""Replik observations: passages of party-leader debates, two text versions and a debate-level split.

Source: the published passage table (whole sentences closed at 80 words, minimum 40, maximum 150;
ml/research/topics.py) of the 2026-10-12 topic run. Text versions:
- `current`: the passage as published;
- `masked`: speaker names, party names and forms of address replaced by placeholders, to test how
  far groups follow who speaks rather than what is said.
Masking only substitutes whole name/address tokens; negations are never touched (`NEGATIONS`).
"""
from __future__ import annotations

from collections import Counter
from pathlib import Path
import re

import numpy as np
import pandas as pd

from ml.cluster_lab.io import digest
from . import embed, splits
from .registry import LOCAL

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'warehouse/cluster_lab/public-topics-2026-10-12/datasets/debate/observations.parquet'
FOLDER = LOCAL / 'debates'
TEXT_VERSIONS = {'current': 'replik-passages-v1', 'masked': 'replik-passages-masked-v1'}
NEGATIONS = ('inte', 'aldrig', 'ingen', 'inget', 'inga', 'icke', 'varken')
PARTY = re.compile(r'\b(?:(?:social ?demokrat|sosse|sossar|moderat|vänsterpartis?t|vänsterpartiet|centerpartis?t|'
                   r'centerpartiet|folkpartis?t|folkpartiet|kristdemokrat|miljöpartis?t|miljöpartiet|sverigedemokrat|'
                   r'kommunist)\w*|liberalerna?s?|liberaler|KD|MP|SD|FP)\b', re.IGNORECASE)
ADDRESS = re.compile(r'\b(?:herr|fru) (?:talman|ålderspresident)\w*|\b\w*ministern?s?\b|'
                     r'\bpartiledare\w*|\bpartiordförande\w*|\bpartisekreterare\w*', re.IGNORECASE)
WORD = re.compile(r'\w+')


def name_pattern(speakers) -> re.Pattern:
    """Full names, first names and surnames (at least four letters) of every speaker, longest first."""
    names = set()
    for speaker in speakers:
        speaker = ' '.join(str(speaker).replace('- ', '-').split())
        if len(speaker) < 4:
            continue
        names.add(speaker)
        parts = speaker.split()
        for part in {parts[0], parts[-1]}:
            if len(part) >= 4:
                names.update((part, part + 's'))
    alternatives = '|'.join(re.escape(n) for n in sorted(names, key=len, reverse=True))
    return re.compile(rf'\b(?:{alternatives})\b')


def negation_counts(text: str) -> Counter:
    return Counter(w for w in WORD.findall(text.lower()) if w in NEGATIONS)


def mask(text: str, names: re.Pattern) -> str:
    out = names.sub('[NAMN]', text)
    out = PARTY.sub('[PARTI]', out)
    out = ADDRESS.sub('[TILLTAL]', out)
    if negation_counts(out) != negation_counts(text):
        raise AssertionError(f'masking changed negations in: {text[:80]}')
    return out


def opening(text: str, words: int = 8) -> str:
    return ' '.join(WORD.findall(text.lower())[:words])


def templates(texts: pd.Series, words: int = 8, top: int = 10) -> dict:
    """Share of passages whose first `words` words equal another passage's, and the commonest."""
    keys = texts.map(lambda t: opening(t, words))
    counts = keys.value_counts()
    shared = keys.map(counts) > 1
    return {'opening_words': words, 'share_sharing_opening': float(shared.mean()),
            'distinct_shared_openings': int((counts > 1).sum()),
            'top': [{'opening': k, 'passages': int(v)} for k, v in counts.head(top).items() if v > 1]}


def prepare(source: Path = SOURCE, folder: Path = FOLDER) -> dict:
    """Write observations.parquet (both text versions, split side) and prepare.json."""
    frame = pd.read_parquet(source)
    names = name_pattern(frame.speaker.unique())
    obs = pd.DataFrame({
        'observation_id': frame.observation_id, 'debate_id': frame.debate_id,
        'speaker': frame.speaker, 'party': frame.party, 'date': frame.speech_date,
        'year': frame.year.astype(int), 'decade': frame.decade.astype(str), 'session': frame.session,
        'text': frame.context})
    obs['text_masked'] = obs.text.map(lambda t: mask(t, names))
    obs['text_hash'] = [embed.text_hash(t, TEXT_VERSIONS['current']) for t in obs.text]
    obs['text_hash_masked'] = [embed.text_hash(t, TEXT_VERSIONS['masked']) for t in obs.text_masked]
    obs['selection'] = splits.split(obs.debate_id, obs.text_hash, 0.5, seed=0)
    leaks = splits.check(obs.selection.to_numpy(), obs.debate_id, obs.text_hash)
    if leaks:
        raise AssertionError(f'split leaks: {leaks}')
    folder.mkdir(parents=True, exist_ok=True)
    obs.to_parquet(folder / 'observations.parquet', index=False)
    changed = (obs.text != obs.text_masked)
    summary = {
        'source': str(source.relative_to(ROOT)).replace('\\', '/'),
        'observations': len(obs), 'debates': int(obs.debate_id.nunique()), 'speakers': int(obs.speaker.nunique()),
        'dataset_version': dataset_version(obs),
        'sides': {side: {'observations': int(m.sum()), 'debates': int(obs.debate_id[m].nunique()),
                         'dataset_version': dataset_version(obs[m])}
                  for side, m in (('selection', obs.selection), ('evaluation', ~obs.selection))},
        'leaks': leaks,
        'masking': {'passages_changed': float(changed.mean()),
                    'placeholders': {p: int(obs.text_masked.str.count(re.escape(p)).sum())
                                     for p in ('[NAMN]', '[PARTI]', '[TILLTAL]')},
                    'negations_preserved': True},
        'templates': templates(obs.text), 'templates_masked': templates(obs.text_masked),
        'decades': obs.decade.value_counts().sort_index().to_dict()}
    return summary


def dataset_version(obs: pd.DataFrame) -> str:
    return digest(sorted(zip(obs.observation_id, obs.text_hash)))[:16]


def load(folder: Path = FOLDER) -> pd.DataFrame:
    return pd.read_parquet(folder / 'observations.parquet')


def centring_groups(obs: pd.DataFrame, field: str) -> np.ndarray | None:
    """Group per observation for centring, or None (no centring). Speakers follow the champion's rule:
    only speakers with at least five passages in at least two debates are centred."""
    if field == 'none':
        return None
    if field == 'speaker':
        stats = obs.groupby('speaker').agg(n=('observation_id', 'count'), d=('debate_id', 'nunique'))
        ok = set(stats.index[(stats.n >= 5) & (stats.d >= 2)])
        return np.where(obs.speaker.isin(ok), obs.speaker, '').astype(str)
    return obs[field].astype(str).to_numpy()


def centre(vectors: np.ndarray, groups) -> np.ndarray:
    """Subtract each group's mean (group '' is left as is) and re-normalise."""
    from .fit import normalise
    out = normalise(np.asarray(vectors, dtype=np.float32)).copy()
    if groups is None:
        return out
    groups = np.asarray(groups)
    for g in np.unique(groups):
        if g == '':
            continue
        m = groups == g
        out[m] -= out[m].mean(axis=0)
    return normalise(out)
