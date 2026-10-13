from copy import deepcopy
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from ml.cluster_lab.config import DEFAULTS, merge, validate_trial
from ml.cluster_lab.datasets import Dataset
from ml.cluster_lab.evaluate import stability
from ml.cluster_lab.public_research import passages
from ml.cluster_lab.representations import build, representation_identity
from ml.research.prepare_public_profiles import clean
from ml.research.public_results import full_runs


def test_passages_preserve_disjoint_source_offsets_and_merge_short_tail():
    text='\n '.join(f'word{i}' for i in range(275))
    spans=passages(text,120,40)
    assert [n for _,_,n in spans]==[120,155]
    assert spans[0][1]<=spans[1][0]
    restored=[word for a,b,_ in spans for word in text[a:b].split()]
    assert restored==text.split()
    assert passages('short speech',120,40)==[]


def test_cleanup_removes_observed_word_fields_and_preserves_spoken_text():
    source='Fru talman! arbetslös-\nheten ökar.\n STYLEREF Kantrubrik \\* MERGEFORMAT Partiledardebatt\nDet måste förändras.'
    assert clean(source)=='Fru talman! arbetslösheten ökar. Det måste förändras.'
    assert clean('Partiledardebatt om arbetslöshet')=='Partiledardebatt om arbetslöshet'


def test_full_county_pilot_is_evaluation_evidence_but_small_text_pilot_is_not():
    class Registry:
        def rows(self,kind):
            return [
                {'id':'counties','status':'completed','full_fit':True,'stage':'pilot'},
                {'id':'sample','status':'completed','full_fit':False,'stage':'pilot'},
                {'id':'full','status':'completed','full_fit':True,'stage':'full'},
                {'id':'ablation','status':'completed','full_fit':True,'stage':'feature_sensitivity'},
            ]
    assert [r['id'] for r in full_runs(Registry())]==['counties','full']


def test_frozen_lexical_seed_is_independent_of_umap_seed(tmp_path):
    config=merge(DEFAULTS,{'representation':{'kind':'tfidf_svd','fit_seed':42}})
    frame=pd.DataFrame({'observation_id':['a','b'],'text_hash':['x','y']})
    ds=Dataset({'adapter':'snapshot'},tmp_path,{'dataset_id':'frozen'},frame)
    changed=deepcopy(config)
    changed['seed']=44
    assert representation_identity(ds,frame,config)==representation_identity(ds,frame,changed)


def test_numeric_profiles_use_units_aware_scaling_and_never_text_embeddings(tmp_path):
    frame=pd.DataFrame({'observation_id':['01:2024','03:2024','04:2024'],
        'region_name':['A','B','C'],'income':[10000.,20000.,30000.],
        'rate':[1.,2.,3.],'text_hash':['a','b','c']})
    path=tmp_path/'observations.parquet'
    frame.to_parquet(path,index=False)
    ds=Dataset({'adapter':'snapshot','family':'numeric'},path,{'dataset_id':'frozen'},frame)
    c=merge(DEFAULTS,{'cache':str(tmp_path/'cache'),'representation':{
        'kind':'numeric','normalize':False,'numeric_features':['income','rate']}})
    vectors,info=build(ds,frame,c)
    np.testing.assert_allclose(vectors[:,0],vectors[:,1],atol=1e-6)
    np.testing.assert_allclose(vectors.std(axis=0),[1,1],atol=1e-6)
    assert vectors.dtype==np.float32
    assert Path(info['scaler_path']).exists()
    with pytest.raises(ValueError,match='must not be text-embedded'):
        validate_trial(merge(c,{'representation':{'kind':'embedding'}}),ds.spec)


def test_noise_switching_uses_shared_ids_and_keeps_core_denominator():
    a=pd.DataFrame({'observation_id':['a','b','c','d'],'cluster':[-1,-1,0,0]})
    b=pd.DataFrame({'observation_id':['d','c','b','a'],'cluster':[1,1,1,-1]})
    result=stability(a,b)
    assert result['noise_switch_share']==.25
    assert result['both_assigned_share']==.5
    assert result['common_ids']==4
