"""Export the debate passages for "Where does your sentence land?" (docs/workers-ai.md).

python -m ml.research.export_workers_ai [--map debate] [--examples]

Reads the bge-m3 vectors of all 33,023 passages (platform/nlp/workers_ai.py embed), compresses them
with PCA and int8 (recall@10 against the full vectors; 384 dimensions too when 256 falls below 0.9),
and writes frontend/public/data/workers-ai/debate/:

    pca.json              mean, components and int8 scale of the chosen dimensions
    meta.json             corpus, model, n, dims, recall, cluster names and the shard lists below
    shards/vectors-N.bin  int8 rows, n x dims across the parts, in item order
    shards/items-N.json   {id, x, y, cluster, party, speaker, year, url, text}, 1,000 per part
    examples.json         three sentences with their bge-m3 vectors (--examples calls Workers AI)

Items are ordered by cluster, so a sentence's nearest passages mostly sit in one or two item parts.
x, y and cluster come from the map of the pick key given by --map; names only while the run id in
configs/cluster_lab/public_topic_names.yaml is that pick's.
"""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'platform/nlp'))
import workers_ai  # noqa: E402

SOURCE = ROOT / 'warehouse/cluster_lab/public-consensus-2026-10-13'
RUN = ROOT / 'warehouse/cluster_lab/workers-ai-debate-bge-m3'
DATASET = ROOT / 'warehouse/cluster_lab/public-topics-2026-10-12/datasets/debate/observations.parquet'
TARGET = ROOT / 'frontend/public/data/workers-ai/debate'
NAMES = ROOT / 'configs/cluster_lab/public_topic_names.yaml'
ITEMS_PER_PART = 1000
VECTOR_PARTS = 4
# Neutral sentences from three areas the debates cover; Swedish, as the passages are.
EXAMPLES = [
    ('school', 'Alla elever ska få samma chans att lära sig, oavsett vilken skola de går i.',
     'Every pupil should get the same chance to learn, whichever school they attend.'),
    ('climate', 'Utsläppen av växthusgaser måste minska för att klimatmålen ska nås.',
     'Greenhouse gas emissions must fall for the climate targets to be met.'),
    ('care', 'Väntetiderna i vården behöver bli kortare.',
     'Waiting times in health care need to be shorter.'),
]


def url(speech_id):
    # GH09124-10 is speech 10 in record GH09124; Riksdagen's page anchors each speech as #anf10.
    record, number = speech_id.rsplit('-', 1)
    return f'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/protokoll/protokoll_{record}/#anf{number}'


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')


