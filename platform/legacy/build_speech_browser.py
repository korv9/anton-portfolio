"""Create lightweight discovery cards; full quotations stay in source shards.

Cards are Parquet, one part per parliamentary session under parquet/speech_cards/, served
from object storage like the other Parquet marts. discovery/index.json stays on the site: the
list of sessions, their counts and parts. As JSON the cards were 140 MB of the site's build.

    python platform/legacy/build_speech_browser.py              # from the source shards
    python platform/legacy/build_speech_browser.py --from-json  # convert the former JSON cards
"""
import json
import sys
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import common
import delivery
from parties import normalise

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / 'frontend/public/data'
SOURCE = PUBLIC / 'politics/parliament'
DISCOVERY = PUBLIC / 'discovery'
CARDS = PUBLIC / 'parquet/speech_cards'
SCHEMA = pa.schema([
    ('speech_id', pa.string()), ('speaker', pa.string()), ('speech_date', pa.string()),
    ('speech_number', pa.int32()), ('is_reply', pa.bool_()), ('party', pa.string()),
    ('kind', pa.string()), ('session', pa.string()), ('title', pa.string()),
    ('path', pa.string()), ('first', pa.int32()), ('last', pa.int32()), ('excerpt', pa.string()),
])


def read(path):
    """Shards moved to object storage, so read through delivery rather than from disk."""
    relative = Path(path).resolve().relative_to(PUBLIC.resolve()).as_posix()
    return json.loads(delivery.read_bytes(relative))["data"]


def cards_from_shards():
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
    print(f'Read {len(cache)} source files')
    return cards


def cards_from_json():
    """The cards as the previous build delivered them, one JSON file per session."""
    index = json.loads((DISCOVERY / 'index.json').read_text(encoding='utf-8'))
    return [card for entry in index for card in json.loads((DISCOVERY / entry['path']).read_text(encoding='utf-8'))]


def write(cards):
    cards.sort(key=lambda s: (s['speech_date'], s['speech_number']), reverse=True)
    for stale in CARDS.glob('session=*/part-0.parquet'):
        stale.unlink()
    manifest = []
    for session in sorted({s['session'] for s in cards}, reverse=True):
        rows = [s for s in cards if s['session'] == session]
        part = f"parquet/speech_cards/session={session.replace('/', '-')}/part-0.parquet"
        target = PUBLIC / part
        target.parent.mkdir(parents=True, exist_ok=True)
        # Snappy: the browser's reader decodes it without an extra codec. Rows stay newest
        # first, the order the browser lists them in.
        pq.write_table(pa.Table.from_pylist(rows, schema=SCHEMA), target, compression='snappy',
                       row_group_size=20000)
        manifest.append({'session': session, 'count': len(rows), 'path': part})
    for old in DISCOVERY.glob('speeches-*.json'):
        old.unlink()
    common.write_bytes_retrying(DISCOVERY / 'index.json', (json.dumps(manifest) + "\n").encode('utf-8'))
    print(f'Wrote {len(cards)} speech cards in {len(manifest)} Parquet parts; full text loaded on selection.')


if __name__ == '__main__':
    write(cards_from_json() if '--from-json' in sys.argv else cards_from_shards())
