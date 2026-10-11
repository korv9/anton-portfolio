from copy import deepcopy
import json
from pathlib import Path
import subprocess
import sys

import numpy as np
import pandas as pd
import pytest
import yaml

from ml.cluster_lab.config import DEFAULTS, load, merge, validate, values
from ml.cluster_lab import datasets
from ml.cluster_lab.io import atomic_json, atomic_parquet, digest, file_hash
from ml.cluster_lab.registry import Registry
from ml.cluster_lab.representations import representation_identity
from ml.cluster_lab.evaluate import stability
from ml.cluster_lab.sweep import candidates, plan, Runner


def config(tmp_path):
    return merge(DEFAULTS,{'output':str(tmp_path/'results'),'cache':str(tmp_path/'cache'),
        'datasets':[{'name':'jobs','adapter':'jobs','path':str(tmp_path/'raw'),
                     'start':'2023-01-01','end':'2027-01-01','as_of':'2026-10-10'}],
        'representation':{'kind':'tfidf_svd'},'reduction':{'method':'none'},
        'clustering':{'method':'kmeans','n_clusters':3},'layouts':{'count':0},
        'sweep':{'coarse_candidates':0,'finalists':0}})


def corpus(tmp_path):
    from importlib.util import spec_from_file_location, module_from_spec
    spec=spec_from_file_location('full_corpus',Path('platform/ingest/jobtech/full_corpus.py'))
    module=module_from_spec(spec); spec.loader.exec_module(module)
    rows=[]
    for i in range(60):
        rows.append(module.record({'id':str(i),'publication_date':f'{2023+i%4}-02-01T12:00:00',
            'headline':f'Nurse care hospital {i}' if i%2 else f'Teacher school mathematics {i}',
            'description':{'text':f'care hospital nurse students school education mathematics unique{i}'},
            'occupation_field':{'concept_id':str(i%3),'label':['Health','Education','Agriculture'][i%3]},
            'employer':{'name':f'Employer{i%5}'},'workplace_address':{'region':'Stockholm'}},'unit-test', '2026-10-10'))
    for i,day in enumerate(['2022-12-31','2027-01-01','2026-10-11']):
        rows.append({**rows[0],'observation_id':f'excluded-{i}','published_at':day})
    rows.append(rows[0].copy())
    folder=tmp_path/'raw'/'archive';folder.mkdir(parents=True)
    atomic_parquet(pd.DataFrame(rows),folder/'part.parquet')
    atomic_json(folder/'state.json',{'status':'completed','source_sha256':'test','lines':len(rows),
        'source':'synthetic unit-test fixture; never used for lab results','shards':['part.parquet']})
    return rows


def test_config_overrides_ranges_and_rejects(tmp_path):
    path=tmp_path/'config.yaml'
    path.write_text(yaml.safe_dump({'datasets':[{'name':'jobs','adapter':'jobs'}]}),encoding='utf-8')
    c=load(path,['clustering.min_samples=3'])
    assert c['clustering']['min_samples']==3 and c['_overrides']==['clustering.min_samples=3']
    assert values({'range':{'start':.05,'stop':.15,'step':.05}})==[.05,.1,.15]
    with pytest.raises(ValueError,match='Unknown'):
        load(path,['clustering.missing=10'])
    with pytest.raises(ValueError):
        load(path,['reduction.n_neighbors=1'])
    with pytest.raises(ValueError):
        load(path,['representation.revision=main'])


def test_all_occupations_dates_coverage_and_samples(tmp_path):
    corpus(tmp_path);c=config(tmp_path)
    ds=datasets.load(c['datasets'][0],c)
    assert len(ds.metadata)==60
    assert set(ds.manifest['coverage']['years'])=={2023,2024,2025,2026}
    assert ds.manifest['coverage']['2026_incomplete_calendar_year']
    assert set(ds.metadata.occupation_field)=={'Health','Education','Agriculture'}
    assert not ds.metadata.observation_id.str.startswith('excluded').any()
    a,info=ds.sample(30,42);b,_=ds.sample(30,42)
    assert a.equals(b) and info['kind']=='sample'
    assert len(a.groupby(['year','occupation_field_id']))==len(ds.metadata.groupby(['year','occupation_field_id']))
    full,info=ds.sample(None,42)
    assert len(full)==60 and info['kind']=='full'


