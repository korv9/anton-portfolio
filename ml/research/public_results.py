"""Scope-aware evaluation of frozen public research runs, including full-N pilots.

A full-county pilot is already the full dataset; Cluster Lab correctly reuses its run ID.
Choose by recorded fit scope rather than requiring the run's first stage to be 'full'.
"""
from copy import deepcopy
from pathlib import Path
import argparse
import itertools

import numpy as np
import pandas as pd
import yaml

from ml.cluster_lab import datasets, evaluate, layouts
from ml.cluster_lab.config import DEFAULTS, merge
from ml.cluster_lab.export import export
from ml.cluster_lab.io import atomic_json, digest, file_hash, read_json
from ml.cluster_lab.public_research import Subsample
from ml.cluster_lab.registry import Registry
from ml.cluster_lab.sweep import Runner


def full_runs(registry):
    return [r for r in registry.rows('run') if r['status']=='completed'
        and r.get('full_fit') and r['stage'] in ('pilot','full')]


def representatives(runs):
    chosen={}
    for r in runs:
        m,c=r['metrics'],r['config']
        if c['seed']!=42 or m['cluster_count']<2 or m['noise_share']>.7 or m['largest_cluster_share']>.8:
            continue
        key=(r['dataset'],c['representation']['kind'],c['representation']['model'] if c['representation']['kind']=='embedding' else c['representation']['numeric_scaler'])
        score=m['silhouette_original']['value']
        if score is not None and (key not in chosen or score>chosen[key][0]):chosen[key]=(score,r)
    return [r for _,r in chosen.values()]


def compare(registry,reference,candidate,method):
    metrics=evaluate.stability(pd.read_parquet(Path(reference['folder'])/'assignments.parquet'),
        pd.read_parquet(Path(candidate['folder'])/'assignments.parquet'))
    row={'reference':reference['id'],'candidate':candidate['id'],'method':method,'metrics':metrics}
    registry.put(digest([reference['id'],candidate['id']])[:24],'comparison','completed',row)
    return row


def resample(settings):
    from threadpoolctl import threadpool_limits
    from sklearn.cluster import KMeans
    from sklearn.metrics import silhouette_score
    base=merge(DEFAULTS,settings['lab'])
    root=Path(base['output'])
    runner=Runner(base)
    runner.source=read_json(root/'provenance.json')
    runs=full_runs(runner.registry)
    parents=[r for r in representatives(runs) if r['family']=='text']
    numeric=[r for r in runs if r['family']=='numeric' and r['config']['seed']==42
        and r['config']['representation']['numeric_scaler']=='standard'
        and r['config']['reduction']['method']=='none' and r['config']['clustering']['method']=='kmeans']
    if numeric:
        parents.append(max(numeric,key=lambda r:r['metrics']['silhouette_original']['value']))
    results=[]
    with runner.registry.writer(),threadpool_limits(limits=base['resources']['cpu_threads']):
        for original in parents:
            c=original['config']
            spec=read_json(original['dataset_manifest'])['dataset']
            spec['manifest']=original['dataset_manifest']
            ds=datasets.load(spec,c)
            if original['family']=='numeric':
                exclusions=[[oid] for oid in ds.metadata.observation_id]
                method='leave one county out; refit scaler and clustering'
            else:
                debates=sorted(ds.metadata.document_id.unique())
                exclusions=[]
                for seed in [101,102,103]:
                    held=set(np.random.default_rng(seed).choice(debates,round(.2*len(debates)),replace=False))
                    exclusions.append(ds.metadata.loc[ds.metadata.document_id.isin(held),'observation_id'].tolist())
                method='hold out 20 percent of complete debates; refit workflow'
            for i,excluded in enumerate(exclusions):
                child=Subsample({**ds.spec,'excluded_ids':excluded,'sample_method':method},ds.path,ds.manifest,ds.metadata)
                candidate=runner.run_one(child,c,'resample','public-research',f'{original["id"]}/sample/{i}')
                results.append(compare(runner.registry,original,candidate,method))
                atomic_json(root/'resample-stability.json',results)
                print('resample',original['dataset'],i+1,len(exclusions),candidate['id'],results[-1]['metrics'],flush=True)
            if original['family']=='numeric':
                for feature in c['representation']['numeric_features']:
                    variant=deepcopy(c)
                    variant['representation']['numeric_features'].remove(feature)
                    candidate=runner.run_one(ds,variant,'feature_sensitivity','public-research',f'omit/{feature}')
                    results.append(compare(runner.registry,original,candidate,'omit numeric indicator: '+feature))
                    atomic_json(root/'resample-stability.json',results)
                vectors=np.load(original['representation']['path'])
                rng=np.random.default_rng(1729)
                null=[]
                for _ in range(200):
                    shuffled=np.column_stack([rng.permutation(vectors[:,j]) for j in range(vectors.shape[1])])
                    labels=KMeans(n_clusters=c['clustering']['n_clusters'],n_init=20,random_state=42).fit_predict(shuffled)
                    null.append(float(silhouette_score(shuffled,labels)))
                actual=original['metrics']['silhouette_original']['value']
                atomic_json(root/'welfare-permutation.json',{'reference':original['id'],'actual_silhouette':actual,
                    'seed':1729,'replications':200,'null_silhouettes':null,
                    'fraction_null_at_least_actual':float((1+sum(s>=actual for s in null))/201),
                    'note':'exploratory column-independence reference, conditional on a chosen baseline; not a preregistered significance test'})
        export(runner.registry,root/'gallery')
    runner.registry.close()