def examples():
    workers_ai.load_env()
    import os
    import requests
    session = requests.Session()
    session.headers['Authorization'] = 'Bearer ' + os.environ['CLOUDFLARE_API_TOKEN'].strip()
    vectors, tokens, neurons = workers_ai.call(session, [sv for _, sv, _ in EXAMPLES])
    workers_ai.append_ledger('debate-examples', tokens, neurons)
    write_json(TARGET / 'examples.json', {'model': workers_ai.MODEL, 'created': now(), 'examples': [
        {'id': key, 'text': sv, 'text_en': en, 'vector': np.round(v, 6).tolist()}
        for (key, sv, en), v in zip(EXAMPLES, vectors)]})
    print(f'examples: {tokens} tokens, {neurons:.3f} neurons')


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--map', default='debate', help='pick key whose layout and groups the items carry')
    parser.add_argument('--examples', action='store_true', help='also embed the three example sentences')
    args = parser.parse_args()
    if args.examples:
        examples()

    pick = json.loads((SOURCE / f'pick-{args.map}.json').read_text(encoding='utf-8'))
    layout = json.loads((SOURCE / f'layout-{args.map}.json').read_text(encoding='utf-8'))
    if layout['run_id'] != pick['run_id']:
        raise ValueError(f'{args.map}: the map was drawn for another pick')
    ids = json.loads((RUN / 'ids.json').read_text(encoding='utf-8'))
    vectors = np.load(RUN / 'vectors.npy')
    frame = (pd.DataFrame({'observation_id': ids, 'row': range(len(ids))})
             .merge(pd.read_parquet(SOURCE / f'layout-{args.map}.parquet'), on='observation_id', validate='one_to_one')
             .merge(pd.read_parquet(SOURCE / pick['variant'] / 'assignments.parquet'), on='observation_id', validate='one_to_one')
             .merge(pd.read_parquet(DATASET, columns=['observation_id', 'speech_id', 'party', 'speaker', 'year', 'context']),
                    on='observation_id', validate='one_to_one'))
    if len(frame) != len(ids):
        raise ValueError(f'{len(ids) - len(frame)} embedded passages are not on the {args.map} map')
    frame = frame.assign(order=frame.cluster.where(frame.cluster >= 0, 10**6)).sort_values(['order', 'row'], kind='stable')
    vectors = vectors[frame.row.to_numpy()]

    recall, chosen = {}, None
    for dims in (256, 384):
        fitted = workers_ai.pca(vectors, dims)
        # Five decimals keep pca.json near 3 MB at 384 dimensions; recall is measured on these values.
        fitted['components'] = np.round(fitted['components'], 5).tolist()
        fitted['scale'] = np.round(np.abs(workers_ai.project(vectors, fitted)).max(axis=0) / 127, 8).tolist()
        codes = workers_ai.quantise(vectors, fitted)
        recall[dims] = round(workers_ai.recall_at_10(vectors, fitted, codes), 4)
        print(f'PCA {dims}: recall@10 {recall[dims]}', flush=True)
        if chosen is None or recall[chosen[0]] < 0.9:
            chosen = (dims, fitted, codes)
        if recall[dims] >= 0.9:
            break
    dims, fitted, codes = chosen

    names = yaml.safe_load(NAMES.read_text(encoding='utf-8')).get('debate', {})
    names = {int(k): v for k, v in names.get('names', {}).items()} if names.get('run_id') == pick['run_id'] else {}
    write_json(TARGET / 'pca.json', fitted)
    shards = TARGET / 'shards'
    for old in shards.glob('*') if shards.exists() else []:
        old.unlink()
    item_parts, vector_parts = [], []
    for start in range(0, len(frame), ITEMS_PER_PART):
        part = frame.iloc[start:start + ITEMS_PER_PART]
        path = f'workers-ai/debate/shards/items-{start // ITEMS_PER_PART:03d}.json'
        write_json(TARGET.parents[1] / path, [
            {'id': r.observation_id, 'x': round(float(r.x), 3), 'y': round(float(r.y), 3), 'cluster': int(r.cluster),
             'party': r.party, 'speaker': r.speaker, 'year': int(r.year), 'url': url(r.speech_id), 'text': r.context}
            for r in part.itertuples()])
        item_parts.append({'path': path, 'start': start, 'count': len(part)})
    step = -(-len(codes) // VECTOR_PARTS)
    for index, start in enumerate(range(0, len(codes), step)):
        path = f'workers-ai/debate/shards/vectors-{index}.bin'
        codes[start:start + step].tofile(TARGET.parents[1] / path)
        vector_parts.append({'path': path, 'start': start, 'count': len(codes[start:start + step])})
    write_json(TARGET / 'meta.json', {
        'corpus': 'debate', 'model': workers_ai.MODEL, 'created': now(), 'n': len(frame), 'dims': dims,
        'recall_at_10': recall[dims], 'recall_at_10_by_dims': {str(k): v for k, v in recall.items()},
        'map': {'pick': args.map, 'variant': pick['variant'], 'run_id': pick['run_id']},
        'names': {str(k): v for k, v in sorted(names.items())},
        'items': item_parts, 'vectors': vector_parts,
        'note': 'items and vectors are parts of one list in the same order; ordered by cluster, noise (-1) last'})
    sizes = {p.name: p.stat().st_size for p in [TARGET / 'pca.json', TARGET / 'meta.json', *sorted(shards.glob('*'))]}
    print(json.dumps({'n': len(frame), 'dims': dims, 'recall_at_10': recall, 'bytes': sum(sizes.values()),
                      'largest': max(sizes.items(), key=lambda kv: kv[1])}))


if __name__ == '__main__':
    main()
