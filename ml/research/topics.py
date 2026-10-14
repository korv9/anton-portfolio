"""Subject clusters in the party-leader debates and in philosophy: prepare, search, refine, repeat.

python -m ml.research.topics prepare|search|finalists|layouts --config configs/cluster_lab/public_topics.yaml [--only debate]

prepare    frozen snapshots: debate speeches cleaned of protocol text and cut at sentence ends;
           philosophy works cut into the Atlas's passages, at most `per_document` per work.
search     one seed: every centering, UMAP and HDBSCAN setting, ranked by evaluate.score (density
           validity, noise, largest group, how far the groups follow the speaker or work).
finalists  the best settings run through Cluster Lab's Runner with merge and noise reassignment,
           on every seed; the pick is the best mean score among those stable across seeds.
layouts    2-D maps of the pick; labels are inputs and are never refitted.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
import itertools
import json
from pathlib import Path
import re
import sys

import numpy as np
import pandas as pd
import yaml

from ml.cluster_lab import datasets, evaluate, layouts, representations
from ml.cluster_lab.config import DEFAULTS, merge
from ml.cluster_lab.io import ROOT, atomic_json, digest, file_hash, now, read_json
from ml.cluster_lab.public_research import snapshot
from ml.research.prepare_public_profiles import clean

# What the protocol adds around the spoken words: the address to the Speaker, applause and
# other bracketed notes, the list of members who endorsed the speech, and procedure lines.
PROTOCOL=re.compile(r'\((?:Applåd(?:er)?\.?|Meningsyttringar[^)]*|forts\.[^)]*|TALMANNEN:[^)]*)\)'
    r'|\b(?:Herr|Fru)\s+(?:(?:förste|andre|tredje)\s+vice\s+|ålders)?talman[!.,]?'
    r'|Partiledardebatten var härmed avslutad\.|Förhandlingarna (?:återupptogs|ajournerades)[^.\n]*\.',re.I)
ENDORSED=re.compile(r'I detta anförande instämde.*',re.S)
SENTENCE=re.compile(r'(?<=[.!?])\s+(?=[A-ZÅÄÖ"”(])')


def spoken(text):
    return clean(PROTOCOL.sub(' ',ENDORSED.sub('',text)))


def sentence_passages(text,low=80,high=150,minimum=40):
    """Whole sentences, closed at `low` words and before passing `high`; a short tail joins the last."""
    out,current,words=[],[],0
    for sentence in SENTENCE.split(text):
        n=len(sentence.split())
        if current and words+n>high:
            out.append(current)
            current,words=[],0
        current.append(sentence)
        words+=n
        if words>=low:
            out.append(current)
            current,words=[],0
    if current:
        if out and words<minimum:
            out[-1].extend(current)
        else:
            out.append(current)
    return [text for text in (' '.join(part) for part in out) if len(text.split())>=minimum]


def joined(parts,words):
    """Consecutive passages joined until each has at least `words` words; a short tail joins the last."""
    out,current=[],[]
    for part in parts:
        current.append(part)
        if sum(len(p.split()) for p in current)>=words:
            out.append(' '.join(current))
            current=[]
    if current:
        out[-1:]=[' '.join(out[-1:]+current)]
    return out


def prepare_debate(cfg,folder):
    source=Path(cfg['sources'])
    frozen=pd.read_parquet(source/'datasets/debate/observations.parquet')
    speeches=frozen.drop_duplicates('speech_id').set_index('speech_id')
    texts={}
    for path in sorted((source/'sources/debates').glob('*.json')):
        for speech in read_json(path)['data']:
            if speech['speech_id'] in speeches.index:
                texts.setdefault(speech['speech_id'],speech['speech_text'] or '')
    if set(texts)!=set(speeches.index):
        raise ValueError('Raw debate files do not cover the frozen speech list')
    low,high=cfg['passage_words']
    rows=[]
    for sid,s in speeches.iterrows():
        for i,context in enumerate(sentence_passages(spoken(texts[sid]),low,high,cfg['minimum_words'])):
            rows.append({'observation_id':f'{sid}:s{i}','speech_id':sid,'position':i,
                **{k:s[k] for k in ('debate_id','document_id','speaker','author','party','year','decade',
                    'speech_date','session','title','language','speech_word_count','length_bin','source_reference')},
                'word_count':len(context.split()),'context':context,'text_hash':digest(context)})
    frame=pd.DataFrame(rows)
    coverage={'scope':'party-leader debates; protocol text removed; passages of whole sentences from party-affiliated speeches',
        'debates':int(frame.debate_id.nunique()),'speeches_in_frozen_list':len(speeches),
        'retained_speeches':int(frame.speech_id.nunique()),'passages':len(frame),
        'segmentation':{'unit':'sentences','close_at_words':low,'never_pass_words':high,'minimum_words':cfg['minimum_words']},
        'passage_words_quantiles':dict(zip(['min','q25','median','q75','max'],np.quantile(frame.word_count,[0,.25,.5,.75,1]).tolist())),
        'removed':'address to the Speaker, bracketed protocol notes, endorsement lists, procedure lines, Word fields',
        'first_date':frame.speech_date.min(),'last_date':frame.speech_date.max(),
        'parties':frame.party.value_counts().to_dict(),
        'repeated_exact_passages':int(frame.text_hash.duplicated().sum()),
        'observational_limit':'passages from one speech or debate are dependent observations'}
    sources={'frozen_speech_list':read_json(source/'datasets/debate/manifest.json')['data_sha256'],
        'raw_debates':digest(sorted(file_hash(p) for p in (source/'sources/debates').glob('*.json'))),
        'code':file_hash(Path(__file__))}
    return snapshot(frame,{'name':'leader-debates','adapter':'snapshot','family':'text'},folder,coverage,sources)


def prepare_philosophy(cfg,folder):
    for part in ('symbolic','philosophy'):
        sys.path.insert(0,str(ROOT/'platform/nlp'/part))
    from cleaning import clean_document
    from passages import own_text, passages
    raw=Path(cfg['raw'])
    rows,failed=[],[]
    documents=[d for name in cfg['corpora'] for d in read_json(name)['documents']]
    for d in documents:
        try:
            text,_,_=own_text((raw/'gutenberg'/f'{d["id"]}.txt').read_text(encoding='utf-8'),d.get('text_start'),d.get('text_end'))
            parts=passages(clean_document(text,{'document_id':d['id']}).structured)
            if cfg.get('join_words'):
                parts=joined(parts,cfg['join_words'])
        except (OSError,ValueError,StopIteration) as error:
            failed.append(f'{d["id"]}: {error}')
            continue
        # The Atlas's balanced sample: evenly spaced, so a long work cannot outnumber a short one.
        keep=np.unique(np.linspace(0,len(parts)-1,min(len(parts),cfg['per_document'])).round().astype(int))
        for i in keep:
            rows.append({'observation_id':f'{d["id"]}:{i}','document_id':d['id'],'position':int(i),
                'title':d['title'],'author':d['author'],'translator':d.get('translator') or '',
                'tradition':d['tradition'],'period':d['period'],'area':d['area'],'year':d['year'],
                'language':'en','passages_in_work':len(parts),'word_count':len(parts[i].split()),
                'context':parts[i],'text_hash':digest(parts[i])})
    if failed:
        raise ValueError('Works missing or without own-text markers:\n'+'\n'.join(failed))
    frame=pd.DataFrame(rows)
    works=frame.drop_duplicates('document_id')
    coverage={'scope':'public-domain philosophy in English from Project Gutenberg; the author\'s own text, cleaned and cut into passages',
        'works':len(works),'authors':int(works.author.nunique()),'passages':len(frame),
        'per_document':cfg['per_document'],'join_words':cfg.get('join_words'),'works_by_tradition':works.tradition.value_counts().to_dict(),
        'works_by_period':works.period.value_counts().to_dict(),
        'works_with_named_translator':int(works.translator.ne('').sum()),
        'authors_with_two_translators':int((works[works.translator.ne('')].groupby('author').translator.nunique()>1).sum()),
        'repeated_exact_passages':int(frame.text_hash.duplicated().sum()),
        'observational_limit':'passages from one work are dependent; tradition and area are coarse labels'}
    sources={**{name:file_hash(name) for name in cfg['corpora']},
        'texts':digest(sorted(file_hash(raw/'gutenberg'/f'{d["id"]}.txt') for d in documents)),'code':file_hash(Path(__file__))}
    return snapshot(frame,{'name':'philosophy-works','adapter':'snapshot','family':'text'},folder,coverage,sources)


PREPARE={'debate':prepare_debate,'philosophy':prepare_philosophy}
NAMES={'debate':'leader-debates','philosophy':'philosophy-works'}


def prepare(settings,only):
    root=Path(settings['lab']['output'])
    for name,cfg in settings['research'].items():
        folder=root/'datasets'/name
        if only and name!=only:
            continue
        if (folder/'manifest.json').exists():
            manifest=read_json(folder/'manifest.json')
            if file_hash(manifest['path'])!=manifest['data_sha256']:
                raise ValueError('Frozen snapshot changed')
            print(name,'reusing snapshot',manifest['dataset_id'],flush=True)
            continue
        folder.mkdir(parents=True,exist_ok=True)
        manifest=PREPARE[name](cfg,folder)
        print(name,'snapshot prepared',manifest['observations'],json.dumps(manifest['coverage'],ensure_ascii=False)[:600],flush=True)


def load(settings,name):
    base=merge(DEFAULTS,settings['lab'])
    spec={'name':NAMES[name],'adapter':'snapshot','family':'text',
        'manifest':str(Path(base['output'])/'datasets'/name/'manifest.json')}
    base['datasets']=[spec]
    return datasets.load(spec,base),base


def representation_configs(base,cfg):
    for model,centering in itertools.product(cfg['models'],cfg['centering']):
        yield merge(base,{'representation':{'kind':'embedding','model':model['model'],
            'revision':model['revision'],'centering':centering}})


def reduced(vectors,representation,config):
    space,info=representations.reduce(vectors,representation,config)
    # The cache also keeps each fitted UMAP model (a few hundred MB) and nothing reads it back.
    (Path(info['path']).parent/'model.joblib').unlink(missing_ok=True)
    return np.asarray(space)


def selections(cfg,n):
    """HDBSCAN's ways of choosing groups from the tree: eom, eom with a size cap, leaf, leaf with epsilon."""
    for option in cfg['selection']:
        yield {'cluster_selection_method':option['method'],
            'cluster_selection_epsilon':option.get('epsilon',0.0),
            'max_cluster_size':round(option['max_share']*n) if option.get('max_share') else None}


