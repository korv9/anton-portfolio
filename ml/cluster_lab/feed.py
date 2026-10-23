"""Small validated clusterings for the "What does it even mean?" feed.

One YAML entry per clustering: a DuckDB query (or existing vectors) gives one row per entity,
or per entity and period, then one method, the same diagnostics for every method, and one
compact JSON per clustering. Diagnostics: original-space silhouette, subsample ARI, a null
model and AMI against a known label. A result is a finding only when it beats the null and is
stable; otherwise the export says exploratory or descriptive.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
import gc
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

from .config import merge, set_value
from .io import ROOT, atomic_json, atomic_parquet, digest, now, provenance
from .limits import guard

DEFAULTS={'schema_version':1,'output':'{warehouse}/features/clusters','publish':'frontend/public/data/clusters',
    'warehouse':'warehouse','resources':{'cpu_threads':2,'memory_gb':1.5,'duckdb_memory_gb':1},
    'validation':{'resamples':100,'subsample':0.8,'nulls':200,'min_ari':0.6,'alpha':0.05,'seed':1729,
        'silhouette_sample':5000,'points':3000,'min_entities':50,'max_bytes':300000},
    'clusterings':[]}
ENTRY={'name':None,'family':None,'title':None,'query':None,'vectors':None,'ids':None,'id':None,'label':None,
    'period':None,'reference':None,'features':None,'transform':'zscore','pca':None,'method':'kmeans',
    'k':[2,8],'min_cluster_size':20,'min_samples':5,'resample':'rows','nulls':None,'resamples':None,
    'layout':'pca','note':None}
METHODS={'kmeans','gmm','ward','average','chain','cocluster','hdbscan'}
TRANSFORMS={'none','zscore','clr'}
DENSE_LIMIT=5000  # Agglomerative and co-clustering keep an n x n matrix: 5,000 rows is about 200 MB.


def load_config(path,overrides=()):
    config=merge(DEFAULTS,yaml.safe_load(Path(path).read_text(encoding='utf-8')))
    for override in overrides:
        key,value=override.split('=',1)
        set_value(config,key,yaml.safe_load(value))
    config['clusterings']=[check(merge(ENTRY,e)) for e in config['clusterings']]
    return config


def check(e):
    unknown=set(e)-set(ENTRY)
    if unknown or not e['name'] or not e['id']:
        raise ValueError(f'{e.get("name")}: unknown keys {sorted(unknown)} or missing name/id')
    if not (e['query'] or e['vectors']) or bool(e['vectors'])!=bool(e['ids']):
        raise ValueError(f'{e["name"]}: needs a query, or vectors with ids')
    if e['method'] not in METHODS or e['transform'] not in TRANSFORMS:
        raise ValueError(f'{e["name"]}: method {e["method"]} or transform {e["transform"]} unsupported')
    if e['method']=='chain' and e['resample']!='columns':
        raise ValueError(f'{e["name"]}: chain keeps row order; resample columns')
    return e


def resolve(text,config):
    return text.replace('{warehouse}',config['warehouse']).replace('{data}','frontend/public/data')


def load(e,config):
    import duckdb
    con=duckdb.connect()
    con.execute(f"set memory_limit='{config['resources']['duckdb_memory_gb']}GB'")
    con.execute(f"set threads={config['resources']['cpu_threads']}")
    meta=con.sql(resolve(e['query'],config)).df() if e['query'] else None
    con.close()
    if e['vectors']:
        ids=json.loads(Path(resolve(e['ids'],config)).read_text(encoding='utf-8'))
        frame=pd.DataFrame({e['id']:ids})
        if meta is not None:
            frame=frame.merge(meta,on=e['id'],how='left',validate='one_to_one')
        return frame,np.load(resolve(e['vectors'],config),mmap_mode='r'),None
    keys={e['id'],e['label'],e['period'],e['reference']}-{None}
    # Default features: every numeric column that is not a key; text columns stay metadata.
    features=e['features'] or [c for c in meta.select_dtypes('number').columns if c not in keys]
    complete=meta[features].notna().all(axis=1)
    frame=meta[complete].reset_index(drop=True)
    frame.attrs['dropped']=meta.loc[~complete,e['id']].astype(str).tolist()
    return frame,frame[features].to_numpy(float),features


def transform(x,e,seed):
    x=np.asarray(x,dtype='float32' if e['vectors'] else float)
    if e['transform']=='clr':
        floor=x[x>0].min()/2 if (x>0).any() else 1e-6
        x=np.log(np.maximum(x,floor))
        x=x-x.mean(axis=1,keepdims=True)
    elif e['transform']=='zscore':
        spread=x.std(axis=0)
        x=(x-x.mean(axis=0))/np.where(spread>0,spread,1)
    if e['pca'] and e['pca']<x.shape[1]:
        from sklearn.decomposition import PCA
        x=PCA(e['pca'],svd_solver='randomized',random_state=seed).fit_transform(x)
    return x


def fit(z,e,k,seed,raw=None):
    """Row labels, and column labels for co-clustering."""
    from sklearn import cluster, mixture
    if e['method'] in ('ward','average','chain','cocluster') and len(z)>DENSE_LIMIT:
        raise ValueError(f'{e["name"]}: {e["method"]} on {len(z)} rows needs an n x n matrix; use kmeans or hdbscan')
    if e['method']=='kmeans':
        model=cluster.KMeans(k,n_init=10,random_state=seed) if len(z)<20000 else cluster.MiniBatchKMeans(k,n_init=3,random_state=seed,batch_size=4096)
        return model.fit_predict(z),None
    if e['method']=='gmm':
        return mixture.GaussianMixture(k,covariance_type='diag',random_state=seed).fit(z).predict(z),None
    if e['method'] in ('ward','average'):
        return cluster.AgglomerativeClustering(k,linkage=e['method']).fit_predict(z),None
    if e['method']=='chain':
        # Only neighbours in row order may merge: contiguous eras, ordered by the query.
        from scipy.sparse import diags
        chain=diags([1.0,1.0],[-1,1],shape=(len(z),len(z)))
        return cluster.AgglomerativeClustering(k,linkage='ward',connectivity=chain).fit_predict(z),None
    if e['method']=='cocluster':
        model=cluster.SpectralCoclustering(k,random_state=seed).fit(np.maximum(raw,0)+1e-9)
        return model.row_labels_,model.column_labels_
    return cluster.HDBSCAN(min_cluster_size=e['min_cluster_size'],min_samples=e['min_samples']).fit_predict(z),None


def silhouette(z,labels,v,seed):
    from sklearn.metrics import silhouette_score
    keep=labels>=0
    if len(set(labels[keep]))<2:
        return None
    return float(silhouette_score(z[keep],labels[keep],sample_size=min(v['silhouette_sample'],int(keep.sum())),random_state=seed))


def choose(z,e,v,raw):
    ks=[None] if e['method']=='hdbscan' else range(e['k'][0],e['k'][-1]+1)
    tried=[]
    for k in ks:
        if k is not None and k>=len(z):
            break
        labels,columns=fit(z,e,k,v['seed'],raw)
        tried.append({'k':k,'silhouette':silhouette(z,labels,v,v['seed']),'labels':labels,'columns':columns})
    best=max(tried,key=lambda t:-2 if t['silhouette'] is None else t['silhouette'])
    return best,[{'k':t['k'],'silhouette':t['silhouette']} for t in tried]


def stability(z,labels,e,v,k,raw,groups):
    """Refit on subsamples of whole entities: rows of one entity across periods are not independent."""
    from sklearn.metrics import adjusted_rand_score
    rng=np.random.default_rng(v['seed'])
    unique=np.unique(groups)
    scores=[]
    for i in range(e['resamples'] or v['resamples']):
        if e['resample']=='columns':
            cols=np.sort(rng.choice(z.shape[1],max(2,round(z.shape[1]*v['subsample'])),replace=False))
            rows=np.arange(len(z))
            other,_=fit(z[:,cols],e,k,v['seed']+i+1,None if raw is None else raw[:,cols])
        else:
            rows=np.flatnonzero(np.isin(groups,rng.choice(unique,round(len(unique)*v['subsample']),replace=False)))
            other,_=fit(z[rows],e,k,v['seed']+i+1,None if raw is None else raw[rows])
        mine=labels[rows]
        both=(mine>=0)&(other>=0)
        scores.append(float(adjusted_rand_score(mine[both],other[both])) if both.sum()>1 else 0.0)
    return {'method':f'refit on {v["subsample"]:.0%} {"of the features" if e["resample"]=="columns" else "subsamples of the entities"}',
        'resamples':len(scores),'ari_mean':float(np.mean(scores)),'ari_p05':float(np.percentile(scores,5)),'ari_p95':float(np.percentile(scores,95))}


def null(z,e,v,k,actual,raw):
    rng=np.random.default_rng(v['seed']+7)
    # The smallest attainable p is 1/(count+1); fewer replicates could never pass alpha.
    count=max(e['nulls'] or (v['nulls'] if len(z)<=DENSE_LIMIT else 20),math.ceil(1/v['alpha']))
    values=[]
    permute=lambda m:np.column_stack([rng.permutation(m[:,j]) for j in range(m.shape[1])])
    kind='row order permuted' if e['method']=='chain' else 'each feature permuted independently'
    for i in range(count):
        shuffled_raw=None
        if e['method']=='chain':
            shuffled=z[rng.permutation(len(z))]
        elif raw is not None:
            shuffled_raw=permute(raw)
            shuffled=transform(shuffled_raw,e,v['seed'])
        else:
            shuffled=permute(z)
        values.append(silhouette(shuffled,fit(shuffled,e,k,v['seed']+i+1,shuffled_raw)[0],v,v['seed']))
    finite=[x for x in values if x is not None]
    beaten=sum(x>=actual for x in finite) if actual is not None else count
    return {'kind':kind,'replicates':count,'silhouette_p50':float(np.median(finite)) if finite else None,
        'silhouette_p95':float(np.percentile(finite,95)) if finite else None,'no_structure_found':count-len(finite),
        'p_value':(1+beaten)/(1+count)}


def profiles(frame,x,z,labels,e,features,columns):
    rows=[]
    for c in sorted(set(labels)-{-1}):
        idx=np.flatnonzero(labels==c)
        centre=z[idx].mean(axis=0)
        near=idx[np.argsort(np.linalg.norm(z[idx]-centre,axis=1))[:8]]
        row={'cluster':int(c),'size':len(idx),'share':len(idx)/len(labels),
            'members':frame.iloc[near][e['label'] or e['id']].astype(str).tolist()}
        if features:
            row['mean']={f:float(x[idx,j].mean()) for j,f in enumerate(features)}
            if not e['pca']:
                # Cluster centre in the transformed space: standard deviations (zscore) or log-ratio units (clr).
                lift=pd.Series(centre,index=features)
                row['distinctive']=[{'feature':f,'score':round(float(lift[f]),3)} for f in lift.abs().nlargest(5).index]
        if columns is not None and features:
            row['columns']=[f for f,col in zip(features,columns) if col==c]
        rows.append(row)
    return rows


def run_one(e,config,source):
    v=config['validation']
    frame,x,features=load(e,config)
    z=transform(x,e,v['seed'])
    raw=np.asarray(x,dtype=float) if e['method']=='cocluster' else None
    best,tried=choose(z,e,v,raw)
    labels,k=best['labels'],best['k']
    from sklearn.metrics import adjusted_mutual_info_score
    reference=None
    if e['reference'] and e['reference'] in frame:
        known=frame[e['reference']].notna().to_numpy()&(labels>=0)
        reference={'label':e['reference'],'ami':float(adjusted_mutual_info_score(frame[e['reference']][known].astype(str),labels[known])),'rows':int(known.sum())}
    stable=stability(z,labels,e,v,k,raw,frame[e['id']].astype(str).to_numpy())
    baseline=null(z,e,v,k,best['silhouette'],raw)
    entities=frame[e['id']].nunique()
    if entities<v['min_entities']:
        verdict='descriptive'
    elif stable['ari_mean']>=v['min_ari'] and baseline['p_value']<v['alpha']:
        verdict='finding'
    else:
        verdict='exploratory'
    diagnostics={'entities':int(entities),'rows':len(frame),'dropped_incomplete':frame.attrs.get('dropped',[]),
        'k':k,'k_search':tried,'noise_share':float((labels<0).mean()),'silhouette':best['silhouette'],
        'silhouette_space':f'{e["transform"]} features'+(f', PCA {e["pca"]}' if e['pca'] else ''),
        'stability':stable,'null':baseline,'reference':reference,'verdict':verdict,
        'rule':f'finding when mean ARI >= {v["min_ari"]}, null p < {v["alpha"]} and at least {v["min_entities"]} entities'}
    rng=np.random.default_rng(v['seed'])
    shown=np.sort(rng.choice(len(frame),min(v['points'],len(frame)),replace=False))
    points=None
    if e['layout']=='pca' and z.shape[1]>=2:
        from sklearn.decomposition import PCA
        xy=PCA(2,random_state=v['seed']).fit(z).transform(z[shown])
        points=[[str(frame.iloc[i][e['id']]),round(float(a),3),round(float(b),3),int(labels[i])] for i,(a,b) in zip(shown,xy)]
    assignments=pd.DataFrame({'id':frame[e['id']].astype(str),'cluster':labels})
    if e['period']:
        assignments['period']=frame[e['period']].to_numpy()
    out=Path(resolve(config['output'],config))/e['name']
    atomic_parquet(assignments,out/'assignments.parquet')
    body={'schema_version':1,'name':e['name'],'family':e['family'],'title':e['title'],'note':e['note'],
        'generated_at':now(),'run_id':digest({'entry':e,'provenance':source['implementation_hashes'],'commit':source['commit']})[:16],
        'method':{k2:e[k2] for k2 in ('method','transform','pca','id','period','reference')}|{'features':features,'seed':v['seed']},
        'diagnostics':diagnostics,'clusters':profiles(frame,x,z,labels,e,features,best['columns']),
        'members':assignments.astype({'cluster':int}).to_numpy().tolist() if len(frame)<=v['points'] else None,
        'member_columns':list(assignments.columns),'points':points}
    if e['period']:
        shares=assignments[assignments.cluster>=0].groupby(['period','cluster']).size().unstack(fill_value=0)
        body['shares']={'periods':[str(p) for p in shares.index],'clusters':[int(c) for c in shares.columns],
            'values':(shares.div(shares.sum(axis=1),axis=0)).round(4).to_numpy().tolist()}
        wide=assignments.pivot_table(index='id',columns='period',values='cluster',aggfunc='first')
        flows=[]
        for a,b in zip(wide.columns[:-1],wide.columns[1:]):
            pair=wide[[a,b]].dropna().astype(int)
            flows+=[{'from_period':str(a),'to_period':str(b),'from':int(f),'to':int(t),'count':int(n)}
                for (f,t),n in pair.groupby([a,b]).size().items()]
        body['flows']=flows
    atomic_json(out/'metrics.json',{k2:body[k2] for k2 in ('run_id','method','diagnostics')})
    target=Path(config['publish'])/f'{e["name"]}.json'
    target.parent.mkdir(parents=True,exist_ok=True)
    text=json.dumps(body,ensure_ascii=False,separators=(',',':'),allow_nan=False)
    if len(text.encode())>v['max_bytes']:
        raise ValueError(f'{e["name"]}: export is {len(text.encode())} bytes; lower validation.points')
    target.write_text(text,encoding='utf-8',newline='\n')
    return {'name':e['name'],'verdict':verdict,'k':k,'silhouette':best['silhouette'],
        'ari':stable['ari_mean'],'null_p':baseline['p_value'],'ami':reference and reference['ami'],'export':str(target)}


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('command',choices=['list','run'])
    parser.add_argument('--config',default='configs/cluster_lab/feed.yaml')
    parser.add_argument('--only',action='append',default=[])
    parser.add_argument('--set',action='append',default=[],dest='overrides')
    args=parser.parse_args(argv)
    config=load_config(args.config,args.overrides)
    entries=[e for e in config['clusterings'] if not args.only or e['name'] in args.only]
    if args.command=='list':
        for e in entries:
            print(f'{e["name"]:32} {e["family"] or "":5} {e["method"]:9} {e["title"] or ""}')
        return 0
    output=Path(resolve(config['output'],config))
    output.mkdir(parents=True,exist_ok=True)
    guard(config['resources'],output/'stop-reason.json')
    from threadpoolctl import threadpool_limits
    source=provenance()
    failed=0
    with threadpool_limits(limits=config['resources']['cpu_threads']):
        for e in entries:
            try:
                print(json.dumps(run_one(deepcopy(e),config,source)),flush=True)
            except Exception as error:
                failed+=1
                print(json.dumps({'name':e['name'],'error':str(error)}),flush=True)
            gc.collect()
    return 1 if failed else 0


if __name__=='__main__':
    raise SystemExit(main())
