"""Consensus subject groups: many UMAP seeds, one partition, then sub-groups, terms and a reading test.

python -m ml.research.consensus prepare|seeds|consensus|levels|layout|intrusion --config configs/cluster_lab/public_consensus.yaml [--only variant]

prepare    extra snapshots (philosophy in longer passages).
seeds      per variant and seed: UMAP, then HDBSCAN; only the labels are kept.
consensus  base groups from all seeds are linked when they share most members; a passage joins the
           linked group that at least half of the seeds put it in. The result is merged and its noise
           reassigned as in ml.cluster_lab.refine. Stability is the ARI between the consensus of the
           even seeds and that of the odd seeds. The pick per corpus follows evaluate.score.
levels     sub-groups inside the large groups of each pick, by the same procedure.
layout     2-D map of each pick; labels are inputs and are never refitted.
intrusion  reading test: four passages from one group and one from another, in random order.
"""
from __future__ import annotations

import argparse
import itertools
import json
from pathlib import Path
import sys

import numpy as np
import pandas as pd
import yaml

from ml.cluster_lab import datasets, evaluate, representations
from ml.cluster_lab.config import DEFAULTS, merge
from ml.cluster_lab.io import ROOT, atomic_json, digest, read_json
from ml.cluster_lab.refine import refine
from ml.research import topics

# Function words and debate filler; the class-based TF-IDF handles the rest.
SWEDISH=('och i att en ett det den de som på är av för med till inte har vi jag om men så var sig från ska kan man när '
    'nu också här där vad hur alla mycket bara eller ju då än ha vill får vara blir bli sin sitt sina han hon dem oss er '
    'ni du min mitt mina vår vårt våra denna detta dessa under över efter mot utan mellan mer många andra annat någon '
    'något några skulle måste kommer gör göra gjort sedan redan även just precis helt varje varit hade finns få går ser '
    'säger sade sa tror tycker vet står tar ger gäller handlar därför eftersom samtidigt dessutom faktiskt verkligen '
    'naturligtvis självklart ändå aldrig alltid igen fram upp ut in bort kunna kunde samma sådan sådana vilket vilka vilken '
    'herr fru talman tack anförande replik ledamot ledamöterna riksdagen kammaren fråga frågan frågor svar svara svarar '
    'ja nej väl nog ganska lite del sätt gång gånger år året dag idag dagens sverige svenska svensk regeringen regering '
    'partiet parti partier politik politiken oppositionen statsministern').split()


def corpus(settings,name):
    """Dataset and lab settings: a corpus of the topics config, or a snapshot prepared here."""
    lab=yaml.safe_load(Path(settings['topics']).read_text(encoding='utf-8'))
    if name in lab['research']:
        return topics.load(lab,name)
    base=merge(DEFAULTS,lab['lab'])
    manifest=Path(settings['output'])/'datasets'/name/'manifest.json'
    spec={**read_json(manifest)['dataset'],'manifest':str(manifest)}
    base['datasets']=[spec]
    return datasets.load(spec,base),base


def prepare(settings,only):
    for name,cfg in settings.get('corpora',{}).items():
        folder=Path(settings['output'])/'datasets'/name
        if (folder/'manifest.json').exists():
            continue
        folder.mkdir(parents=True,exist_ok=True)
        manifest=topics.prepare_philosophy(cfg,folder)
        print(name,'snapshot prepared',manifest['observations'],json.dumps(manifest['coverage'])[:400],flush=True)


def encode(texts,v,folder):
    """Vectors from a model the lab's encoder cannot run here: half precision and a task prefix."""
    path=folder/f"vectors-{digest([v['model'],v['revision'],v['prefix'],[digest(t) for t in texts]])[:16]}.npy"
    if not path.exists():
        import torch
        from sentence_transformers import SentenceTransformer
        model=SentenceTransformer(v['model'],revision=v['revision'],device='cuda',
            cache_folder=str(ROOT/'warehouse/cluster_lab/cache/models'),model_kwargs={'torch_dtype':torch.float16})
        vectors=model.encode([v['prefix']+t for t in texts],batch_size=v.get('batch_size',8),normalize_embeddings=True,
            convert_to_numpy=True,show_progress_bar=False).astype('float32')
        folder.mkdir(parents=True,exist_ok=True)
        np.save(path,vectors)
    return np.load(path)