def test_cache_identity_changes_for_text_model_preprocess_and_seed(tmp_path):
    corpus(tmp_path);c=config(tmp_path);ds=datasets.load(c['datasets'][0],c)
    frame=ds.metadata
    key=representation_identity(ds,frame,c)
    for patch in [{'preprocessing':'boilerplate'},{'model':'different-model'}, {'title_weight':2}]:
        assert representation_identity(ds,frame,merge(c,{'representation':patch}))!=key
    changed=frame.copy();changed.loc[0,'text_hash']='new text'
    assert representation_identity(ds,changed,c)!=key
    assert representation_identity(ds,frame,{**c,'seed':44})!=key


def test_registry_lock_crash_recovery_and_atomic_status(tmp_path):
    registry=Registry(tmp_path/'register')
    with registry.writer():
        registry.put('a','run','running',{})
        script='from ml.cluster_lab.registry import Registry; r=Registry(__import__("sys").argv[1]);\nwith r.writer(): pass'
        result=subprocess.run([sys.executable,'-c',script,str(registry.root)],capture_output=True)
        assert result.returncode!=0 and b'Another process holds' in result.stderr
    with registry.writer():
        assert registry.get('a')['status']=='interrupted'
        registry.put('a','run','completed',{'example':1})
        with pytest.raises(ValueError,match='immutable'):
            registry.put('a','run','running',{})
        registry.put('b','run','failed',{'error':'recorded'})
        assert registry.get('b')['error']=='recorded'
    registry.close()
    path=tmp_path/'atomic.json';atomic_json(path,{'complete':True})
    assert json.loads(path.read_text())['complete'] and not list(tmp_path.glob('*.tmp'))


def test_stability_matches_ids_and_permuted_labels():
    a=pd.DataFrame({'observation_id':['a','b','c','d','e'],'cluster':[0,0,1,1,-1]})
    b=pd.DataFrame({'observation_id':['d','c','b','a','e'],'cluster':[12,12,7,7,-1]})
    metrics=stability(a,b)
    assert metrics['excluding_noise_in_either']['adjusted_rand']==1
    assert metrics['including_noise_as_one_group']['adjusted_rand']==1
    assert metrics['both_assigned']==4


def test_finite_plan_conditional_candidates_and_full_invariant(tmp_path):
    corpus(tmp_path);c=config(tmp_path);ds=datasets.load(c['datasets'][0],c)
    c=merge(c,{'sweep':{'coarse_candidates':4,'finalists':2,'refinements_per_finalist':1,
        'sample_sizes':[30,40],'stability_seeds':[43],'stability_sample_seeds':[],
        'full_seeds':[42,43],'search':[{'parameters':{'reduction.method':['pca','umap']}},
            {'when':{'reduction.method':'pca'},'parameters':{'reduction.n_components':[2,3]}},
            {'when':{'reduction.method':'umap'},'parameters':{'reduction.n_components':[4,5]}}]},
        'layouts':{'count':2}})
    choices=candidates(c,ds.spec)
    assert len(choices)==4
    assert all(x['reduction']['n_components'] in ([2,3] if x['reduction']['method']=='pca' else [4,5]) for x in choices)
    p=plan(c,[ds],{'test':'provenance'})
    assert len(p['slots'])==25
    assert p['global_time_limit'] is None
    runner=Runner(config(tmp_path))
    with runner.registry.writer():
        result=runner.run_one(ds,config(tmp_path),'full','test-plan','full')
        assert result['full_fit'] and result['metrics']['observations']==60
        assignments=Path(result['folder'])/'assignments.parquet'
        before=file_hash(assignments)
        # Completed fits are reused on resume rather than rewriting labels.
        result2=runner.run_one(ds,config(tmp_path),'full','test-plan','full')
        assert result2['id']==result['id'] and file_hash(assignments)==before
    runner.registry.close()


