"""Full-text retention beside the existing filtered and aggregate archive importers."""
from __future__ import annotations

import hashlib
import json
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

FIELDS = ['observation_id', 'published_at', 'title', 'description', 'occupation_group',
          'occupation_code', 'occupation_field', 'occupation_field_id', 'employer',
          'municipality', 'region', 'employment_type', 'source', 'ingested_at', 'country']
SCHEMA = pa.schema([(k, pa.string()) for k in FIELDS])


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    temporary.replace(path)


def first(value):
    if isinstance(value, list):
        return next((v for v in value if v), {})
    return value or {}


def record(ad, source, fetched):
    field, group = first(ad.get('occupation_field')), first(ad.get('occupation_group'))
    employer, place = first(ad.get('employer')), first(ad.get('workplace_address'))
    description = ad.get('description') or {}
    if isinstance(description, dict):
        description = description.get('text') or description.get('text_formatted') or ''
    return dict(zip(FIELDS, [str(ad.get('id') or ''), ad.get('publication_date'),
        ad.get('headline'), description, group.get('label'),
        group.get('concept_id') or group.get('legacy_ams_taxonomy_id'),
        field.get('label'), field.get('concept_id'), employer.get('name'),
        place.get('municipality'), place.get('region'),
        first(ad.get('employment_type')).get('label'), source, fetched, place.get('country')]))


def import_archive_all(path, name, directory, source_uri=None, batch_size=20000, on_checkpoint=None):
    """Checkpoint each source-line block; resume by rescanning the ZIP to that line.

    No occupational, skill or title selection. IDs and text deduplication are dataset
    concerns so overlapping archives do not change the archival record.
    """
    path, folder = Path(path), Path(directory) / name
    folder.mkdir(parents=True, exist_ok=True)
    with path.open('rb') as handle:
        checksum = hashlib.file_digest(handle, 'sha256').hexdigest()
    state_path = folder / 'state.json'
    state = json.loads(state_path.read_text(encoding='utf-8')) if state_path.exists() else {}
    if state and state['source_sha256'] != checksum:
        raise ValueError(f'Archive {name} changed; use a new corpus directory')
    if state.get('status') == 'completed':
        return state
    state = state or {'source_sha256': checksum, 'source': source_uri or str(path),
        'fetched_at': datetime.now(timezone.utc).isoformat(), 'lines': 0, 'shards': [],
        'scope': 'all occupations; no role, title or skills filter'}
    previous, lines, block, started = state['lines'], 0, [], time.monotonic()

    def checkpoint():
        if on_checkpoint:
            on_checkpoint()
        if block:
            shard = f'part-{lines:010d}.parquet'
            temporary = folder / (shard + '.tmp')
            pq.write_table(pa.Table.from_pylist(block, schema=SCHEMA), temporary, compression='zstd')
            temporary.replace(folder / shard)
            state['shards'].append(shard)
        state.update(lines=lines, status='running')
        atomic_json(state_path, state)
        block.clear()
        print(f'{name}: {lines:,} source lines checkpointed ({time.monotonic()-started:.0f}s)', flush=True)

    try:
        with zipfile.ZipFile(path) as archive:
            members = [n for n in archive.namelist() if n.endswith(('.jsonl', '.ndjson', '.json'))]
            if not members:
                raise ValueError('Archive has no JSONL member')
            for member in members:
                with archive.open(member) as stream:
                    for line in stream:
                        lines += 1
                        if lines <= previous or not line.strip():
                            continue
                        ad = json.loads(line)
                        if not isinstance(ad, dict) or not ad.get('id'):
                            raise ValueError(f'{name}:{lines}: missing stable ID')
                        block.append(record(ad, state['source'], state['fetched_at']))
                        if len(block) >= batch_size:
                            checkpoint()
        checkpoint()
        if not state['shards']:
            raise ValueError('Archive contains no advertisements')
        state.update(status='completed', completed_at=datetime.now(timezone.utc).isoformat())
        atomic_json(state_path, state)
        return state
    except BaseException as error:
        # Uncheckpointed rows are replayed; previously committed shards stay valid.
        state.update(status='interrupted' if isinstance(error, KeyboardInterrupt) else 'failed', error=str(error))
        atomic_json(state_path, state)
        raise