def search(settings,only):
    from hdbscan import HDBSCAN
    from threadpoolctl import threadpool_limits
    for name,cfg in settings['research'].items():
        if only and name!=only:
            continue
        ds,base=load(settings,name)
        frame,_=ds.sample(None,42)
        path=Path(base['output'])/f'search-{name}.csv'
        # An interrupted search continues: a UMAP space already in the table is not fitted again.
        table=pd.read_csv(path) if path.exists() else pd.DataFrame()
        rows=table.to_dict('records')
        with threadpool_limits(limits=base['resources']['cpu_threads']):
            for c in representation_configs(base,cfg):
                vectors,representation=representations.build(ds,frame,c,lambda:None)
                for neighbors,dimensions in itertools.product(cfg['neighbors'],cfg['dimensions']):
                    c['reduction']={**c['reduction'],'method':'umap','n_neighbors':neighbors,
                        'n_components':dimensions,'min_dist':0.0,'metric':'cosine'}
                    c['seed']=cfg['seeds'][0]
                    if not table.empty and ((table.model==c['representation']['model'])&(table.centering==c['representation']['centering'])
                            &(table.n_neighbors==neighbors)&(table.dimensions==dimensions)).any():
                        continue
                    space=reduced(vectors,representation,c)
                    for size,samples,selection in itertools.product(cfg['min_cluster_size'],cfg['min_samples'],selections(cfg,len(frame))):
                        model=HDBSCAN(min_cluster_size=size,min_samples=samples,gen_min_span_tree=True,core_dist_n_jobs=1,
                            cluster_selection_method=selection['cluster_selection_method'],
                            cluster_selection_epsilon=selection['cluster_selection_epsilon'],
                            max_cluster_size=selection['max_cluster_size'] or 0).fit(space)
                        labels=model.labels_.astype(int)
                        kept=labels>=0
                        metrics={'cluster_count':int(labels.max()+1),'noise_share':float(1-kept.mean()),
                            'largest_cluster_share':float(np.bincount(labels[kept]).max()/len(labels)) if kept.any() else 0.0,
                            'dbcv':evaluate.dbcv(model),'silhouette_original':{'value':None},
                            'dominance':evaluate.dominance(frame,labels) if kept.any() else {}}
                        rows.append({'model':c['representation']['model'],'centering':c['representation']['centering'],
                            'n_neighbors':neighbors,'dimensions':dimensions,'min_cluster_size':size,'min_samples':samples,
                            **selection,'clusters':metrics['cluster_count'],'noise':metrics['noise_share'],
                            'largest':metrics['largest_cluster_share'],'dbcv':metrics['dbcv'].get('value'),
                            **{f'ami_{k}':v['adjusted_mutual_information'] for k,v in metrics['dominance'].items()},
                            'score':evaluate.score(metrics,base['sweep']['selection'])})
                    pd.DataFrame(rows).to_csv(path,index=False)
                    print(name,c['representation']['model'].split('/')[-1],c['representation']['centering'],neighbors,dimensions,
                        'best so far',round(max(r['score'] for r in rows),3),flush=True)