def load(settings,v):
    """Frame and vectors of a variant: optional removal of earlier groups, then centering per speaker or work."""
    sys.path.insert(0,str(ROOT/'platform/nlp/symbolic'))
    from transforms import center_document_means
    ds,base=corpus(settings,v['corpus'])
    frame,_=ds.sample(None,42)
    frame=frame.merge(pd.read_parquet(ds.path,columns=['observation_id','context']),on='observation_id',validate='one_to_one')
    if 'prefix' in v:
        vectors=encode(frame.context.tolist(),v,Path(settings['output'])/'vectors')
    else:
        vectors,_=representations.build(ds,frame,merge(base,{'representation':{'kind':'embedding','model':v['model'],
            'revision':v['revision'],'centering':'none'}}))
    keep=np.ones(len(frame),dtype=bool)
    if v.get('drop'):
        earlier=pd.read_parquet(v['drop']['assignments'])
        gone=set(earlier.observation_id[earlier.cluster.isin(v['drop']['groups'])])
        keep=~frame.observation_id.isin(gone).to_numpy()
    total,frame=len(frame),frame[keep].reset_index(drop=True)
    vectors=np.asarray(vectors,dtype='float32')[keep]
    # Same rule as representations.build: only speakers with enough passages in two debates are centred.
    column='document_id' if v['centering']=='work' else 'author'
    groups=frame[column].astype(str)
    mask=np.ones(len(frame),dtype=bool)
    if column=='author':
        r=base['representation']
        stats=frame.groupby('author').agg(n=('observation_id','count'),works=('document_id','nunique'))
        mask=groups.isin(stats.index[(stats.n>=r['author_min_observations'])&(stats.works>=r['author_min_works'])]).to_numpy()
    vectors[mask]=center_document_means(vectors[mask],groups[mask].tolist())
    vectors/=np.linalg.norm(vectors,axis=1,keepdims=True).clip(min=1e-12)
    return frame,vectors,total,base


def fit(vectors,seed,neighbors,size,samples,cap):
    from hdbscan import HDBSCAN
    from umap import UMAP
    space=UMAP(n_neighbors=neighbors,n_components=5,min_dist=0.0,metric='cosine',random_state=seed,n_jobs=1,
        low_memory=True).fit_transform(vectors)
    model=HDBSCAN(min_cluster_size=size,min_samples=samples,gen_min_span_tree=True,core_dist_n_jobs=1,
        cluster_selection_method='eom',max_cluster_size=cap).fit(space)
    return model.labels_.astype(int),evaluate.dbcv(model).get('value')


def seeds(settings,only,new_runs=None):
    """`new_runs` ends the process (exit 3) after that many fits, so memory is returned between them."""
    from threadpoolctl import threadpool_limits
    fresh=0
    for name,v in settings['variants'].items():
        if only and name!=only:
            continue
        folder=Path(settings['output'])/name
        missing=[s for s in range(settings['seeds']) if not (folder/f'seed-{s}.json').exists()]
        if not missing:
            continue
        frame,vectors,_,base=load(settings,v)
        folder.mkdir(parents=True,exist_ok=True)
        with threadpool_limits(limits=base['resources']['cpu_threads']):
            for seed in missing:
                if new_runs and fresh>=new_runs:
                    sys.exit(3)
                labels,dbcv=fit(vectors,seed,v['neighbors'],v['min_cluster_size'],v['min_samples'],round(settings['max_largest']*len(frame)))
                atomic_json(folder/f'seed-{seed}.json',{'labels':labels.tolist(),'dbcv':dbcv,'ids':digest(frame.observation_id.tolist())})
                fresh+=1
                print(name,'seed',seed,'groups',int(labels.max()+1),'noise',round(float((labels<0).mean()),3),'dbcv',dbcv,flush=True)


