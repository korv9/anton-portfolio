"""Finite staged plan with persisted selection slots, full fits and independent layouts."""
from __future__ import annotations

from copy import deepcopy
import gc
import math
import os
from pathlib import Path
import random
import signal
import time
import traceback
import yaml

import numpy as np
import pandas as pd

from . import datasets, evaluate, layouts, refine, representations
from .config import merge, set_value, validate_trial, values
from .io import atomic_json, atomic_parquet, digest, file_hash, now, provenance, read_json
from .registry import Registry


def effective(config,spec):
    out=merge(config,{key:spec[key] for key in ('representation','reduction','clustering','sweep','layouts') if key in spec})
    for override in config.get('_overrides',[]):
        key,value=override.split('=',1)
        set_value(out,key,yaml.safe_load(value))
    return out


def lookup(config,path,spec):
    value={'dataset':spec,**config}
    for part in path.split('.'):
        value=value.get(part) if isinstance(value,dict) else None
    return value


def candidates(config,spec):
    rng=random.Random(config['seed'])
    seen=set()
    results=[]
    attempts=0
    wanted=config['sweep']['coarse_candidates']
    while len(results)<wanted and attempts<max(100,wanted*100):
        attempts+=1
        candidate=deepcopy(config)
        for branch in config['sweep']['search']:
            if all(lookup(candidate,key,spec)==value for key,value in branch.get('when',{}).items()):
                for key,domain in branch['parameters'].items():
                    set_value(candidate,key,rng.choice(values(domain)))
        validate_trial(candidate,spec)
        key=digest({key:candidate[key] for key in ('representation','reduction','clustering')})
        if key not in seen:
            seen.add(key)
            results.append(candidate)
    if len(results)<wanted:
        raise ValueError(f'Only {len(results)} distinct coarse configurations available; requested {wanted}')
    return results


def plan(config,loaded,source):
    slots=[]
    for ds in loaded:
        c=effective(config,ds.spec)
        prefix=ds.spec['name']
        def add(stage,**body):
            slot={'slot':f'{prefix}/{stage}/{sum(s["dataset"]==prefix and s["stage"]==stage for s in slots)}',
                  'dataset':prefix,'stage':stage,**body}
            slots.append(slot)
            return slot['slot']
        baseline=merge(c,c['sweep']['baseline'])
        for override in c.get('_overrides',[]):
            key,value=override.split('=',1)
            set_value(baseline,key,yaml.safe_load(value))
        baseline['sample_size']=c['sample_size'] if c['sample_size'] is not None else c['sweep']['sample_sizes'][0]
        validate_trial(baseline,ds.spec)
        add('baseline',config=baseline)
        for candidate in candidates(c,ds.spec):
            for sample_size in c['sweep']['sample_sizes']:
                add('coarse',config={**candidate,'sample_size':sample_size})
        for finalist in range(c['sweep']['finalists']):
            for refinement in range(c['sweep']['refinements_per_finalist']):
                add('refine',selector={'stages':['baseline','coarse'],'rank':finalist},refinement=refinement)
            for seed in c['sweep']['stability_seeds']:
                add('stability',selector={'stages':['baseline','coarse','refine'],'rank':finalist},seed=seed,sample_seed=c['sample_seed'])
            for sample_seed in c['sweep']['stability_sample_seeds']:
                add('stability',selector={'stages':['baseline','coarse','refine'],'rank':finalist},seed=c['seed'],sample_seed=sample_seed)
            for seed in c['sweep']['full_seeds']:
                full=add('full',selector={'stages':['baseline','coarse','refine'],'rank':finalist},seed=seed)
                for i,params in enumerate(layouts.parameters(c)):
                    add('layout',parent_slot=full,params=params,preview=i<c['layouts']['preview_count'])
        if c['sweep']['finalists']==0:
            baseline_slot=next(s['slot'] for s in slots if s['dataset']==prefix and s['stage']=='baseline')
            for i,params in enumerate(layouts.parameters(c)):
                add('layout',parent_slot=baseline_slot,params=params,preview=i<c['layouts']['preview_count'])
    stages={'baseline':0,'coarse':1,'refine':2,'stability':3,'full':4,'layout':5}
    dataset_order={ds.spec['name']:i for i,ds in enumerate(loaded)}
    slots.sort(key=lambda slot:(stages[slot['stage']],dataset_order[slot['dataset']]))
    body={'schema_version':1,'config':config,'datasets':{ds.spec['name']:ds.manifest for ds in loaded},
          'provenance':source,'slots':slots,'attempts':len(slots),'global_time_limit':None}
    body['plan_id']=digest(body)[:24]
    return body


