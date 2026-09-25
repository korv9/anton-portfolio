"""Create lightweight discovery cards; full quotations stay in source shards."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/data/politics/parliament'
read = lambda p: json.loads(p.read_text(encoding='utf-8'))['data']
entries = [('leaders', d) for d in read(SOURCE / 'debates/index.json')]
for session in read(SOURCE / 'issues/index.json'):
    entries.extend(('issues', {**d, 'session': session['session']}) for d in read(SOURCE / session['index_path']))
cache, cards = {}, []
seen = set()
for kind, debate in entries:
    path = debate['path']
    if path not in cache:
        cache[path] = read(SOURCE / path)
    for speech in cache[path]:
        number = speech['speech_number']
        if not debate.get('first_speech_number', -1) <= number <= debate.get('last_speech_number', float('inf')):
            continue
        key = (kind, speech['speech_id'])
        if key in seen:
            continue
        seen.add(key)
        cards.append({k: speech.get(k, '') for k in ['speech_id', 'speaker', 'party', 'speech_date', 'speech_number', 'is_reply']} | {
            'kind': kind, 'session': debate.get('session', ''), 'title': debate['debate_title'],
            'path': path, 'first': debate.get('first_speech_number'), 'last': debate.get('last_speech_number'),
            'excerpt': ' '.join(speech['speech_text'].split())[:260],
        })
cards.sort(key=lambda s: (s['speech_date'], s['speech_number']), reverse=True)
directory = ROOT / 'public/data/discovery'
directory.mkdir(parents=True, exist_ok=True)
manifest = []
for session in sorted({s['session'] for s in cards}, reverse=True):
    rows = [s for s in cards if s['session'] == session]
    filename = 'speeches-' + session.replace('/', '-') + '.json'
    (directory / filename).write_text(json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8', newline='\n')
    manifest.append({'session': session, 'count': len(rows), 'path': filename})
(directory / 'index.json').write_text(json.dumps(manifest) + '\n', encoding='utf-8', newline='\n')
print(f'Built {len(cards)} speech cards from {len(cache)} source files; full text loaded on selection.')
