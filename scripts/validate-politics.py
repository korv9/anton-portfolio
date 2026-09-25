"""Check exported integrity, member totals, and the corrected budget-year regression.

Document shards live in object storage, so they are fetched from the delivery base when they
are not present locally. Everything the site serves itself is still verified byte for byte.
The authoritative hash check for remote shards is `upload-shards.py --verify-only`, which
compares every catalogued hash against the stored object.
"""
import hashlib
import json
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import delivery
from common import POLITICS as DATA, PUBLIC, raw_sha, read_json


def read(path):
    return read_json(path)


catalog = read(DATA / 'catalog.json')
local, remote = 0, 0
for entry in catalog['files']:
    relative = 'politics/' + entry['path']
    path = PUBLIC / relative
    if path.is_file():
        content = path.read_bytes()
        assert len(content) == entry['bytes'], entry['path']
        assert raw_sha(path) == entry['sha256'], entry['path']
        local += 1
    else:
        # Absent files must be shards that were deliberately moved, never silent losses.
        assert delivery.is_shard(relative), f'Missing and not a shard: {entry["path"]}'
        remote += 1

total = 0
for index in sorted((DATA / 'decisions').glob('*/index.json')):
    decisions = read(index)
    assert len({d['id'] for d in decisions}) == len(decisions)
    with ThreadPoolExecutor(max_workers=16) as pool:
        details = pool.map(lambda d: json.loads(delivery.read_bytes('politics/' + d['path'])), decisions)
    for decision, detail in zip(decisions, details):
        assert {p['party'] for p in detail['parties']} == {'C','KD','L','M','MP','S','SD','V'}
        counts = Counter((m['party'], m['vote']) for m in detail['members'])
        for party in detail['parties']:
            for field, vote in [('yes_votes','Ja'),('no_votes','Nej'),('abstain_votes','Avstår'),('absent_votes','Frånvarande')]:
                assert party[field] == counts[(party['party'],vote)], (decision['id'],party['party'],field)
        total += 1

budgets = read(PUBLIC / 'debates/budgets/summary.json')['data']
health = next(r for r in budgets if r['session']=='2025/26' and r['actor']=='S' and r['expenditure_area']==9)
assert health['budget_year']==2026 and health['government_amount_msek']==127707
assert health['amount_msek']==133393 and health['deviation_msek']==5686
engine = read(DATA / 'meaning.json')
assert engine['passed']==engine['total']==11
assert engine['validated_vote_direction_pairs']==0
print(f"Verified {local} local checksums, {remote} shards catalogued as delivered, "
      f"{total} roll-call member totals, budget-year regression and engine provenance.")
