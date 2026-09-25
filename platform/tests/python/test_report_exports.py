import json
from collections import defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
def load(name):
    return json.loads((ROOT/'public/data/reports'/name).read_text(encoding='utf8'))

def test_language_denominators_and_coverage():
    data=load('budget-language.json')
    grouped=defaultdict(list)
    for row in data['rows']:
        grouped[tuple(row[k] for k in ['corpus','session','party','method'])].append(row)
    for coverage in data['coverage']:
        rows=grouped[tuple(coverage[k] for k in ['corpus','session','party','method'])]
        assert {r['expenditure_area'] for r in rows}==set(range(1,28))
        assert sum(r['occurrences'] for r in rows)==coverage['hits']
        assert sum(r['occurrences']==0 for r in rows)==coverage['zero_areas']
        assert coverage['matched_speeches']<=coverage['speeches']
        for row in rows:
            expected=round(100*row['occurrences']/coverage['hits'],4) if coverage['hits'] else None
            assert row['keyword_share_pct']==expected
            assert sum(n for word,n in row['forms'])<=row['occurrences']

def test_rfc_real_profiles_do_not_invent_matched_drift():
    data=load('rfc-drift.json')
    assert [r['requirements'] for r in data['versions']]==[78,47]
    assert data['matched_changes']==[]
    assert [r['direction'] for r in data['scenarios']]==['loosening','tightening','neutral']
