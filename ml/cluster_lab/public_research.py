"""Frozen public-data experiments using Cluster Lab's caches, writer and run/layout engine.

python -m ml.cluster_lab.public_research prepare|pilot|run|analyze --config configs/cluster_lab/public_research.yaml
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
import itertools
from pathlib import Path
import re
import shutil

import numpy as np
import pandas as pd
import yaml

from . import datasets, evaluate, layouts
from .config import DEFAULTS, merge
from .io import ROOT, atomic_json, atomic_parquet, digest, file_hash, read_json


def passages(text, words=120, minimum=40):
    """Nonoverlapping raw character spans; short final tail joins the previous span."""
    tokens=list(re.finditer(r'\S+', text))
    spans=[tokens[i:i+words] for i in range(0,len(tokens),words)]
    if len(spans)>1 and len(spans[-1])<minimum:
        spans[-2].extend(spans.pop())
    return [(part[0].start(),part[-1].end(),len(part)) for part in spans if len(part)>=minimum]


def snapshot(frame, spec, folder, coverage, sources):
    frame=frame.sort_values('observation_id').reset_index(drop=True)
    if frame.observation_id.duplicated().any() or frame.empty:
        raise ValueError('Empty snapshot or duplicate observation IDs')
    atomic_parquet(frame,folder/'observations.parquet')
    manifest={'dataset_id':digest({'sources':sources,'rows':frame[['observation_id','text_hash']].values.tolist()})[:24],
        'dataset':spec,'path':str((folder/'observations.parquet').resolve()),
        'observations':len(frame),'ordered_ids_sha256':digest(frame.observation_id.tolist()),
        'data_sha256':file_hash(folder/'observations.parquet'),'coverage':coverage,'sources':sources}
    atomic_json(folder/'manifest.json',manifest)
    atomic_json(folder/'coverage.json',coverage)
    return manifest


def prepare(settings):
    root=Path(settings['lab']['output'])
    root.mkdir(parents=True,exist_ok=True)
    cfg=settings['research']
    for name in ['debate','welfare']:
        folder=root/'datasets'/name
        if (folder/'manifest.json').exists():
            manifest=read_json(folder/'manifest.json')
            if file_hash(manifest['path'])!=manifest['data_sha256']:
                raise ValueError('Frozen snapshot changed')
            print(name,'reusing snapshot',manifest['dataset_id'],flush=True)
            continue
        folder.mkdir(parents=True,exist_ok=True)
        if name=='debate':
            import requests
            import pyarrow.parquet as pq
            index=read_json(cfg[name]['index'])
            delivery=read_json(cfg[name]['delivery'])
            original=root/'sources/debates'
            original.mkdir(parents=True,exist_ok=True)
            def download(entry):
                target=original/(entry['id'].lower()+'.json')
                url=delivery['bases']['shard']+entry['path']
                if not target.exists():
                    response=requests.get(url,timeout=90)
                    response.raise_for_status()
                    # Validate the full response before accepting a checkpoint.
                    response.json()['data']
                    temporary=target.with_suffix('.tmp')
                    temporary.write_bytes(response.content)
                    temporary.replace(target)
                return entry,target,url
            with ThreadPoolExecutor(max_workers=4) as pool:
                downloaded=list(pool.map(download,index['leaders']))
            cards=[]
            for part in (ROOT/'frontend/public/data/parquet/speech_cards').glob('session=*/*.parquet'):
                table=pq.ParquetFile(part).read(columns=['speech_id','kind'])
                f=table.to_pandas()
                cards.extend(f.loc[f.kind.eq('leaders'),'speech_id'].tolist())
            expected=set(cards)
            speeches={}
            sources={str(path.resolve()):{'sha256':file_hash(path),'url':url} for _,path,url in downloaded}
            for entry,path,url in downloaded:
                for speech in read_json(path)['data']:
                    if speech['speech_id'] in expected:
                        speeches.setdefault(speech['speech_id'],{**speech,'source_reference':url,'debate_id':entry['id']})
            if set(speeches)!=expected:
                raise ValueError(f'Full texts differ from published leader cards: missing {len(expected-set(speeches))}')
            rows=[]
            lengths=[]
            for sid,s in sorted(speeches.items()):
                text=s['speech_text'] or ''
                lengths.append(len(text.split()))
                if s.get('party') not in ['S','M','SD','V','C','L','KD','MP']:
                    continue
                for start,end,n in passages(text,cfg[name]['passage_words'],cfg[name]['minimum_words']):
                    context=text[start:end]
                    year=int(s['speech_date'][:4])
                    rows.append({'observation_id':f'{sid}:{start}:{end}','speech_id':sid,
                        'debate_id':s['debate_id'],'document_id':s['debate_id'],'speaker':s['speaker'],
                        'author':s['speaker'],'party':s['party'],'year':year,'decade':str(year//10*10),
                        'speech_date':s['speech_date'],'session':s['session'],'title':s['debate_title'],
                        'language':'sv','char_start':start,'char_end':end,'word_count':n,
                        'speech_word_count':len(text.split()),'length_bin':str(pd.cut([len(text.split())],[0,100,300,600,1200,float('inf')],labels=False)[0]),
                        'source_reference':s['source_reference'],'context':context,'text_hash':digest(context)})
            frame=pd.DataFrame(rows)
            coverage={'scope':'all published party-leader debate cards; nonoverlapping passages from party-affiliated speeches with at least 40 words',
                'published_speeches':len(expected),'retrieved_speeches':len(speeches),'debates':len(index['leaders']),
                'passages':len(frame),'retained_speeches':frame.speech_id.nunique(),
                'years':frame.groupby('year').size().to_dict(),'parties':frame.party.value_counts().to_dict(),
                'first_date':frame.speech_date.min(),'last_publication':frame.speech_date.max(),
                'speech_words_quantiles':dict(zip(['min','q25','median','q75','max'],np.quantile(lengths,[0,.25,.5,.75,1]).tolist())),
                'repeated_exact_passages':int(frame.text_hash.duplicated().sum()),
                'source_speech_id_duplicates':len(cards)-len(expected),
                'segmentation':cfg[name],'excluded_speeches':len(expected)-frame.speech_id.nunique(),
                'text_policy':'exact duplicate source IDs deduplicated; repeated real passages retained and audited; no overlap or speaker/party prefix inserted',
                'observational_limit':'passages from one speech/debate are dependent; unit and debate/speech IDs retained'}
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.neighbors import NearestNeighbors
            audit=frame.sample(n=min(2000,len(frame)),random_state=1729).sort_values('observation_id')
            matrix=TfidfVectorizer(min_df=2,max_features=20000).fit_transform(audit.context)
            distances,neighbors=NearestNeighbors(n_neighbors=2,metric='cosine').fit(matrix).kneighbors(matrix)
            pairs=[{'left':audit.iloc[i].observation_id,'right':audit.iloc[int(neighbors[i,1])].observation_id,'similarity':float(1-distances[i,1])} for i in range(len(audit)) if distances[i,1]<=.04]
            atomic_json(folder/'near-duplicates.json',{'sample_ids':audit.observation_id.tolist(),'seed':1729,'threshold':.96,'pairs':pairs,'method':'nearest TF-IDF neighbor in a 2000-passage audit subset; no extra deduplication'})
            coverage['near_duplicate_pairs_in_audit']=len(pairs)
            shutil.copy2(cfg[name]['index'],root/'sources/debate-index.json')
            snapshot(frame,{'name':'leader-debates','adapter':'snapshot','family':'text'},folder,coverage,sources)
        else:
            panel=pd.read_json(cfg[name]['panel'],dtype={'region_code':str})
            fields=list(cfg[name]['features'])
            selected=panel.loc[panel.year.eq(cfg[name]['year'])&~panel.is_country].copy()
            before=len(selected)
            if selected.region_code.duplicated().any() or before!=21:
                raise ValueError('Expected exactly one profile for each of the 21 counties')
            missing=selected[fields].isna().sum().to_dict()
            selected=selected.dropna(subset=fields)
            for field,info in cfg[name]['features'].items():
                if info['unit']=='percent' and not selected[field].between(0,100).all():
                    raise ValueError(f'Percentage out of bounds: {field}')
            frame=selected[['region_code','region_name','year',*fields]].copy()
            frame['observation_id']=frame.region_code+':'+frame.year.astype(str)
            frame['title']=frame.region_name
            frame['text_hash']=[digest(row) for row in frame[fields].values.tolist()]
            coverage={'scope':'county profiles in one calendar year; annual Kolada measures, both sexes; no country row, monthly series or pooled survey estimates',
                'year':cfg[name]['year'],'counties_before_missingness':before,'counties':len(frame),
                'missing_by_feature':missing,'excluded_counties':selected.loc[~selected.region_code.isin(frame.region_code),'region_code'].tolist(),
                'features':cfg[name]['features'],'units_note':'units differ; equal-feature standardized distances, not a wellbeing score; indicator populations and age bands differ',
                'normalization':'StandardScaler or RobustScaler fitted only to frozen counties; float32; no L2 normalization; no imputation',
                'all_year_completeness':{str(year):group.loc[~group.is_country,fields].notna().sum().to_dict() for year,group in panel.groupby('year')},
                'published_contract_run':read_json(cfg[name]['source_run'])['dbt'],
                'other_data_excluded':'SCB unemployment has one missing county in 2024; FoHM counties are four-year estimates, FK fields are monthly-derived and not input to these profiles; ESS uses NUTS2'}
            sources={p:file_hash(p) for p in [cfg[name]['panel'],cfg[name]['indicators'],cfg[name]['source_run'], 'platform/models/gold/welfare/serving/mart_county_year_panel.sql']}
            for p in [cfg[name]['panel'],cfg[name]['indicators'],cfg[name]['source_run']]:
                shutil.copy2(p,root/'sources'/Path(p).name)
            snapshot(frame,{'name':'welfare-counties-2024','adapter':'snapshot','family':'numeric'},folder,coverage,sources)
        print(name,'snapshot prepared',len(frame),flush=True)


def trials(settings, pilot=False):
    base=merge(DEFAULTS,settings['lab'])
    for name,cfg in settings['research'].items():
        spec={'name':'leader-debates' if name=='debate' else 'welfare-counties-2024','adapter':'snapshot',
            'family':'text' if name=='debate' else 'numeric',
            'manifest':str(Path(base['output'])/'datasets'/name/'manifest.json')}
        ds=datasets.load(spec,base)
        representations=cfg['models'] if name=='debate' else [{'name':s,'kind':'numeric','numeric_scaler':s,'numeric_features':list(cfg['features']),'normalize':False} for s in cfg['scalers']]
        for representation in representations:
            c=merge(base,{'representation':{k:v for k,v in representation.items() if k!='name'},'sample_size':cfg['pilot_size'] if pilot and name=='debate' else None})
            c['datasets']=[spec]
            c['evaluation']['silhouette_metric']='cosine' if name=='debate' else 'euclidean'
            methods=[{'method':'kmeans','n_clusters':8 if pilot and name=='debate' else k} for k in cfg['kmeans_clusters']]
            methods+=[{'method':'hdbscan','min_cluster_size':10 if pilot and name=='debate' else size,'min_samples':3 if pilot and name=='debate' else cfg['min_samples']} for size in cfg['hdbscan_sizes']]
            if pilot:
                reductions=[{'method':'umap','n_neighbors':15,'n_components':5,'min_dist':.1}] if name=='debate' else [{'method':'none'}]
                seeds=[42]
            else:
                seeds=cfg['seeds']
                reductions=[{'method':'none'},{'method':'pca','n_components':20 if name=='debate' else 3}]
                # Robust scaling is a sensitivity baseline; only standard scaling is UMAP-swept.
                if name=='debate' or representation['name']=='standard':
                    reductions += [{'method':'umap','n_neighbors':n,'n_components':cfg['dimensions'],'min_dist':md,'metric':'cosine' if name=='debate' else 'euclidean'} for n,md in itertools.product(cfg['neighbors'],cfg['min_dist'])]
            for reduction,seed,method in itertools.product(reductions,seeds,methods):
                if name=='debate' and reduction['method']=='none' and method['method']=='hdbscan':
                    continue  # Avoid quadratic high-dimensional density fits; PCA baseline remains.
                patch={'reduction':reduction,'clustering':method,'seed':seed}
                yield ds,merge(c,patch),name,representation['name']


def run(settings, pilot):
    from threadpoolctl import threadpool_limits
    import torch
    from .sweep import Runner
    from .export import export
    prepare(settings)
    base=merge(DEFAULTS,settings['lab'])
    runner=Runner(base)
    frozen=Path(base['output'])/'provenance.json'
    if frozen.exists():
        saved=read_json(frozen)
        for p,h in saved['implementation_hashes'].items():
            if p.startswith('ml/cluster_lab/') and file_hash(ROOT/p)!=h:
                raise ValueError(f'Frozen experiment implementation changed: {p}')
        runner.source=saved
    else:
        atomic_json(frozen,runner.source)
        atomic_json(Path(base['output'])/'settings.json',settings)
    torch.set_num_threads(base['resources']['torch_threads'])
    attempts=list(trials(settings,pilot))
    with runner.registry.writer(),threadpool_limits(limits=base['resources']['cpu_threads']):
        for i,(ds,c,name,representation) in enumerate(attempts):
            slot=digest({'config':c,'snapshot':ds.manifest['dataset_id']})[:24]
            print(f'{i+1}/{len(attempts)} {name}/{representation} {c["reduction"]} {c["clustering"]["method"]} seed={c["seed"]}',flush=True)
            result=runner.run_one(ds,c,'pilot' if pilot else 'full','public-research',slot)
            print(result['id'],result['metrics']['cluster_count'],result['metrics']['noise_share'],result['metrics']['silhouette_original'],flush=True)
            export(runner.registry,Path(base['output'])/'gallery')
    runner.registry.close()


def analyze(settings):
    from .registry import Registry
    root=Path(settings['lab']['output'])
    registry=Registry(root)
    runs=[r for r in registry.rows('run') if r['status']=='completed']
    rows=[]
    for r in runs:
        c,m=r['config'],r['metrics']
        rows.append({'run_id':r['id'],'dataset':r['dataset'],'stage':r['stage'],'representation':c['representation']['kind'],
            'model':c['representation']['model'] if c['representation']['kind']=='embedding' else c['representation'].get('numeric_scaler') if c['representation']['kind']=='numeric' else 'tfidf_svd',
            'seed':c['seed'],'reduction':c['reduction']['method'],'neighbors':c['reduction']['n_neighbors'],
            'dimensions':c['reduction']['n_components'],'min_dist':c['reduction']['min_dist'],'algorithm':m['implementation'],
            'k':c['clustering']['n_clusters'],'mcs':r['actual_min_cluster_size'],'min_samples':c['clustering']['min_samples'],
            'n':m['observations'],'clusters':m['cluster_count'],'noise':m['noise_share'],'sizes':m['cluster_sizes'],
            'largest':m['largest_cluster_share'],'silhouette_original':m['silhouette_original']['value'],
            'silhouette_analyzed':m['silhouette_analyzed']['value'],
            **{f'ami_{k}':v['adjusted_mutual_information'] for k,v in m['dominance'].items()}})
    pd.DataFrame(rows).to_csv(root/'sweep.csv',index=False)
    comparisons=[]
    groups={}
    for r in runs:
        if r['stage']!='full':continue
        c=r['config'];key=digest({'dataset':r['dataset'],'representation':c['representation'],'reduction':c['reduction'],'clustering':c['clustering']})
        groups.setdefault(key,[]).append(r)
    with registry.writer():
        for rs in groups.values():
            for a,b in itertools.combinations(rs,2):
                stats=evaluate.stability(pd.read_parquet(Path(a['folder'])/'assignments.parquet'),pd.read_parquet(Path(b['folder'])/'assignments.parquet'))
                comparisons.append({'reference':a['id'],'candidate':b['id'],'metrics':stats})
                registry.put(digest([a['id'],b['id']])[:24],'comparison','completed',comparisons[-1])
        atomic_json(root/'stability.json',comparisons)
        # One original-space separation candidate per representation; no visual selection.
        parents={}
        for r in runs:
            if r['stage']!='full' or r['config']['seed']!=42 or r['metrics']['cluster_count']<2 or r['metrics']['noise_share']>.7 or r['metrics']['largest_cluster_share']>.8:continue
            c=r['config'];key=(r['dataset'],c['representation']['kind'],c['representation']['model'] if c['representation']['kind']=='embedding' else c['representation']['numeric_scaler'])
            score=r['metrics']['silhouette_original']['value']
            if score is not None and (key not in parents or score>parents[key][0]):parents[key]=(score,r)
        for _,r in parents.values():
            c=deepcopy(r['config'])
            if r['family']=='numeric':
                c['layouts'].update(n_neighbors=[3,7],metric='euclidean',trust_neighbors=3,trust_sample_size=21)
            for params in layouts.parameters(c):
                layouts.create(r,params,c,registry,preview=False)
        atomic_json(root/'layout-parents.json',[{'run_id':r['id'],'criterion':'maximum original-feature silhouette at seed 42, >=2 clusters, noise<=0.7, largest<=0.8; exploratory, not semantic validation'} for _,r in parents.values()])
        from .export import export
        export(registry,root/'gallery')
    registry.close()
    print('Saved sweep, seed stability and layout-only sweeps',flush=True)


class Subsample(datasets.Dataset):
    """Freeze group-held-out or leave-one-county-out IDs without copying raw text."""
    def sample(self,size,seed):
        excluded=self.spec['excluded_ids']
        frame=self.metadata.loc[~self.metadata.observation_id.isin(excluded)].copy()
        return frame,{'kind':'sample','selected':len(frame),'total':len(self.metadata),
            'method':self.spec['sample_method'],'excluded_ids':excluded,'ids_sha256':digest(frame.observation_id.tolist())}


def resample(settings):
    from .sweep import Runner
    from threadpoolctl import threadpool_limits
    from sklearn.cluster import KMeans
    from sklearn.metrics import silhouette_score
    from .export import export
    base=merge(DEFAULTS,settings['lab'])
    runner=Runner(base)
    runner.source=read_json(Path(base['output'])/'provenance.json')
    originals=[r for r in runner.registry.rows('run') if r['status']=='completed' and r['stage']=='full' and r['config']['seed']==42]
    representatives={}
    for r in originals:
        c=r['config']
        # Numeric resampling uses original-space K-means as a small-N baseline.
        if r['family']=='numeric' and (c['reduction']['method']!='none' or c['clustering']['method']!='kmeans' or c['representation']['numeric_scaler']!='standard'):
            continue
        if r['metrics']['cluster_count']<2 or r['metrics']['noise_share']>.7:continue
        key=(r['dataset'],c['representation']['kind'],c['representation']['model'] if c['representation']['kind']=='embedding' else 'baseline')
        score=r['metrics']['silhouette_original']['value']
        if score is not None and (key not in representatives or score>representatives[key][0]):representatives[key]=(score,r)
    results=[]
    with runner.registry.writer(),threadpool_limits(limits=base['resources']['cpu_threads']):
        for _,original in representatives.values():
            c=original['config']
            spec=read_json(original['dataset_manifest'])['dataset']
            spec['manifest']=original['dataset_manifest']
            ds=datasets.load(spec,c)
            if original['family']=='numeric':
                exclusions=[[oid] for oid in ds.metadata.observation_id]
                method='leave-one-county-out; refit scaler and clustering on remaining counties'
            else:
                debates=sorted(ds.metadata.document_id.unique())
                exclusions=[]
                for seed in [101,102,103]:
                    held=set(np.random.default_rng(seed).choice(debates,max(1,round(.2*len(debates))),replace=False))
                    exclusions.append(ds.metadata.loc[ds.metadata.document_id.isin(held),'observation_id'].tolist())
                method='hold out 20 percent of complete debates; no speech or passage from those debates in fitting'
            for i,excluded in enumerate(exclusions):
                child=Subsample({**ds.spec,'excluded_ids':excluded,'sample_method':method},ds.path,ds.manifest,ds.metadata)
                candidate=runner.run_one(child,c,'resample','public-research',f'{original["id"]}/resample/{i}')
                stats=evaluate.stability(pd.read_parquet(Path(original['folder'])/'assignments.parquet'),pd.read_parquet(Path(candidate['folder'])/'assignments.parquet'))
                row={'reference':original['id'],'candidate':candidate['id'],'method':method,'metrics':stats}
                runner.registry.put(digest([original['id'],candidate['id']])[:24],'comparison','completed',row)
                results.append(row)
                atomic_json(Path(base['output'])/'resample-stability.json',results)
                print('resample',i+1,len(exclusions),candidate['id'],stats,flush=True)
            if original['family']=='numeric':
                vectors=np.load(original['representation']['path'])
                k=c['clustering']['n_clusters']
                null=[]
                rng=np.random.default_rng(1729)
                for _ in range(200):
                    shuffled=np.column_stack([rng.permutation(vectors[:,j]) for j in range(vectors.shape[1])])
                    labels=KMeans(n_clusters=k,n_init=20,random_state=42).fit_predict(shuffled)
                    null.append(float(silhouette_score(shuffled,labels)))
                atomic_json(Path(base['output'])/'welfare-permutation.json',{'reference':original['id'],'actual_silhouette':original['metrics']['silhouette_original']['value'],
                    'featurewise_permutation_silhouettes':null,'seed':1729,'replications':200,
                    'interpretation':'exploratory column-independence reference for chosen baseline; not a pre-registered significance test or evidence of wellbeing classes'})
        export(runner.registry,Path(base['output'])/'gallery')
    runner.registry.close()


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('command',choices=['prepare','pilot','run','analyze','resample'])
    parser.add_argument('--config',default='configs/cluster_lab/public_research.yaml')
    args=parser.parse_args()
    settings=yaml.safe_load(Path(args.config).read_text(encoding='utf-8'))
    if args.command=='prepare':prepare(settings)
    elif args.command=='analyze':analyze(settings)
    elif args.command=='resample':resample(settings)
    else:run(settings,args.command=='pilot')


if __name__=='__main__':main()
