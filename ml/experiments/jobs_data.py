"""Job-assistant ads as a versioned, cleaned and deduplicated clustering dataset.

The source is the live job-assistant store (`warehouse/raw/job_assistant/ads.json`, written by
`platform/job_assistant/ads.py`): current and removed ads, each with a content_hash and a
duplicate_key. This module only reads it.

Steps, each versioned so a change gives new hashes and a new dataset_version:
1. validate: every ad needs the fields in REQUIRED; a store that is missing, empty, not JSON or
   has more than MAX_SCHEMA_FAILURE_SHARE invalid ads is an explicit failure (InputError).
2. dedup: drop ads marked duplicate_of, keep one ad per duplicate_key and per content_hash, then
   one per identical cleaned text.
3. strip the store's contact-redaction placeholders (MARKERS) from every variant, then
   clean (CLEAN_VERSION): a line of at least TEMPLATE_MIN_CHARS characters that appears in at
   least TEMPLATE_MIN_ADS distinct ads of the same employer is employer boilerplate and is
   removed; the employer's name is masked. RAW_VERSION keeps the description as served.
Text goes to `warehouse/ml/experiments/jobs/` (local only); the snapshot JSON in the features tree
holds ids and hashes, never text.
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

import pandas as pd

from ml.cluster_lab.io import atomic_json, atomic_parquet, digest, now, read_json
from ml.jobs.prepare import TEXT_VERSION, semantic_text
from .embed import text_hash
from .registry import EXPERIMENTS, LOCAL

ROOT = Path(__file__).resolve().parents[2]
STORE = ROOT / 'warehouse' / 'raw' / 'job_assistant' / 'ads.json'
OUT = EXPERIMENTS / 'jobs'
TEXTS = LOCAL / 'jobs'
# v2 (2026-10-29): the store's contact-redaction placeholders are removed from every variant.
RAW_VERSION = f'{TEXT_VERSION}+ja-raw-v2'
CLEAN_VERSION = f'{TEXT_VERSION}+ja-template-strip-mask-v2'
# Inserted by platform/publish/job_content.py (redact, public_text); never embedded.
MARKERS = ('[kontaktuppgift utelämnad]', '[kontaktperson utelämnad]')
TEMPLATE_MIN_ADS = 3
TEMPLATE_MIN_CHARS = 80
MAX_SCHEMA_FAILURE_SHARE = 0.05
MASK = 'ARBETSGIVAREN'
REQUIRED = {'id': str, 'headline': str, 'description': str, 'employer': str, 'content_hash': str,
            'duplicate_key': str, 'published': str}
LEGAL = re.compile(r'\b(aktiebolag|ab|\(publ\)|publ|hb|kb|sweden|sverige|i sverige|group|nordic)\b', re.I)


class InputError(ValueError):
    """The input cannot be used; the run stops instead of producing a partial dataset."""


def load_store(path: Path = STORE) -> list[dict]:
    path = Path(path)
    if not path.is_file():
        raise InputError(f'job-assistant store missing: {path}; pull it with warehouse_store.py pull --only raw --path job_assistant')
    try:
        ads = json.loads(path.read_text(encoding='utf-8'))
    except json.JSONDecodeError as error:
        raise InputError(f'{path} is not valid JSON: {error}') from error
    if not isinstance(ads, list):
        raise InputError(f'{path} must hold a list of ads, not {type(ads).__name__}')
    if not ads:
        raise InputError(f'{path} holds no ads')
    return ads


def validate(ads: list) -> tuple[list[dict], list[dict]]:
    """(valid ads, failures). Raises when too many fail: a broken export must not shrink the corpus silently."""
    valid, failures = [], []
    for n, ad in enumerate(ads):
        if not isinstance(ad, dict):
            failures.append({'index': n, 'problem': 'not an object'})
            continue
        problems = [f'{k} missing or not {t.__name__}' for k, t in REQUIRED.items() if not isinstance(ad.get(k), t)]
        if not problems and not ad['description'].strip():
            problems.append('empty description')
        if problems:
            failures.append({'index': n, 'id': ad.get('id'), 'problem': '; '.join(problems)})
        else:
            valid.append(ad)
    if not valid:
        raise InputError(f'no valid ads among {len(ads)}: {failures[:3]}')
    if len(failures) / len(ads) > MAX_SCHEMA_FAILURE_SHARE:
        raise InputError(f'{len(failures)} of {len(ads)} ads fail the schema (limit {MAX_SCHEMA_FAILURE_SHARE:.0%}): {failures[:3]}')
    return valid, failures


def dedup(ads: list[dict]) -> tuple[list[dict], dict]:
    """One ad per duplicate_key and per content_hash; the earliest published wins."""
    ordered = sorted(ads, key=lambda a: (a['published'], a['id']))
    marked = [a for a in ordered if not a.get('duplicate_of')]
    seen_key, seen_hash, kept = set(), set(), []
    for ad in marked:
        if ad['duplicate_key'] in seen_key or ad['content_hash'] in seen_hash:
            continue
        seen_key.add(ad['duplicate_key'])
        seen_hash.add(ad['content_hash'])
        kept.append(ad)
    return kept, {'input': len(ads), 'duplicate_of': len(ads) - len(marked),
                  'duplicate_key_or_hash': len(marked) - len(kept), 'kept': len(kept)}


def strip_markers(text: str) -> str:
    for marker in MARKERS:
        text = text.replace(marker, ' ')
    return text


def lines(text: str) -> list[str]:
    return [' '.join(line.split()) for line in str(text).splitlines() if line.strip()]


def employer_key(ad: dict) -> str:
    return str(ad.get('organisation_number') or ad['employer']).strip().lower()


def templates(ads: list[dict], min_ads: int = TEMPLATE_MIN_ADS, min_chars: int = TEMPLATE_MIN_CHARS):
    """Per employer, the long lines repeated in at least `min_ads` of its ads, plus measurements."""
    counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for ad in ads:
        for line in {l.lower() for l in lines(ad['description']) if len(l) >= min_chars}:
            counts[employer_key(ad)][line] += 1
    found = {e: {l for l, n in c.items() if n >= min_ads} for e, c in counts.items()}
    found = {e: s for e, s in found.items() if s}
    with_template = removed = total = 0
    for ad in ads:
        own = found.get(employer_key(ad), set())
        body = lines(ad['description'])
        cut = sum(len(l) for l in body if l.lower() in own)
        total += sum(len(l) for l in body)
        removed += cut
        with_template += cut > 0
    stats = {'min_ads': min_ads, 'min_chars': min_chars, 'employers_with_templates': len(found),
             'template_lines': sum(map(len, found.values())),
             'ads_with_template_share': round(with_template / max(len(ads), 1), 4),
             'characters_removed_share': round(removed / max(total, 1), 4)}
    return found, stats


def mask_employer(text: str, employer: str) -> str:
    """Replace the employer's name, its name without legal suffixes and a distinctive first word."""
    core = ' '.join(LEGAL.sub(' ', employer).split())
    names = sorted({n for n in (employer.strip(), core) if len(n) >= 3}, key=len, reverse=True)
    for name in names:
        text = re.sub(rf'(?<!\w){re.escape(name)}s?(?!\w)', MASK, text, flags=re.I)
    first = core.split(' ')[0] if core else ''
    if len(first) >= 5 and first[:1].isupper():
        text = re.sub(rf'(?<!\w){re.escape(first)}s?(?!\w)', MASK, text)
    return text


