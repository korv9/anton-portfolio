"""Check exported integrity, member totals, and the corrected budget-year regression."""
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'public/data/politics'
def read(path):
    return json.loads(path.read_text(encoding='utf8'))

catalog = read(DATA / 'catalog.json')
for entry in catalog['files']:
    content = (DATA / entry['path']).read_bytes()
    assert len(content) == entry['bytes'], entry['path']
    assert hashlib.sha256(content).hexdigest() == entry['sha256'], entry['path']

total = 0
for index in (DATA / 'decisions').glob('*/index.json'):
    decisions = read(index)
    assert len({d['id'] for d in decisions}) == len(decisions)
    for decision in decisions:
        detail = read(DATA / decision['path'])
        assert {p['party'] for p in detail['parties']} == {'C','KD','L','M','MP','S','SD','V'}
        counts = Counter((m['party'], m['vote']) for m in detail['members'])
        for party in detail['parties']:
            for field, vote in [('yes_votes','Ja'),('no_votes','Nej'),('abstain_votes','Avstår'),('absent_votes','Frånvarande')]:
                assert party[field] == counts[(party['party'],vote)], (decision['id'],party['party'],field)
        total += 1

budgets = read(ROOT / 'public/data/debates/budgets/summary.json')['data']
health = next(r for r in budgets if r['session']=='2025/26' and r['actor']=='S' and r['expenditure_area']==9)
assert health['budget_year']==2026 and health['government_amount_msek']==127707
assert health['amount_msek']==133393 and health['deviation_msek']==5686
engine = read(DATA / 'meaning.json')
assert engine['passed']==engine['total']==11
assert engine['validated_vote_direction_pairs']==0
print(f"Verified {len(catalog['files'])} checksums, {total} roll-call member totals, budget-year regression and engine provenance.")