def shortlist(table,cfg):
    """Best-scoring settings within the wanted number of groups and largest-group share, one per UMAP space."""
    low,high=cfg['clusters']
    wanted=table[table.clusters.between(low,high)&(table.largest<=cfg['max_largest'])].sort_values('score',ascending=False)
    spaces=wanted.drop_duplicates(['model','centering','n_neighbors','dimensions'])
    return pd.concat([spaces,wanted]).drop_duplicates().head(cfg['finalists'])


def finalists(settings,only,new_runs=None):
    """`new_runs` ends the process (exit 3) after that many fresh runs, so memory is returned between them."""
    from threadpoolctl import threadpool_limits
    import torch
    from ml.cluster_lab.export import export
    from ml.cluster_lab.sweep import Runner
    for name,cfg in settings['research'].items():
        if only and name!=only:
            continue
        ds,base=load(settings,name)
        root=Path(base['output'])
        runner=Runner(base)
        torch.set_num_threads(base['resources']['torch_threads'])
        table=pd.read_csv(root/f'search-{name}.csv')
        table=table.astype(object).where(table.notna(),None)
        # Without a size cap eom keeps one giant group on some seeds; no group may pass max_largest.
        cap=round(cfg['max_largest']*len(ds.sample(None,42)[0]))
        results,began,fresh=[],now(),0
        with runner.registry.writer(),threadpool_limits(limits=base['resources']['cpu_threads']):
            for rank,row in enumerate(shortlist(table,cfg).to_dict('records')):
                c=merge(base,{'representation':{'kind':'embedding','model':row['model'],'centering':row['centering'],
                        'revision':next(m['revision'] for m in cfg['models'] if m['model']==row['model'])},
                    'reduction':{'method':'umap','n_neighbors':int(row['n_neighbors']),'n_components':int(row['dimensions']),
                        'min_dist':0.0,'metric':'cosine'},
                    'clustering':{'method':'hdbscan','min_cluster_size':int(row['min_cluster_size']),
                        'min_samples':int(row['min_samples']),'cluster_selection_method':row['cluster_selection_method'],
                        'cluster_selection_epsilon':float(row['cluster_selection_epsilon']),
                        'max_cluster_size':int(row['max_cluster_size'] or cap),
                        'merge_similarity':cfg['merge_similarity'],'reassign_quantile':cfg['reassign_quantile'],
                        'reassign_margin':cfg['reassign_margin']}})
                runs=[]
                for seed in cfg['seeds']:
                    if new_runs and fresh>=new_runs:
                        sys.exit(3)
                    runs.append(runner.run_one(ds,merge(c,{'seed':seed}),'full','public-topics',f'{name}/{rank}/{seed}'))
                    fresh+=runs[-1]['started_at']>=began
                for run in runs:
                    (Path(run['reduction']['path']).parent/'model.joblib').unlink(missing_ok=True)
                pairs=[evaluate.stability(pd.read_parquet(Path(a['folder'])/'assignments.parquet'),
                    pd.read_parquet(Path(b['folder'])/'assignments.parquet')) for a,b in itertools.combinations(runs,2)]
                ari=float(np.mean([p['including_noise_as_one_group']['adjusted_rand'] for p in pairs]))
                scores=[evaluate.score(r['metrics'],base['sweep']['selection']) for r in runs]
                results.append({'rank':rank,'run_ids':[r['id'] for r in runs],'search_row':row,
                    'clusters':[r['metrics']['cluster_count'] for r in runs],
                    'noise':[r['metrics']['noise_share'] for r in runs],
                    'largest':[r['metrics']['largest_cluster_share'] for r in runs],
                    'dbcv':[r['metrics']['dbcv']['value'] for r in runs],
                    'held_out_precision':[r['metrics']['refinement'].get('reassigned',{}).get('held_out_precision') for r in runs],
                    'mean_score':float(np.mean(scores)),'seed_ari_with_noise':ari,
                    'seed_ari_assigned':float(np.mean([p['excluding_noise_in_either']['adjusted_rand'] for p in pairs]))})
                atomic_json(root/f'finalists-{name}.json',results)
                print(name,'finalist',rank,json.dumps({k:results[-1][k] for k in ('clusters','noise','largest','dbcv','mean_score','seed_ari_with_noise')}),flush=True)
            stable=[r for r in results if r['seed_ari_with_noise']>=cfg['min_seed_ari']]
            pick=max(stable,key=lambda r:r['mean_score']) if stable else max(results,key=lambda r:r['seed_ari_with_noise'])
            atomic_json(root/f'pick-{name}.json',{**pick,'run_id':pick['run_ids'][0],
                'stable':bool(stable),
                'criterion':f'highest mean evaluate.score among finalists with seed ARI >= {cfg["min_seed_ari"]}, '
                    'or the highest seed ARI when none reaches it; the run shown is the first seed'})
            export(runner.registry,root/'gallery')
        runner.registry.close()


