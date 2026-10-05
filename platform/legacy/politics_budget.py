"""The budget frames: every opposition party's proposal against the government's, per
expenditure area and year, from the Finance Committee's annual report (FiU1).

Parsed with platform/ingest/riksdagen/budget_ingest.py, which reads the table for the exact
budget year, joins tables that run over a page break, repairs figures the HTML export split,
and refuses a year whose columns do not add up to the committee's own total. The coverage file
records that total and how the Riksdag decided the frames, so the site can show both.

Run on its own to refresh the budget exports from riksdagen.se:
``python platform/legacy/politics_budget.py``; then rebuild the gold layer.
"""
import argparse
import importlib.util
import json
import re
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TITLE = re.compile(r'Regeringens och (?:motionärernas|oppositionspartiernas) förslag till utgiftsramar(?:\s+för)?\s+(20\d{2})', re.I)
OUTPUT = ROOT / 'frontend/public/data/debates/budgets'
INGEST = ROOT / 'platform/ingest/riksdagen/budget_ingest.py'


def parser():
    spec = importlib.util.spec_from_file_location('budget_ingest', INGEST)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def frame_decision(status: dict) -> dict | None:
    """How the chamber decided the frames, from the report's document status: the winner is
    "utskottet" (the committee's proposal, which backs the government's frames) or the
    reservation that won, with the parties behind that reservation."""
    proposals = status.get('dokutskottsforslag', {}).get('utskottsforslag', [])
    if isinstance(proposals, dict):
        proposals = [proposals]
    for proposal in proposals:
        if (proposal.get('rubrik') or '').startswith('Rambeslutet'):
            winner = proposal.get('vinnare')
            if not winner:
                return None
            won_by_reservation = (winner.startswith('reservation')
                                  and winner.split()[-1] == str(proposal.get('motforslag_nummer')))
            parties = re.findall(r'[A-ZÅÄÖ]+', proposal.get('motforslag_partier') or '') if won_by_reservation else []
            return {'winner': winner, 'reservation_parties': parties,
                    'vote_url': proposal.get('votering_url_xml')}
    return None


def repair_budget(source, output, write, raw_dir=None, statuses=None):
    """Write the budget exports from the FiU1 reports listed in the coverage file.

    ``source`` is the upstream checkout (raw HTML under data/raw/budgets); ``raw_dir``
    overrides where the HTML is read from. ``statuses`` maps a document id to its riksdagen
    document status, used to record the frame decision."""
    module = parser()
    coverage_path = source / 'data/budget_coverage.json' if source else output / 'coverage.json'
    coverage = json.loads(coverage_path.read_text(encoding='utf8'))
    raw_dir = raw_dir or source / 'data/raw/budgets'
    # A rebuild without fresh document statuses keeps the decisions recorded earlier.
    earlier_path = output / 'coverage.json'
    earlier = ({d['document_id']: d for d in json.loads(earlier_path.read_text(encoding='utf8'))['documents']}
               if earlier_path.exists() else {})
    rows, audits, documents = [], [], []
    for document in coverage['documents']:
        session = document['session']
        year = int(session[:4]) + 1
        raw = raw_dir / f'{session.replace("/", "-")}_{document["document_id"]}.html'
        html = raw.read_text(encoding='utf-8-sig')
        titles = [int(m[1]) for m in TITLE.finditer(html)]
        assert year in titles, f'Missing exact year {session}'
        parsed = module.parse_document(html, session, document['document_id'], document['source_url'])
        totals = defaultdict(int)
        for row in parsed:
            totals[row['actor']] += row['amount_msek']
        for row in parsed:
            row['budget_share_pct'] = round(100 * row['amount_msek'] / totals[row['actor']], 4)
            rows.append(row)
        audits.append({'session': session, 'selected_year': year, 'upstream_selected_year': titles[-1],
                       'rows': len(parsed), 'source_url': document['source_url']})
        status = (statuses or {}).get(document['document_id'])
        documents.append({**{k: document[k] for k in ('session', 'document_id', 'source_url')},
                          'rows': len(parsed),
                          'totals_msek': module.budget_totals(html, session),
                          'frame_decision': (frame_decision(status) if status
                                             else earlier.get(document['document_id'], {}).get('frame_decision'))})
    speech = json.loads((output / 'speech-keywords-all-parties.json').read_text(encoding='utf8'))['data']
    lookup = {(r['session'], r['party'], r['expenditure_area']): r for r in speech}
    paired = []
    for row in rows:
        if row['actor'] == 'GOV':
            continue
        hit = lookup[(row['session'], row['actor'], row['expenditure_area'])]
        paired.append({**row, 'party': row['actor'], 'speech_keyword_occurrences': hit['occurrences'], 'speech_attention_pct': hit['keyword_share_pct'],
                       'attention_minus_budget_pp': round(hit['keyword_share_pct'] - row['budget_share_pct'], 4), 'alignment_correlation': None})
    groups = defaultdict(list)
    for row in paired:
        groups[(row['session'], row['party'])].append(row)
    for group in groups.values():
        if len(group) != 27:
            continue
        xs = [r['budget_share_pct'] for r in group]
        ys = [r['speech_attention_pct'] for r in group]
        ax = sum(xs) / 27
        ay = sum(ys) / 27
        denom = (sum((x - ax) ** 2 for x in xs) * sum((y - ay) ** 2 for y in ys)) ** .5
        value = round(sum((x - ax) * (y - ay) for x, y in zip(xs, ys)) / denom, 4) if denom else None
        for row in group:
            row['alignment_correlation'] = value
    write(output / 'summary.json', {'schema_version': 1, 'data': rows, 'method': 'Exact budget-year table selection; upstream original preserved in politics/parliament.'})
    write(output / 'speech-alignment.json', {'schema_version': 1, 'data': paired})
    write(output / 'year-selection-audit.json', audits)
    write(output / 'coverage.json', {**coverage, 'documents': documents, 'rows': len(rows)})
    return audits


def main():
    arguments = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    arguments.add_argument('--raw', type=Path, default=ROOT / 'platform/.cache/budgets',
                           help='Where the FiU1 reports are kept between runs')
    arguments.add_argument('--refresh', action='store_true', help='Download the reports again')
    options = arguments.parse_args()
    module = parser()
    coverage = json.loads((OUTPUT / 'coverage.json').read_text(encoding='utf8'))
    options.raw.mkdir(parents=True, exist_ok=True)
    statuses = {}
    for document in coverage['documents']:
        path = options.raw / f'{document["session"].replace("/", "-")}_{document["document_id"]}.html'
        if options.refresh or not path.exists():
            path.write_bytes(module.download(document['source_url']))
        status_url = f'https://data.riksdagen.se/dokumentstatus/{document["document_id"]}.json'
        with urllib.request.urlopen(urllib.request.Request(status_url, headers={'User-Agent': 'anton-portfolio'}), timeout=120) as response:
            statuses[document['document_id']] = json.loads(response.read().decode('utf-8-sig'))['dokumentstatus']
    sys.path.insert(0, str(ROOT / 'platform/lib'))
    import common

    def write(path, data):
        payload = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        common.write_bytes_retrying(path, payload)

    audits = repair_budget(None, OUTPUT, write, raw_dir=options.raw, statuses=statuses)
    print(json.dumps(audits, ensure_ascii=False))


if __name__ == '__main__':
    main()