def consensus(runs,jaccard=0.5,support=0.5):
    """Strehl and Ghosh's meta-clustering. `runs` is seeds x observations; returns labels (largest group
    first, -1 without a majority) and each observation's share of seeds behind its label."""
    from scipy import sparse
    from sklearn.cluster import AgglomerativeClustering
    runs=np.asarray(runs)
    count,n=runs.shape
    rows,columns,owner=[],[],[]
    for seed,labels in enumerate(runs):
        for cluster in np.unique(labels[labels>=0]):
            members=np.flatnonzero(labels==cluster)
            rows.append(members)
            columns.append(np.full(len(members),len(owner)))
            owner.append(seed)
    if len(owner)<2:
        return np.full(n,-1),np.zeros(n)
    member=sparse.csr_matrix((np.ones(sum(map(len,rows)),dtype='float32'),(np.concatenate(rows),np.concatenate(columns))),shape=(n,len(owner)))
    shared=(member.T@member).toarray()
    sizes=shared.diagonal()
    meta=AgglomerativeClustering(n_clusters=None,metric='precomputed',linkage='average',distance_threshold=1-jaccard).fit_predict(
        1-shared/(sizes[:,None]+sizes[None,:]-shared))
    owner=np.array(owner)
    kept=[m for m in range(meta.max()+1) if len(set(owner[meta==m]))>=support*count]
    if not kept:
        return np.full(n,-1),np.zeros(n)
    votes=np.column_stack([np.asarray(member[:,np.flatnonzero(meta==m)].sum(axis=1)).ravel() for m in kept])/count
    best=votes.argmax(axis=1)
    share=votes[np.arange(n),best]
    labels=np.where(share>=support,best,-1)
    order=[m for m in np.argsort(-np.bincount(labels[labels>=0],minlength=len(kept)),kind='stable') if (labels==m).any()]
    rank={m:i for i,m in enumerate(order)}
    return np.array([rank.get(label,-1) for label in labels.tolist()]),share


def agreed(vectors,runs,settings):
    """Consensus, then merge and noise reassignment in the original vectors; also the split-half ARI."""
    from sklearn.metrics import adjusted_rand_score
    agree=lambda part:consensus(part,settings['link_jaccard'],settings['support'])
    finish=lambda part:refine(vectors,agree(part)[0],settings['merge_similarity'],settings['reassign_quantile'],settings['reassign_margin'])
    core,share=agree(runs)
    labels,info=finish(runs)
    a,b=finish(runs[0::2])[0],finish(runs[1::2])[0]
    both=(a>=0)&(b>=0)
    return core,share,labels,info,{'with_noise':float(adjusted_rand_score(a,b)),
        'assigned':float(adjusted_rand_score(a[both],b[both])) if both.sum()>1 else None}


def summarise(settings,only):
    from sklearn.metrics import adjusted_rand_score, silhouette_score
    root=Path(settings['output'])
    lab=yaml.safe_load(Path(settings['topics']).read_text(encoding='utf-8'))['lab']
    results={}
    for name,v in settings['variants'].items():
        if only and name!=only:
            continue
        frame,vectors,total,_=load(settings,v)
        saved=[read_json(root/name/f'seed-{s}.json') for s in range(settings['seeds'])]
        if any(s['ids']!=digest(frame.observation_id.tolist()) for s in saved):
            raise ValueError(f'{name}: seed labels belong to another set of passages')
        runs=np.array([s['labels'] for s in saved])
        core,share,labels,info,halves=agreed(vectors,runs,settings)
        kept=labels>=0
        sample=np.random.default_rng(0).choice(np.flatnonzero(kept),min(5000,int(kept.sum())),replace=False)
        metrics={'cluster_count':int(labels.max()+1),'noise_share':float(1-kept.mean()),
            'largest_cluster_share':float(np.bincount(labels[kept]).max()/len(labels)),
            'dbcv':{'value':float(np.mean([s['dbcv'] for s in saved]))},'silhouette_original':{'value':None},
            'dominance':evaluate.dominance(frame,labels)}
        result={'variant':name,'settings':v,'observations':len(frame),'corpus_observations':total,
            'seeds':settings['seeds'],'groups_per_seed':[int(r.max()+1) for r in runs],
            'seed_pair_ari':float(np.mean([adjusted_rand_score(a,b) for a,b in itertools.combinations(runs,2)])),
            'dbcv_per_seed':[s['dbcv'] for s in saved],'core_groups':int(core.max()+1),'core_noise_share':float((core<0).mean()),
            'clusters':metrics['cluster_count'],'noise_share':metrics['noise_share'],'largest_share':metrics['largest_cluster_share'],
            'split_half_ari':halves,'refinement':info,
            'votes':{'unanimous':float((share[core>=0]>=0.999).mean()),'at_least_0.9':float((share[core>=0]>=0.9).mean()),
                'median':float(np.median(share[core>=0]))},
            'silhouette_cosine':float(silhouette_score(vectors[sample],labels[sample],metric='cosine')),
            'ami':{k:d['adjusted_mutual_information'] for k,d in metrics['dominance'].items()},
            'score':evaluate.score(metrics,lab['sweep']['selection']),'run_id':digest(labels.tolist())[:24]}
        pd.DataFrame({'observation_id':frame.observation_id,'cluster':labels,'core':core>=0,'vote':share}).to_parquet(root/name/'assignments.parquet',index=False)
        atomic_json(root/name/'result.json',result)
        results[name]=result
        print(name,json.dumps({k:result[k] for k in ('observations','clusters','core_noise_share','noise_share','largest_share','seed_pair_ari','split_half_ari','silhouette_cosine','score')}),flush=True)
    # A corpus gets its pick when every one of its variants has a result on disk.
    results={n:read_json(root/n/'result.json') for n in settings['variants'] if (root/n/'result.json').exists()}
    for corpus_name in sorted({v['pick'] for v in settings['variants'].values()}):
        names=[n for n,v in settings['variants'].items() if v['pick']==corpus_name]
        if any(n not in results for n in names):
            continue
        entries=[results[n] for n in names]
        stable=[r for r in entries if r['split_half_ari']['with_noise']>=settings['min_ari']]
        pick=max(stable,key=lambda r:r['score']) if stable else max(entries,key=lambda r:r['split_half_ari']['with_noise'])
        atomic_json(root/f'pick-{corpus_name}.json',{**pick,'stable':bool(stable),
            'criterion':f'highest evaluate.score among variants with split-half ARI >= {settings["min_ari"]}, or the highest split-half ARI when none reaches it'})
        print('pick',corpus_name,pick['variant'],'stable',bool(stable),flush=True)