def clean_description(ad: dict, found: dict) -> str:
    own = found.get(employer_key(ad), set())
    kept = [l for l in lines(ad['description']) if l.lower() not in own]
    return mask_employer('\n'.join(kept), ad['employer'])


def prepare(ads: list, as_of: str | None = None, hold_out_newest: float = 0.0) -> tuple[pd.DataFrame, dict]:
    """Validated, deduplicated ads with raw and cleaned text. `hold_out_newest` keeps only ads published
    before the given quantile of publication dates (the newest share is treated as not yet seen)."""
    valid, failures = validate(ads)
    kept, dedup_stats = dedup(valid)
    if hold_out_newest:
        dates = sorted(a['published'] for a in kept)
        as_of = dates[int(len(dates) * (1 - hold_out_newest))]
    if as_of:
        dedup_stats['after_date_cut'] = len(kept := [a for a in kept if a['published'] < as_of])
    if not kept:
        raise InputError('no ads left after deduplication and the date cut')
    kept = [{**a, 'headline': strip_markers(a['headline']), 'description': strip_markers(a['description'])} for a in kept]
    found, template_stats = templates(kept)
    rows = []
    for ad in kept:
        skills = list(ad.get('must_have') or []) + list(ad.get('nice_to_have') or [])
        raw = semantic_text(ad['headline'], ad['description'], skills)
        clean = semantic_text(mask_employer(ad['headline'], ad['employer']), clean_description(ad, found), skills)
        rows.append({'id': str(ad['id']), 'employer': employer_key(ad), 'employer_name': ad['employer'],
                     'published': ad['published'], 'removed_at': ad.get('removed_at'),
                     'content_hash': ad['content_hash'], 'duplicate_key': ad['duplicate_key'],
                     'occupation': ad.get('occupation') or '', 'headline': ad['headline'],
                     'source_url': ad.get('source_url') or '', 'text_raw': raw, 'text_clean': clean,
                     'hash_raw': text_hash(raw, RAW_VERSION), 'hash_clean': text_hash(clean, CLEAN_VERSION)})
    frame = pd.DataFrame(rows)
    before = len(frame)
    frame = frame.drop_duplicates('hash_clean').reset_index(drop=True)
    dedup_stats['identical_clean_text'] = before - len(frame)
    dedup_stats['kept'] = len(frame)
    dropped = dedup_stats['duplicate_of'] + dedup_stats['duplicate_key_or_hash'] + dedup_stats['identical_clean_text']
    dedup_stats['dedup_rate'] = round(dropped / len(valid), 4)
    stats = {'store_ads': len(ads), 'schema_failures': len(failures), 'schema_failure_examples': failures[:5],
             'dedup': dedup_stats, 'templates': template_stats, 'as_of': as_of,
             'hold_out_newest': hold_out_newest, 'removed_retained': int(frame.removed_at.notna().sum())}
    return frame, stats


