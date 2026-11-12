import json

import numpy as np
import pandas as pd

from ml.cluster_lab.config import merge
from ml.cluster_lab.feed import DEFAULTS, ENTRY, check, run_one

SOURCE={'implementation_hashes':{},'commit':'test'}


def setup(tmp_path,frame,**entry):
    path=tmp_path/'input.parquet'
    frame.to_parquet(path,index=False)
    config=merge(DEFAULTS,{'output':str(tmp_path/'features'),'publish':str(tmp_path/'publish'),
        'validation':{'resamples':10,'nulls':20}})
    e=check(merge(ENTRY,{'name':'t','id':'id','query':f"select * from read_parquet('{path.as_posix()}')",**entry}))
    return e,config


def blobs(seed=0,n=60):
    rng=np.random.default_rng(seed)
    centres=np.array([[0,0,0],[8,0,0],[0,8,0]])
    x=np.concatenate([c+rng.normal(size=(n,3)) for c in centres])
    return pd.DataFrame({'id':[f'e{i}' for i in range(len(x))],'a':x[:,0],'b':x[:,1],'c':x[:,2],
        'known':np.repeat(['p','q','r'],n)})


def test_separated_groups_are_a_stable_finding(tmp_path):
    e,config=setup(tmp_path,blobs(),reference='known',k=[2,6])
    result=run_one(e,config,SOURCE)
    assert result['k']==3 and result['verdict']=='finding'
    assert result['ari']>0.9 and result['null_p']<0.05 and result['ami']>0.9
    body=json.loads((tmp_path/'publish/t.json').read_text(encoding='utf-8'))
    assert body['diagnostics']['reference']['label']=='known'
    assert sum(c['size'] for c in body['clusters'])==180 and len(body['points'])==180


def test_noise_is_not_reported_as_a_finding(tmp_path):
    rng=np.random.default_rng(1)
    frame=pd.DataFrame({'id':range(150),**{f'f{j}':rng.normal(size=150) for j in range(4)}})
    e,config=setup(tmp_path,frame,k=[2,6])
    assert run_one(e,config,SOURCE)['verdict']!='finding'


def test_small_samples_are_descriptive_and_incomplete_rows_listed(tmp_path):
    frame=blobs(n=8)
    frame.loc[0,'a']=None
    e,config=setup(tmp_path,frame,method='ward',k=[2,4])
    result=run_one(e,config,SOURCE)
    body=json.loads((tmp_path/'publish/t.json').read_text(encoding='utf-8'))
    assert result['verdict']=='descriptive' and body['diagnostics']['dropped_incomplete']==['e0']


def test_chain_finds_contiguous_eras(tmp_path):
    rng=np.random.default_rng(2)
    x=np.concatenate([rng.normal(m,0.3,size=(10,3)) for m in (0,3,6)])
    frame=pd.DataFrame({'id':range(30),'t1':x[:,0],'t2':x[:,1],'t3':x[:,2]})
    e,config=setup(tmp_path,frame,method='chain',resample='columns',transform='none',k=[2,5])
    run_one(e,config,SOURCE)
    labels=pd.read_parquet(tmp_path/'features/t/assignments.parquet').cluster.to_numpy()
    assert (np.diff(labels)!=0).sum()==2


def test_periods_give_shares_and_flows(tmp_path):
    frame=blobs(n=40)
    frame['year']=np.tile([2020,2021],60)
    frame['id']=np.repeat([f'm{i}' for i in range(60)],2)
    e,config=setup(tmp_path,frame,period='year',k=[3,3])
    run_one(e,config,SOURCE)
    body=json.loads((tmp_path/'publish/t.json').read_text(encoding='utf-8'))
    assert body['shares']['periods']==['2020','2021']
    assert all(abs(sum(row)-1)<1e-3 for row in body['shares']['values'])
    assert sum(f['count'] for f in body['flows'])==60


def test_coclustering_labels_columns(tmp_path):
    rng=np.random.default_rng(3)
    counts=rng.poisson(1,size=(60,6)).astype(float)
    counts[:30,:3]+=20
    counts[30:,3:]+=20
    frame=pd.DataFrame(counts,columns=[f'c{j}' for j in range(6)])
    frame.insert(0,'id',range(60))
    e,config=setup(tmp_path,frame,method='cocluster',transform='clr',k=[2,2])
    run_one(e,config,SOURCE)
    body=json.loads((tmp_path/'publish/t.json').read_text(encoding='utf-8'))
    assert sorted(len(c['columns']) for c in body['clusters'])==[3,3]