def picked(settings,name):
    pick=read_json(Path(settings['output'])/f'pick-{name}.json')
    frame,vectors,_,base=load(settings,pick['settings'])
    labels=pd.read_parquet(Path(settings['output'])/pick['variant']/'assignments.parquet').set_index('observation_id').loc[frame.observation_id]
    return pick,frame,vectors,labels.cluster.to_numpy(),base


def terms(texts,labels,stops,top=10):
    sys.path.insert(0,str(ROOT/'platform/nlp/symbolic'))
    from rank_clusters import ctfidf, stop_words
    words=ctfidf({int(c):[t for t,l in zip(texts,labels) if l==c] for c in sorted(set(labels)-{-1})},top=top,
        stop_words_override=sorted(set(stops)) if stops else stop_words(),token_pattern=r'(?u)\b[^\W\d_][^\W\d_]{2,}\b')
    out={}
    for word in words:
        out.setdefault(word['cluster_id'],[]).append(word['term'])
    return out


def levels(settings,only):
    """Sub-groups of every group with at least `levels.min_size` passages, with their own split-half ARI."""
    from threadpoolctl import threadpool_limits
    cfg=settings['levels']
    for name in sorted({v['pick'] for v in settings['variants'].values()}):
        if only and name!=only:
            continue
        pick,frame,vectors,labels,base=picked(settings,name)
        stops=SWEDISH if frame.language.iloc[0]=='sv' else None
        texts=frame.context.tolist()
        out={'run_id':pick['run_id'],'terms':terms(texts,labels,stops),'groups':{}}
        with threadpool_limits(limits=base['resources']['cpu_threads']):
            for group in range(labels.max()+1):
                rows=np.flatnonzero(labels==group)
                if len(rows)<cfg['min_size']:
                    continue
                size=max(cfg['min_cluster_size'],round(cfg['min_cluster_share']*len(rows)))
                runs=np.array([fit(vectors[rows],seed,cfg['neighbors'],size,cfg['min_samples'],0)[0] for seed in range(cfg['seeds'])])
                core,share,sub,info,halves=agreed(vectors[rows],runs,{**settings,'merge_similarity':None})
                entry={'passages':len(rows),'subgroups':int(sub.max()+1),'noise_share':float((sub<0).mean()),'split_half_ari':halves,
                    'kept':bool(sub.max()>=1 and halves['with_noise']>=cfg['min_ari'])}
                if entry['kept']:
                    words=terms([texts[i] for i in rows],sub,stops,8)
                    entry['parts']=[{'id':int(s),'passages':int((sub==s).sum()),'terms':words.get(int(s),[]),
                        'examples':[texts[i][:300] for i in np.random.default_rng(s).choice(rows[sub==s],3,replace=False)]} for s in range(sub.max()+1)]
                    entry['assignments']=dict(zip(frame.observation_id.iloc[rows].tolist(),sub.tolist()))
                out['groups'][group]=entry
                print(name,'group',group,len(rows),'subgroups',entry['subgroups'],'ari',round(halves['with_noise'],2),'kept',entry['kept'],flush=True)
        atomic_json(Path(settings['output'])/f'levels-{name}.json',out)


