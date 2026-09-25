"""Correct the upstream last-table selection: only parse the requested budget year."""
import importlib.util
import json
import re
from collections import defaultdict

TITLE = re.compile(r'Regeringens och (?:motionärernas|oppositionspartiernas) förslag till utgiftsramar(?:\s+för)?\s+(20\d{2})', re.I)

def repair_budget(source, output, write):
    spec = importlib.util.spec_from_file_location('upstream_budget', source / 'budget_ingest.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    coverage = json.loads((source / 'data/budget_coverage.json').read_text(encoding='utf8'))
    rows, audits = [], []
    for document in coverage['documents']:
        session = document['session']
        year = int(session[:4]) + 1
        raw = source / 'data/raw/budgets' / f'{session.replace("/", "-")}_{document["document_id"]}.html'
        html = raw.read_text(encoding='utf8')
        titles = list(TITLE.finditer(html))
        assert any(int(match[1]) == year for match in titles), f'Missing exact year {session}'
        # Preserve target-year titles and disqualify all other years before calling
        # the unchanged upstream parser. Its final match is now the correct year.
        filtered = TITLE.sub(lambda match: match[0] if int(match[1]) == year else match[0].replace('utgiftsramar', 'non_target_frames'), html)
        parsed = module.parse_document(filtered, session, document['document_id'], document['source_url'])
        totals = defaultdict(int)
        for row in parsed: totals[row['actor']] += row['amount_msek']
        for row in parsed:
            row['budget_share_pct'] = round(100 * row['amount_msek'] / totals[row['actor']], 4)
            rows.append(row)
        audits.append({'session': session, 'selected_year': year, 'upstream_selected_year': int(titles[-1][1]), 'rows': len(parsed), 'source_url': document['source_url']})
    speech = json.loads((output / 'speech-keywords-all-parties.json').read_text(encoding='utf8'))['data']
    lookup = {(r['session'],r['party'],r['expenditure_area']):r for r in speech}
    paired = []
    for row in rows:
        if row['actor'] == 'GOV': continue
        hit = lookup[(row['session'],row['actor'],row['expenditure_area'])]
        paired.append({**row, 'party': row['actor'], 'speech_keyword_occurrences': hit['occurrences'], 'speech_attention_pct': hit['keyword_share_pct'],
                       'attention_minus_budget_pp': round(hit['keyword_share_pct'] - row['budget_share_pct'],4), 'alignment_correlation': None})
    groups = defaultdict(list)
    for row in paired: groups[(row['session'], row['party'])].append(row)
    for group in groups.values():
        if len(group) != 27: continue
        xs=[r['budget_share_pct'] for r in group]; ys=[r['speech_attention_pct'] for r in group]
        ax=sum(xs)/27; ay=sum(ys)/27
        denom=(sum((x-ax)**2 for x in xs)*sum((y-ay)**2 for y in ys))**.5
        value=round(sum((x-ax)*(y-ay) for x,y in zip(xs,ys))/denom,4) if denom else None
        for row in group: row['alignment_correlation']=value
    write(output/'summary.json', {'schema_version':1, 'data':rows, 'method':'Exact budget-year table selection; upstream original preserved in politics/parliament.'})
    write(output/'speech-alignment.json', {'schema_version':1,'data':paired})
    write(output/'year-selection-audit.json', audits)
    return audits
