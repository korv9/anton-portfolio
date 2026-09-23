"""Reproducible RFC profile and budget-language coverage; no model/API calls.
Dependency: snowballstemmer==3.1.1. Public text snapshots are the only inputs.
"""
import csv
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT/'packages'), str(ROOT/'.research/nlp')]
import snowballstemmer
from meaningquality.rfc import requirements, profile, drift
from meaningquality import Part, Modality, SlotChange, classify

def read(path):
    return json.loads(path.read_text(encoding='utf8'))
def write(name, data):
    path=ROOT/'public/data/reports'/name
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf8')

def rfc_report():
    versions=[]; parsed=[]
    for number in [2965,6265]:
        path=ROOT/f'data/allegoria/sources-v1/source/rfc/rfc-{number}.txt'
        rows=requirements(path.read_text(encoding='utf8')); parsed.append(rows)
        versions.append({'rfc':number,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                         'url':f'https://www.rfc-editor.org/rfc/rfc{number}',**profile(rows)})
    scenarios=[]
    for before,after in [(Modality.BINDING,Modality.WEAK),(Modality.WEAK,Modality.BINDING),(Modality.BINDING,Modality.BINDING)]:
        scenarios.append({'before':before.name,'after':after.name,'direction':classify(SlotChange.modality(Part.DUTY,before,after)).value})
    write('rfc-drift.json',{'versions':versions,'matched_changes':drift(*parsed),'scenarios':scenarios,
          'method':'Upstream meaningquality.rfc heuristic reader; first modal keyword per extracted sentence; quoted sentences skipped. Descriptive profiles are not aligned normative changes.'})

def language_report():
    lexicon=list(csv.DictReader((ROOT/'data/budget/keywords.csv').open(encoding='utf8')))
    stemmer=snowballstemmer.stemmer('swedish')
    @lru_cache(maxsize=250000)
    def stem(word): return stemmer.stemWord(word)
    exact=defaultdict(set); stems=defaultdict(set)
    for row in lexicon:
        exact[row['keyword']].add(int(row['expenditure_area']))
        stems[stem(row['keyword'])].add(int(row['expenditure_area']))
    parties=['C','KD','L','M','MP','S','SD','V']
    base=ROOT/'public/data/politics/parliament'
    output=[]; metrics=[]
    for corpus,folder in [('leaders','debates'),('issues','issues')]:
        counts=Counter(); forms=defaultdict(Counter); totals=Counter(); words=Counter(); matched=Counter(); seen=set()
        for path in sorted((base/folder).glob('*/*.json')):
            if path.name=='index.json': continue
            for speech in read(path)['data']:
                session=speech['session']; party=speech['party']; sid=speech['speech_id']
                if not '2014/15' <= session <= '2025/26' or party not in parties or sid in seen: continue
                seen.add(sid)
                text=speech['speech_text'].replace('\xad','').replace('\u200b','')
                text=re.sub(r'(?im)^\s*STYLEREF[^\n]*(?:\n|$)','\n',text)
                tokens=re.findall(r'[a-zåäöéü]+(?:-[a-zåäöéü]+)*',text.casefold())
                if len(tokens)<20: continue
                key=(session,party); totals[key]+=1; words[key]+=len(tokens)
                speech_hits=set()
                for token,n in Counter(tokens).items():
                    for method,areas in [('exact',exact.get(token,set())),('stem',stems.get(stem(token),set()))]:
                        for area in areas:
                            counts[(session,party,method,area)]+=n
                            forms[(session,party,method,area)][token]+=n
                            speech_hits.add(method)
                for method in speech_hits: matched[(*key,method)]+=1
        for session in sorted({s for s,p in totals}):
            for party in parties:
                for method in ['exact','stem']:
                    total=sum(counts[(session,party,method,a)] for a in range(1,28))
                    metrics.append({'corpus':corpus,'session':session,'party':party,'method':method,'speeches':totals[(session,party)],'words':words[(session,party)],'matched_speeches':matched[(session,party,method)],'hits':total,'zero_areas':sum(counts[(session,party,method,a)]==0 for a in range(1,28))})
                    for area in range(1,28):
                        n=counts[(session,party,method,area)]
                        output.append({'corpus':corpus,'session':session,'party':party,'method':method,'expenditure_area':area,'occurrences':n,'keyword_share_pct':round(100*n/total,4) if total else None,'forms':forms[(session,party,method,area)].most_common(8)})
        print(f'{corpus}: {sum(totals.values())} eligible speeches',flush=True)
    write('budget-language.json',{'rows':output,'coverage':metrics,'lexicon':lexicon,'stemmer':'snowballstemmer 3.1.1 / Swedish','definition':'Within-party/session share of area-assigned lexical occurrences; >=20-word speeches, two separate archives, no stance inference. All session dates, including dates after budget proposal.'})
    for corpus in ['leaders','issues']:
        group=[m for m in metrics if m['session']=='2025/26' and m['method']=='exact' and m['corpus']==corpus]
        print(corpus,'2025/26 zero cells',sum(m['zero_areas'] for m in group),'/216; hits',sum(m['hits'] for m in group),flush=True)

if __name__=='__main__':
    rfc_report()
    language_report()
    write('manifest.json', {'generator':'scripts/build-report-audits.py','dependency':'snowballstemmer==3.1.1',
      'inputs': [{'path':str(p.relative_to(ROOT)).replace('\\','/'),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [ROOT/'public/data/politics/catalog.json',ROOT/'data/budget/keywords.csv',ROOT/'scripts/build-report-audits.py']],
      'outputs':[{'path':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [ROOT/'public/data/reports/rfc-drift.json',ROOT/'public/data/reports/budget-language.json']]})