def layout(settings,only):
    from sklearn.manifold import trustworthiness
    from umap import UMAP
    for name in sorted({v['pick'] for v in settings['variants'].values()}):
        if only and name!=only:
            continue
        pick,frame,vectors,labels,_=picked(settings,name)
        sample=np.random.default_rng(0).choice(len(frame),min(1200,len(frame)),replace=False)
        best=None
        for neighbors,distance in settings['layouts']:
            xy=UMAP(n_neighbors=neighbors,n_components=2,min_dist=distance,metric='cosine',random_state=42,n_jobs=1,low_memory=True).fit_transform(vectors)
            trust=float(trustworthiness(vectors[sample],xy[sample],n_neighbors=15,metric='cosine'))
            print(name,'layout',neighbors,distance,round(trust,3),flush=True)
            if not best or trust>best[0]:
                best=(trust,neighbors,distance,xy)
        pd.DataFrame({'observation_id':frame.observation_id,'x':best[3][:,0],'y':best[3][:,1]}).to_parquet(Path(settings['output'])/f'layout-{name}.parquet',index=False)
        atomic_json(Path(settings['output'])/f'layout-{name}.json',{'run_id':pick['run_id'],'trustworthiness':best[0],'n_neighbors':best[1],'min_dist':best[2],
            'note':'trustworthiness at 15 neighbours on 1,200 sampled passages, cosine in the clustering vectors'})


def intrusion(settings,only):
    """Tasks without the answer in one file and the key in another, so the reader cannot see the key."""
    cfg=settings['intrusion']
    for name in sorted({v['pick'] for v in settings['variants'].values()}):
        if only and name!=only:
            continue
        pick,frame,_,labels,_=picked(settings,name)
        rng=np.random.default_rng(cfg['seed'])
        texts=frame.context.tolist()
        tasks,key=[],{}
        for group in range(labels.max()+1):
            for _ in range(cfg['tasks_per_group']):
                other=rng.choice([g for g in range(labels.max()+1) if g!=group])
                chosen=list(rng.choice(np.flatnonzero(labels==group),4,replace=False))+[rng.choice(np.flatnonzero(labels==other))]
                order=rng.permutation(5)
                tasks.append([texts[chosen[i]][:cfg['characters']] for i in order])
                key[len(tasks)-1]={'group':group,'intruder_from':int(other),'answer':int(np.flatnonzero(order==4)[0])+1}
        mixed=rng.permutation(len(tasks))
        atomic_json(Path(settings['output'])/f'intrusion-{name}-tasks.json',{'run_id':pick['run_id'],'tasks':[tasks[i] for i in mixed]})
        atomic_json(Path(settings['output'])/f'intrusion-{name}-key.json',{'run_id':pick['run_id'],'key':[key[int(i)] for i in mixed]})
        print(name,len(tasks),'tasks',flush=True)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('command',choices=['prepare','seeds','consensus','levels','layout','intrusion'])
    parser.add_argument('--config',default='configs/cluster_lab/public_consensus.yaml')
    parser.add_argument('--only')
    parser.add_argument('--new-runs',type=int,help='seeds: stop with exit code 3 after this many fits')
    args=parser.parse_args()
    settings=yaml.safe_load(Path(args.config).read_text(encoding='utf-8'))
    if args.command=='seeds':
        return seeds(settings,args.only,args.new_runs)
    {'prepare':prepare,'consensus':summarise,'levels':levels,'layout':layout,'intrusion':intrusion}[args.command](settings,args.only)


if __name__=='__main__':main()
