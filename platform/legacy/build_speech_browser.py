"""Create lightweight discovery cards; full quotations stay in source shards."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import common
import delivery
from parties import normalise

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'frontend/public/data/politics/parliament'
def read(path):
    """Shards moved to object storage, so read through delivery rather than from disk."""
    relative = Path(path).resolve().relative_to((ROOT / "frontend/public/data").resolve()).as_posix()
    return json.loads(delivery.read_bytes(relative))["data"]
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
        cards.append({k: speech.get(k, '') for k in ['speech_id', 'speaker', 'speech_date', 'speech_number', 'is_reply']} | {
            'party': normalise(speech.get('party')),
            'kind': kind, 'session': debate.get('session', ''), 'title': debate['debate_title'],
            'path': path, 'first': debate.get('first_speech_number'), 'last': debate.get('last_speech_number'),
            'excerpt': ' '.join(speech['speech_text'].split())[:260],
        })
cards.sort(key=lambda s: (s['speech_date'], s['speech_number']), reverse=True)
directory = ROOT / 'frontend/public/data/discovery'
directory.mkdir(parents=True, exist_ok=True)
manifest = []
for session in sorted({s['session'] for s in cards}, reverse=True):
    rows = [s for s in cards if s['session'] == session]
    filename = 'speeches-' + session.replace('/', '-') + '.json'
    payload = json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + "\n"
    common.write_bytes_retrying(directory / filename, payload.encode('utf-8'))
    manifest.append({'session': session, 'count': len(rows), 'path': filename})
common.write_bytes_retrying(directory / 'index.json', (json.dumps(manifest) + "\n").encode('utf-8'))
print(f'Built {len(cards)} speech cards from {len(cache)} source files; full text loaded on selection.')
