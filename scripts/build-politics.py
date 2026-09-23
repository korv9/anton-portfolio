"""Build static political analysis from pinned local snapshots. No model/API calls."""
import argparse
import hashlib
import json
import shutil
import sqlite3
import sys
import subprocess
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/data/politics'

def read(path):
    obj = json.loads(path.read_text(encoding='utf-8-sig'))
    return obj.get('data', obj) if isinstance(obj, dict) else obj

def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def build(parliament, allegoria, local_corpus):
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / 'parliament'
    shutil.copytree(parliament / 'portfolio-data', target, dirs_exist_ok=True)
    package = ROOT / 'packages/meaningquality'
    shutil.copytree(allegoria / 'meaningquality', package, dirs_exist_ok=True, ignore=shutil.ignore_patterns('__pycache__'))
    shutil.copy2(allegoria / 'DIRECTION.md', package / 'DIRECTION.md')
    shutil.copytree(allegoria / 'corpus', ROOT / 'data/allegoria/corpus', dirs_exist_ok=True)
    shutil.copytree(allegoria / 'data', ROOT / 'data/allegoria/sources-v1', dirs_exist_ok=True)
    shutil.copytree(local_corpus / 'data/local/pool_v2', ROOT / 'data/allegoria/sources-v2', dirs_exist_ok=True)
    sys.path.insert(0, str(ROOT / 'packages'))
    import yaml
    from meaningquality import Part, Presence, SlotChange, classify
    from meaningquality.conformance import CASES, run
    passed, total, failures = run()
    assert not failures, failures
    proposals = yaml.safe_load((allegoria / 'corpus/claims_v3_proposals.yaml').read_text(encoding='utf-8'))
    examples = []
    for item in proposals['proposals']:
        part, operation = item['operation'].split('_')
        examples.append({**item, 'direction': classify(SlotChange.whole_part(Part(part), Presence(operation))).value,
                         'annotation_status': proposals['annotation_status'], 'vote_link': None})
    write(OUT / 'meaning.json', {'passed': passed, 'total': total, 'cases': [
        {'description': desc, 'result': classify(change).value, 'expected': expected} for desc, change, expected in CASES],
        'examples': examples, 'validated_vote_direction_pairs': 0})

    law_index = []
    for pool, filename in [('v1','provisions.jsonl'), ('v2','provisions_v2.jsonl')]:
        source = local_corpus / 'data/local' / filename
        if not source.exists():
            raise FileNotFoundError(source)
        groups = defaultdict(list)
        for line in source.read_text(encoding='utf-8').splitlines():
            row = json.loads(line)
            groups[row['document_id']].append(row)
        for document_id, rows in groups.items():
            path = f'laws/{pool}/{document_id}.json'
            write(OUT / path, rows)
            first = rows[0]
            law_index.append({'id': document_id, 'pool': pool, 'title': first.get('document_title', first.get('title', document_id)),
                              'version': first.get('document_version', first.get('version', 'unknown')), 'provisions': len(rows), 'path': path})
    write(OUT / 'laws/index.json', law_index)

    database = sqlite3.connect(f'file:{parliament / "data/votes.sqlite"}?mode=ro', uri=True)
    database.row_factory = sqlite3.Row
    member_groups = defaultdict(list)
    for row in database.execute('select vote_id, member_name, member_id, party, vote from votes'):
        item = dict(row)
        member_groups[item.pop('vote_id')].append(item)
    sessions = []
    for file in sorted((target / 'sessions').glob('*/votes.json')):
        slug = file.parent.name
        votes = read(file)
        points = [row for path in file.parent.glob('decisions/*/points.json') for row in read(path)]
        citations = [row for path in file.parent.glob('decisions/*/citations.json') for row in read(path)]
        reservations = [row for path in file.parent.glob('decisions/*/reservations.json') for row in read(path)]
        by_vote = defaultdict(list)
        for row in votes:
            by_vote[row['vote_id']].append(row)
        point_map = {row['vote_id']: row for row in points if row.get('vote_id')}
        grouped_citations, grouped_reservations, grouped_speeches = defaultdict(list), defaultdict(list), defaultdict(list)
        for row in citations: grouped_citations[row['point_id']].append(row)
        for row in reservations: grouped_reservations[row['point_id']].append(row)
        for row in read(file.parent / 'decision-speech-links.json'): grouped_speeches[row['vote_id']].append(row)
        index = []
        for vote_id, rows in by_vote.items():
            first = rows[0]
            point = point_map.get(vote_id)
            pid = point['point_id'] if point else None
            detail_path = f'decisions/{slug}/{vote_id}.json'
            members = member_groups[vote_id]
            write(OUT / detail_path, {'point': point, 'parties': rows, 'members': members,
                                     'citations': grouped_citations[pid], 'reservations': grouped_reservations[pid],
                                     'speech_links': grouped_speeches[vote_id]})
            index.append({'id': vote_id, 'title': first['title'], 'heading': first['point_heading'], 'designation': first['designation'],
                          'date': first['vote_date'], 'path': detail_path, 'point': first['point'],
                          'committee': ''.join(c for c in first['designation'] if not c.isdigit()),
                          'parties': [{key: r[key] for key in ('party','party_position','yes_votes','no_votes','abstain_votes','absent_votes')} for r in rows]})
        write(OUT / f'decisions/{slug}/index.json', index)
        sessions.append({'id': votes[0]['session'], 'slug': slug, 'votes': len(index), 'points': len(points),
                         'citations': len(citations), 'reservations': len(reservations), 'path': f'decisions/{slug}/index.json'})
    database.close()
    from politics_budget import repair_budget
    budget_audit = repair_budget(parliament, ROOT/'public/data/debates/budgets', write)
    write(OUT/'budget-year-audit.json', budget_audit)
    write(OUT / 'overview.json', {'parliament': read(target / 'overview.json'), 'sessions': sessions,
                                 'law_pools': {pool: {'documents': sum(r['pool']==pool for r in law_index), 'provisions': sum(r['provisions'] for r in law_index if r['pool']==pool)} for pool in ['v1','v2']},
                                 'meaning_tests': {'passed': passed, 'total': total}, 'validated_vote_direction_pairs': 0})
    files = [{'path': str(path.relative_to(OUT)).replace('\\','/'), 'bytes': path.stat().st_size, 'sha256': digest(path)}
             for path in sorted(OUT.rglob('*')) if path.is_file() and path.name != 'catalog.json']
    write(OUT / 'catalog.json', {'schema_version': 1, 'sources': [
        {'repository': 'https://github.com/korv9/partiledardebatt-analys', 'revision': subprocess.check_output(['git','-C',str(parliament),'rev-parse','HEAD'],text=True).strip()},
        {'repository': 'https://github.com/korv9/allegoria', 'revision': subprocess.check_output(['git','-C',str(allegoria),'rev-parse','HEAD'],text=True).strip()}],
        'local_corpus_note': 'v1/v2 provision snapshots from local Allegoria; original source hashes and versions preserved per row.', 'files': files})
    print(f'Built {len(files)} files, {sum(f["bytes"] for f in files):,} bytes; {len(law_index)} law snapshots; {sum(s["votes"] for s in sessions)} roll calls; engine {passed}/{total}.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--parliament', type=Path, required=True)
    parser.add_argument('--allegoria', type=Path, required=True)
    parser.add_argument('--local-corpus', type=Path, required=True)
    args = parser.parse_args()
    build(args.parliament, args.allegoria, args.local_corpus)