def analyze(settings):
    root=Path(settings['lab']['output'])
    registry=Registry(root)
    runs=[r for r in registry.rows('run') if r['status']=='completed']
    rows=[]
    for r in runs:
        c,m=r['config'],r['metrics']
        representation=c['representation']
        rows.append({'run_id':r['id'],'dataset':r['dataset'],'stage':r['stage'],'full_fit':r['full_fit'],
            'model':representation['model'] if representation['kind']=='embedding' else representation['numeric_scaler'] if representation['kind']=='numeric' else 'tfidf_svd',
            'seed':c['seed'],'reduction':c['reduction']['method'],
            'n_neighbors':c['reduction']['n_neighbors'] if c['reduction']['method']=='umap' else None,
            'min_dist':c['reduction']['min_dist'] if c['reduction']['method']=='umap' else None,
            'dimensions':int(np.load(r['reduction']['path'],mmap_mode='r').shape[1]),
            'algorithm':m['implementation'],'k':c['clustering']['n_clusters'] if c['clustering']['method']=='kmeans' else None,
            'min_cluster_size':r['actual_min_cluster_size'] if c['clustering']['method']=='hdbscan' else None,
            'min_samples':c['clustering']['min_samples'] if c['clustering']['method']=='hdbscan' else None,
            'selection':c['clustering']['cluster_selection_method'] if c['clustering']['method']=='hdbscan' else None,
            'n':m['observations'],'clusters':m['cluster_count'],'sizes':m['cluster_sizes'],'noise':m['noise_share'],
            'largest':m['largest_cluster_share'],'silhouette_original':m['silhouette_original']['value'],
            'silhouette_analyzed':m['silhouette_analyzed']['value'],
            **{f'ami_{k}':v.get('adjusted_mutual_information') for k,v in m['dominance'].items()}})
    pd.DataFrame(rows).to_csv(root/'sweep.csv',index=False)
    seed_groups={}
    for r in full_runs(registry):
        c=r['config']
        key=digest({'dataset':r['dataset'],'representation':c['representation'],'reduction':c['reduction'],'clustering':c['clustering']})
        seed_groups.setdefault(key,[]).append(r)
    with registry.writer():
        comparisons=[compare(registry,a,b,'seed comparison; same full observations and representation')
            for group in seed_groups.values() for a,b in itertools.combinations(group,2)]
        atomic_json(root/'stability.json',comparisons)
        parents=representatives(full_runs(registry))
        atomic_json(root/'layout-parents.json',[{'run_id':r['id'],'criterion':'maximum original-representation silhouette at seed 42, >=2 groups, noise<=0.7, largest<=0.8; not semantic accuracy'} for r in parents])
        for r in parents:
            c=deepcopy(r['config'])
            if r['family']=='numeric':
                c['layouts'].update(n_neighbors=[3,7],metric='euclidean',trust_neighbors=3,trust_sample_size=21)
            for i,params in enumerate(layouts.parameters(c)):
                layout=layouts.create(r,params,c,registry,preview=False)
                print('layout',r['dataset'],r['id'],i+1,c['layouts']['count'],layout['id'],flush=True)
        export(registry,root/'gallery')
    registry.close()
    atomic_json(root/'evaluation-code.json',{'code':str(Path(__file__)),'sha256':file_hash(__file__)})


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('command',choices=['resample','analyze'])
    parser.add_argument('--config',default='configs/cluster_lab/public_research_clean.yaml')
    args=parser.parse_args()
    settings=yaml.safe_load(Path(args.config).read_text(encoding='utf-8'))
    (resample if args.command=='resample' else analyze)(settings)


if __name__=='__main__':main()