def make_layouts(settings,only):
    from ml.cluster_lab.export import export
    from ml.cluster_lab.registry import Registry
    for name in settings['research']:
        if only and name!=only:
            continue
        _,base=load(settings,name)
        root=Path(base['output'])
        registry=Registry(root)
        run=registry.get(read_json(root/f'pick-{name}.json')['run_id'])
        with registry.writer():
            for params in layouts.parameters(deepcopy(run['config'])):
                layout=layouts.create(run,params,run['config'],registry,preview=False)
                print(name,'layout',layout['id'],params['n_neighbors'],params['min_dist'],layout.get('trustworthiness'),flush=True)
            export(registry,root/'gallery')
        registry.close()


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('command',choices=['prepare','search','finalists','layouts'])
    parser.add_argument('--config',default='configs/cluster_lab/public_topics.yaml')
    parser.add_argument('--only',choices=list(PREPARE))
    parser.add_argument('--new-runs',type=int,help='finalists: stop with exit code 3 after this many fresh runs')
    args=parser.parse_args()
    settings=yaml.safe_load(Path(args.config).read_text(encoding='utf-8'))
    if args.command=='finalists':
        return finalists(settings,args.only,args.new_runs)
    {'prepare':prepare,'search':search,'layouts':make_layouts}[args.command](settings,args.only)


if __name__=='__main__':main()