class Runner:
    def __init__(self,config):
        self.config=config
        self.registry=Registry(config['output'])
        self.stop_requested=False
        self.source=provenance()
        self.started=time.monotonic()
        self.current=None
        from .limits import guard
        guard(config['resources'],Path(config['output'])/'stop-reason.json')
        import psutil
        self.process=psutil.Process()
        self.process.cpu_percent()

    def checkpoint(self):
        import psutil
        import shutil
        if self.stop_requested or (Path(self.config['output'])/'STOP').exists():
            raise KeyboardInterrupt('Stop requested at checkpoint')
        free=shutil.disk_usage(self.config['output']).free/1024**3
        if free<self.config['resources']['min_free_disk_gb']:
            raise datasets.DataProblem(f'Only {free:.2f} GB free disk; resource minimum reached. No observations are silently sampled.')
        process=self.process
        rss=process.memory_info().rss/1024**3
        if rss>self.config['resources']['memory_gb']:
            raise datasets.DataProblem(f'Process RSS {rss:.2f} GB exceeds configured memory limit')
        atomic_json(Path(self.config['output'])/'heartbeat.json',{'pid':os.getpid(),'at':now(),
            'current':self.current,'rss_gb':rss,'free_disk_gb':free,'cpu_percent':process.cpu_percent(),
            'elapsed_seconds':time.monotonic()-self.started})

    def load_datasets(self):
        loaded=[]
        symbolic_source=None
        for spec in self.config['datasets']:
            self.current=f'prepare:{spec["name"]}'
            self.checkpoint()
            if spec['adapter']=='symbolic' and symbolic_source is None and not spec.get('manifest'):
                symbolic_source=datasets.symbolic_snapshot(spec,Path(self.config['output'])/'datasets')
            for expanded in datasets.expand(spec,self.config,symbolic_source):
                loaded.append(datasets.load(expanded,self.config,symbolic_source))
        return loaded

    def run_one(self,ds,config,stage,plan_id,slot):
        validate_trial(config,ds.spec)
        frame,sample=ds.sample(config['sample_size'],config['sample_seed'])
        n=len(frame)
        size=config['clustering']['min_cluster_size']
        actual=max(2,math.ceil(n*size['fraction'])) if isinstance(size,dict) else size
        identity={'dataset_id':ds.manifest['dataset_id'],'ordered_ids':digest(frame.observation_id.tolist()),
            'representation':config['representation'],'reduction':config['reduction'],
            'clustering':{**config['clustering'],'actual_min_cluster_size':actual},
            'seed':config['seed'],'sample_seed':config['sample_seed'],'sample':sample,
            'evaluation':config['evaluation'],'provenance':self.source}
        run_id=digest(identity)[:24]
        previous=self.registry.get(run_id)
        if previous and previous['status']=='completed':
            if file_hash(Path(previous['folder'])/'assignments.parquet')!=previous['assignments_sha256']:
                raise datasets.DataProblem('Completed assignments checksum mismatch')
            return previous
        folder=Path(config['output'])/'runs'/run_id
        folder.mkdir(parents=True,exist_ok=True)
        body={'folder':str(folder.resolve()),'dataset':ds.spec['name'],'family':ds.spec.get('family','jobs'),
              'stage':stage,'plan_id':plan_id,'slot':slot,'config':config,'identity':identity,
              'dataset_manifest':str((ds.path.parent/'manifest.json').resolve()),
              'coverage':ds.manifest['coverage'],'sample':sample,'started_at':now(),
              'actual_min_cluster_size':actual,'provenance':self.source}
        self.registry.put(run_id,'run','running',body)
        atomic_json(folder/'config.json',config)
        atomic_json(folder/'run.json',{**body,'id':run_id,'status':'running'})
        atomic_parquet(frame[['observation_id','text_hash']],folder/'inputs.parquet')
        started=time.monotonic()
        try:
            if actual>n or config['clustering']['min_samples']>=n:
                raise ValueError(f'Cluster size/samples invalid for {n} observations')
            self.checkpoint()
            vectors,representation=representations.build(ds,frame,config,self.checkpoint)
            self.checkpoint()
            space,reduction=representations.reduce(vectors,representation,config)
            self.checkpoint()
            h=config['clustering']
            if h['method']=='kmeans':
                from sklearn.cluster import MiniBatchKMeans, KMeans
                model=KMeans(n_clusters=h['n_clusters'],random_state=config['seed'],n_init=20) if n<1000 else MiniBatchKMeans(n_clusters=h['n_clusters'],random_state=config['seed'],n_init=3,batch_size=h['batch_size'])
            elif h['implementation']=='sklearn':
                from sklearn.cluster import HDBSCAN
                model=HDBSCAN(min_cluster_size=actual,min_samples=h['min_samples'],metric=h['metric'],
                    cluster_selection_method=h['cluster_selection_method'],cluster_selection_epsilon=h['cluster_selection_epsilon'],n_jobs=1)
            else:
                from hdbscan import HDBSCAN
                from joblib import Memory
                model=HDBSCAN(min_cluster_size=actual,min_samples=h['min_samples'],metric=h['metric'],
                    cluster_selection_method=h['cluster_selection_method'],cluster_selection_epsilon=h['cluster_selection_epsilon'],
                    max_cluster_size=h['max_cluster_size'] or 0,gen_min_span_tree=True,core_dist_n_jobs=1,memory=Memory(Path(config['cache'])/'hierarchies'/digest(reduction)[:24],verbose=0))
            core=model.fit_predict(space).astype(int)
            labels,refinement=refine.refine(vectors,core,h['merge_similarity'],h['reassign_quantile'],h['reassign_margin'],config['seed'])
            from joblib import dump
            dump(model,folder/'model.joblib')
            assignments=frame[['observation_id']].copy()
            assignments['cluster']=labels
            # False for noise the refinement returned to a cluster; the map draws those fainter.
            assignments['core']=core>=0
            assignments['probability']=model.probabilities_ if hasattr(model,'probabilities_') else np.nan
            if hasattr(model,'outlier_scores_'):
                assignments['outlier_score']=model.outlier_scores_
            atomic_parquet(assignments,folder/'assignments.parquet')
            metrics=evaluate.evaluate(frame,vectors,space,labels,model,config,folder)
            metrics['refinement']=refinement
            metrics['min_samples_definition']='includes the point itself' if h['implementation']=='sklearn' else 'excludes the point itself (hdbscan package)'
            metrics['implementation']=f'{h["implementation"]}.HDBSCAN' if h['method']=='hdbscan' else f'sklearn.{type(model).__name__}'
            metrics['implementation_version']=self.source['packages']['scikit-learn' if h['implementation']=='sklearn' or h['method']=='kmeans' else 'hdbscan']
            if stage=='full' and (sample['kind']!='full' or len(assignments)!=ds.manifest['observations']):
                raise datasets.DataProblem('Final full-corpus invariant failed')
            evaluate.profiles(ds,frame,vectors,labels,config,folder)
            atomic_json(folder/'metrics.json',metrics)
            body.update(metrics=metrics,representation=representation,reduction=reduction,
                assignments_sha256=file_hash(folder/'assignments.parquet'),runtime_seconds=time.monotonic()-started,
                completed_at=now(),full_fit=sample['kind']=='full')
            atomic_json(folder/'run.json',{**body,'id':run_id,'status':'completed'})
            return self.registry.put(run_id,'run','completed',body)
        except BaseException as error:
            state='interrupted' if isinstance(error,KeyboardInterrupt) else 'failed'
            body.update(error=str(error),traceback=traceback.format_exc(),runtime_seconds=time.monotonic()-started)
            atomic_json(folder/'run.json',{**body,'id':run_id,'status':state})
            with (folder/'attempts.log').open('a',encoding='utf-8') as stream:
                stream.write(f'{now()} {state}\n{body["traceback"]}\n')
            self.registry.put(run_id,'run',state,body)
            raise

    def run(self,resume=False):
        from threadpoolctl import threadpool_limits
        import torch
        from .export import export
        torch.set_num_threads(self.config['resources']['torch_threads'])
        def stop(signum,frame):
            self.stop_requested=True
        previous={sig:signal.signal(sig,stop) for sig in (signal.SIGINT,signal.SIGTERM)}
        try:
            with self.registry.writer(),threadpool_limits(limits=self.config['resources']['cpu_threads']):
                from .prepare import prepare
                self.current={'stage':'acquisition'}
                prepare(self.config,self.checkpoint)
                loaded=self.load_datasets()
                current_plan=plan(self.config,loaded,self.source)
                plan_id=current_plan['plan_id']
                plan_folder=Path(self.config['output'])/'plans'/plan_id
                plan_folder.mkdir(parents=True,exist_ok=True)
                path=plan_folder/'plan.json'
                if not path.exists():
                    atomic_json(path,current_plan)
                state_path=plan_folder/'progress.json'
                progress=read_json(state_path) if state_path.exists() else {}
                if progress and not resume:
                    raise ValueError('Plan already exists; pass --resume to continue without repeating completed attempts')
                by_name={ds.spec['name']:ds for ds in loaded}
                for slot in current_plan['slots']:
                    sid=digest({'plan':plan_id,'slot':slot['slot']})[:24]
                    if not self.registry.get(sid):
                        self.registry.put(sid,'slot','pending',{'plan_id':plan_id,**slot})
                atomic_json(Path(self.config['output'])/'active-plan.json',{'plan_id':plan_id,'path':str(path.resolve()),'attempts':len(current_plan['slots'])})
                print(f'Plan {plan_id}: {len(current_plan["slots"])} finite attempts, no global time limit',flush=True)
                for index,slot in enumerate(current_plan['slots']):
                    self.current={'stage':slot['stage'],'slot':slot['slot'],'attempt':index+1,'total':len(current_plan['slots'])}
                    self.checkpoint()
                    sid=digest({'plan':plan_id,'slot':slot['slot']})[:24]
                    if progress.get(slot['slot'],{}).get('status')=='completed':
                        continue
                    print(f'[{index+1}/{len(current_plan["slots"])}] {slot["slot"]}',flush=True)
                    self.registry.put(sid,'slot','running',{'plan_id':plan_id,**slot})
                    ds=by_name[slot['dataset']]
                    c=effective(self.config,ds.spec)
                    try:
                        if slot['stage']=='layout':
                            parent=progress.get(slot['parent_slot'],{}).get('run_id')
                            if not parent:
                                raise ValueError('Parent full clustering did not complete')
                            result=layouts.create(self.registry.get(parent),slot['params'],c,self.registry,slot['preview'])
                        else:
                            if 'selector' in slot:
                                choice_path=plan_folder/(digest({'dataset':ds.spec['name'],'stage':slot['stage']})[:16]+'.choices.json')
                                if choice_path.exists():
                                    choices=read_json(choice_path)['run_ids']
                                    rank=slot['selector']['rank']
                                    if rank>=len(choices):
                                        raise ValueError('Insufficient distinct successful finalists for this slot')
                                    selected=self.registry.get(choices[rank])
                                else:
                                    pool=[self.registry.get(p['run_id']) for name,p in progress.items()
                                        if name.startswith(ds.spec['name']+'/') and p.get('run_id') and p['status']=='completed']
                                    pool=[entry for entry in pool if entry['stage'] in slot['selector']['stages']]
                                    if slot['stage']=='full' and c['sweep']['full_allowed']:
                                        pool=[entry for entry in pool if any(all(
                                            lookup(entry['config'],key,ds.spec) in values(value)
                                            for key,value in condition.items()) for condition in c['sweep']['full_allowed'])]
                                    stabilities={}
                                    for comparison in self.registry.rows('comparison'):
                                        if comparison.get('stability_evidence') is False:
                                            continue
                                        metric=comparison.get('metrics',{}).get('excluding_noise_in_either',{})
                                        if 'adjusted_rand' in metric:
                                            stabilities.setdefault(comparison['reference'],[]).append(metric['adjusted_rand'])
                                    stabilities={key:sum(value)/len(value) for key,value in stabilities.items()}
                                    if slot['stage']=='full' and c['sweep']['full_representation_limit']:
                                        ranked=sorted(pool,key=lambda e:-evaluate.score(e['metrics'],c['sweep']['selection']))
                                        allowed=[]
                                        for entry in ranked:
                                            key=digest(entry['config']['representation'])
                                            if key not in allowed:
                                                allowed.append(key)
                                            if len(allowed)>=c['sweep']['full_representation_limit']:
                                                break
                                        pool=[entry for entry in pool if digest(entry['config']['representation']) in allowed]
                                    if slot['stage']=='full':
                                        unique={}
                                        for entry in sorted(pool,key=lambda e:-evaluate.score(e['metrics'],c['sweep']['selection'])):
                                            key=digest({k:entry['config'][k] for k in ('representation','reduction','clustering')})
                                            unique.setdefault(key,entry)
                                        pool=list(unique.values())
                                    selected_set=evaluate.shortlist(pool,c['sweep']['finalists'],c['sweep']['selection'],stabilities)
                                    if not selected_set:
                                        raise ValueError('No successful candidate available for selection')
                                    rank=slot['selector']['rank']
                                    if rank>=len(selected_set):
                                        raise ValueError(f'Only {len(selected_set)} distinct candidates for finalist rank {rank}')
                                    selected=selected_set[rank]
                                    atomic_json(choice_path,{'run_ids':[e['id'] for e in selected_set],
                                        'criterion':c['sweep']['selection'],'stability_available':stabilities,
                                        'tradeoffs':'score, coverage, stability where available, fine groups, limited largest group'})
                                c=deepcopy(selected['config'])
                                if slot['stage']=='refine':
                                    factor=c['sweep']['min_cluster_size_factors'][slot['refinement']%len(c['sweep']['min_cluster_size_factors'])]
                                    size=c['clustering']['min_cluster_size']
                                    c['clustering']['min_cluster_size']={'fraction':min(.95,size['fraction']*factor)} if isinstance(size,dict) else max(2,round(size*factor))
                                if 'seed' in slot:
                                    c['seed']=slot['seed']
                                if 'sample_seed' in slot:
                                    c['sample_seed']=slot['sample_seed']
                                if slot['stage']=='full':
                                    c['sample_size']=None
                            else:
                                c=slot['config']
                                selected=None
                            result=self.run_one(ds,c,slot['stage'],plan_id,slot['slot'])
                            if 'selector' in slot and slot['stage'] in ('stability','full'):
                                comparison=evaluate.stability(pd.read_parquet(Path(selected['folder'])/'assignments.parquet'),
                                    pd.read_parquet(Path(result['folder'])/'assignments.parquet'))
                                atomic_json(plan_folder/(digest(slot['slot'])[:16]+'.stability.json'),
                                    {'reference':selected['id'],'candidate':result['id'],**comparison})
                                comparison_id=digest({'reference':selected['id'],'candidate':result['id'],'metrics':comparison})[:24]
                                self.registry.put(comparison_id,'comparison','completed',
                                    {'reference':selected['id'],'candidate':result['id'],'metrics':comparison,
                                     'stability_evidence':selected['config']['seed']!=result['config']['seed'] or selected['identity']['ordered_ids']!=result['identity']['ordered_ids'],
                                     'perturbation_note':'A sample seed on a full corpus changes no IDs; such self-consistency comparisons do not count as stability evidence.'})
                        progress[slot['slot']]={'status':'completed','run_id':result['id'] if slot['stage']!='layout' else None,
                                               'layout_id':result['id'] if slot['stage']=='layout' else None}
                        self.registry.put(sid,'slot','completed',{'plan_id':plan_id,**slot,'result_id':result['id']})
                        if slot['stage']=='layout':
                            export(self.registry,Path(self.config['output'])/'gallery')
                    except (KeyboardInterrupt,datasets.DataProblem):
                        raise
                    except Exception as error:
                        progress[slot['slot']]={'status':'failed','error':str(error)}
                        self.registry.put(sid,'slot','failed',{'plan_id':plan_id,**slot,'error':str(error)})
                        print(f'Candidate failed; continuing: {error}',flush=True)
                    atomic_json(state_path,progress)
                    gc.collect()
                export(self.registry,Path(self.config['output'])/'gallery')
                failed=sum(p['status']=='failed' for p in progress.values())
                atomic_json(plan_folder/'summary.json',{'attempts':len(current_plan['slots']),
                    'completed':sum(p['status']=='completed' for p in progress.values()),'failed':failed,'finished_at':now()})
                print(f'Plan finished: {len(progress)} checkpointed attempts; {failed} failures',flush=True)
                return 1 if failed else 0
        except (KeyboardInterrupt,datasets.DataProblem) as error:
            atomic_json(Path(self.config['output'])/'stop-reason.json',{'reason':str(error),'at':now(),'current':self.current})
            for row in self.registry.rows():
                if row['status']=='running':
                    self.registry.put(row['id'],row['kind'],'interrupted',{**row,'error':str(error)})
            print(f'Stopped at resumable checkpoint: {error}',flush=True)
            return 130 if isinstance(error,KeyboardInterrupt) else 2
        finally:
            for sig,handler in previous.items():
                signal.signal(sig,handler)
            self.registry.close()