def test_layout_does_not_refit_or_change_labels(tmp_path):
    from ml.cluster_lab.layouts import create
    corpus(tmp_path);c=config(tmp_path);ds=datasets.load(c['datasets'][0],c)
    runner=Runner(c)
    with runner.registry.writer():
        run=runner.run_one(ds,c,'full','test-plan','full')
        target=Path(run['folder'])/'assignments.parquet';before=file_hash(target)
        params={'n_neighbors':5,'min_dist':.1,'n_components':2,'metric':'cosine','random_state':42,
                'n_jobs':1,'init':'random','n_epochs':20}
        layout=create(run,params,c,runner.registry,preview=False)
        assert file_hash(target)==before and layout['parent_run_id']==run['id']
        points=pd.read_parquet(Path(layout['folder'])/'coordinates.parquet')
        assert points.observation_id.tolist()==pd.read_parquet(target).observation_id.tolist()
    runner.registry.close()


def test_real_plan_resumes_after_interruption_without_repeating_completed(tmp_path):
    corpus(tmp_path)
    c=config(tmp_path)
    c['datasets']=[{**c['datasets'][0],'name':'a'},{**c['datasets'][0],'name':'b'}]
    first=Runner(c)
    original=first.run_one
    calls=[]
    def interrupt_after_one(ds,*args):
        result=original(ds,*args)
        calls.append(result)
        first.stop_requested=True
        return result
    first.run_one=interrupt_after_one
    assert first.run(resume=True)==130
    assert len(calls)==1
    before=file_hash(Path(calls[0]['folder'])/'assignments.parquet')
    second=Runner(c)
    original_second=second.run_one
    resumed=[]
    def record(ds,*args):
        resumed.append(ds.spec['name'])
        return original_second(ds,*args)
    second.run_one=record
    assert second.run(resume=True)==0
    assert resumed==['b']
    assert file_hash(Path(calls[0]['folder'])/'assignments.parquet')==before


def test_embedding_checkpoint_survives_eviction_in_float16(tmp_path,monkeypatch):
    import types
    import sqlite3
    from ml.cluster_lab.representations import build
    corpus(tmp_path);c=config(tmp_path)
    c=merge(c,{'representation':{'kind':'embedding','storage_dtype':'float16'},
        'resources':{'embedding_checkpoint_rows':16,'text_vector_cache_rows':2}})
    ds=datasets.load(c['datasets'][0],c)
    class Tokenizer:
        def num_special_tokens_to_add(self): return 2
        def encode(self,text,**kwargs): return [len(word) for word in text.split()]
        def decode(self,tokens,**kwargs): return ' '.join('x'*n for n in tokens)
    class Encoder:
        max_seq_length=32
        tokenizer=Tokenizer()
        def __init__(self,*args,**kwargs): pass
        def __getitem__(self,index):
            return types.SimpleNamespace(auto_model=types.SimpleNamespace(config=types.SimpleNamespace(_commit_hash=c['representation']['revision'])))
        def encode(self,texts,**kwargs):
            rows=[]
            for text in texts:
                vector=np.random.default_rng(int(digest(text)[:8],16)).normal(size=8).astype('float32')
                rows.append(vector/np.linalg.norm(vector))
            return np.asarray(rows)
    monkeypatch.setitem(sys.modules,'sentence_transformers',types.SimpleNamespace(SentenceTransformer=Encoder))
    count=0
    def stop():
        nonlocal count
        count+=1
        if count==2: raise KeyboardInterrupt('unit-test checkpoint interruption')
    with pytest.raises(KeyboardInterrupt): build(ds,ds.metadata,c,stop)
    folders=list((Path(c['cache'])/'representations').iterdir())
    folder=folders[0]
    with sqlite3.connect(folder/'embedding-progress.sqlite') as con:
        committed=[row[0] for row in con.execute('select position from cells')]
    assert len(committed)==16
    checkpoint=np.load(folder/'raw.tmp.npy')[committed].copy()
    matrix,info=build(ds,ds.metadata,c)
    assert matrix.dtype==np.float16 and matrix.shape==(60,8)
    assert np.array_equal(matrix[committed],checkpoint)
    assert info['storage_dtype']=='float16'


def test_metadata_change_invalidates_dataset_manifest(tmp_path):
    corpus(tmp_path);c=config(tmp_path)
    ds=datasets.load(c['datasets'][0],c)
    path=tmp_path/'raw'/'archive'/'part.parquet'
    rows=pd.read_parquet(path);rows.loc[1,'employer']='Changed metadata'
    atomic_parquet(rows,path)
    changed=datasets.load(c['datasets'][0],c)
    assert changed.manifest['dataset_id']!=ds.manifest['dataset_id']