def dataset_version(frame: pd.DataFrame, hash_column: str = 'hash_clean') -> str:
    return digest(sorted(zip(frame.id, frame[hash_column])))[:16]


def snapshot(frame: pd.DataFrame, stats: dict) -> dict:
    """What a later run needs to detect new, changed and removed ads; ids and hashes only."""
    return {'dataset_version': dataset_version(frame), 'created_at': now(), 'versions': [RAW_VERSION, CLEAN_VERSION],
            'stats': stats, 'ads': {r.id: {'content_hash': r.content_hash, 'hash_clean': r.hash_clean,
                                           'published': r.published, 'removed': isinstance(r.removed_at, str)}
                                    for r in frame.itertuples()}}


def diff(previous: dict | None, frame: pd.DataFrame) -> dict:
    """New, changed (content_hash differs) and newly removed ads since `previous`."""
    old = (previous or {}).get('ads', {})
    new, changed, removed, unchanged = [], [], [], 0
    for r in frame.itertuples():
        before = old.get(r.id)
        if before is None:
            new.append(r.id)
        elif before['content_hash'] != r.content_hash:
            changed.append(r.id)
        else:
            unchanged += 1
        if before is not None and isinstance(r.removed_at, str) and not before['removed']:
            removed.append(r.id)
    gone = sorted(set(old) - set(frame.id))
    return {'since': (previous or {}).get('dataset_version'), 'new': new, 'changed': changed,
            'removed': removed, 'missing_from_store': gone, 'unchanged': unchanged}


def save(frame: pd.DataFrame, snap: dict, texts: Path = TEXTS, out: Path = OUT) -> str:
    version = snap['dataset_version']
    atomic_parquet(frame, Path(texts) / f'{version}.parquet')
    atomic_json(Path(out) / 'snapshots' / f'{version}.json', snap)
    return version


def load(version: str, texts: Path = TEXTS, out: Path = OUT) -> tuple[pd.DataFrame, dict]:
    path = Path(texts) / f'{version}.parquet'
    if not path.exists():
        raise InputError(f'prepared dataset {version} missing at {path}; run prepare')
    return pd.read_parquet(path), read_json(Path(out) / 'snapshots' / f'{version}.json')
