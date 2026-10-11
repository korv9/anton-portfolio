from __future__ import annotations

from collections import Counter

import numpy as np
import pandas as pd
from sklearn.metrics import adjusted_rand_score, adjusted_mutual_info_score, silhouette_score

from ml.jobs.sweep import structure
from .io import atomic_json, atomic_parquet


def unavailable(reason):
    return {'value':None,'reason':reason}


def silhouette(vectors,labels,metric):
    keep=labels>=0
    values=labels[keep]
    if not 1<len(set(values))<len(values):
        return unavailable('Fewer than two non-noise clusters or no within-cluster pairs in evaluation sample')
    try:
        return {'value':float(silhouette_score(vectors[keep],values,metric=metric)),
                'observations':int(keep.sum()),'noise':'excluded','metric':metric}
    except ValueError as error:
        return unavailable(str(error))


def evaluate(frame,vectors,space,labels,model,config,folder):
    ec=config['evaluation']
    indices=np.sort(np.random.default_rng(ec['seed']).choice(len(frame),min(ec['sample_size'],len(frame)),replace=False))
    atomic_parquet(frame.iloc[indices][['observation_id']],folder/'evaluation-ids.parquet')
    employers=frame.employer.to_numpy() if 'employer' in frame else np.array(['']*len(frame))
    metrics=structure(labels,employers)
    metrics.update(observations=len(frame),coverage=float((labels>=0).mean()),
        silhouette_original=silhouette(np.asarray(vectors[indices]),labels[indices],ec['silhouette_metric']),
        silhouette_analyzed=silhouette(np.asarray(space[indices]),labels[indices],config['clustering']['metric']),
        evaluation_sample={'size':len(indices),'seed':ec['seed'],'ids':'evaluation-ids.parquet'},
        persistence={'value':model.cluster_persistence_.tolist()} if hasattr(model,'cluster_persistence_')
            else unavailable('This implementation/method does not expose cluster_persistence_'),
        mean_probability={'value':float(model.probabilities_[labels>=0].mean())} if hasattr(model,'probabilities_') and (labels>=0).any()
            else unavailable('No assigned observations or estimator has no membership probabilities'))
    dominance={}
    for field in ['employer','year','occupation_field','occupation_code','region','document_id','author','language','tradition','symbol_id']:
        if field not in frame:
            continue
        parts=pd.DataFrame({'cluster':labels,'value':frame[field].astype(str).to_numpy()})
        valid=parts[(parts.cluster>=0)&~parts.value.isin(['','None','nan'])]
        counts=valid.groupby(['cluster','value']).size()
        top=counts.groupby(level=0).max() if len(counts) else pd.Series(dtype=float)
        sizes=parts[parts.cluster>=0].groupby('cluster').size()
        dominance[field]={'weighted_top_share':float(top.sum()/max(1,(labels>=0).sum())),
            'missing_share':float(parts.value.isin(['','None','nan']).mean()),
            'per_cluster_top_share':{str(k):float(v/sizes[k]) for k,v in top.items()},
            'note':'Missing metadata excluded from top value, retained in denominator'}
    metrics['dominance']=dominance
    return metrics


def stability(left,right):
    joined=left[['observation_id','cluster']].merge(right[['observation_id','cluster']],on='observation_id',suffixes=('_a','_b'),validate='one_to_one')
    a,b=joined.cluster_a.to_numpy(),joined.cluster_b.to_numpy()
    both=(a>=0)&(b>=0)
    def metrics(x,y):
        if len(x)<2:
            return unavailable('Fewer than two common assigned observations')
        return {'adjusted_rand':float(adjusted_rand_score(x,y)),
                'adjusted_mutual_information':float(adjusted_mutual_info_score(x,y))}
    return {'common_ids':len(joined),'left_total':len(left),'right_total':len(right),
        'left_coverage_on_common':float((a>=0).mean()) if len(a) else None,
        'right_coverage_on_common':float((b>=0).mean()) if len(b) else None,
        'both_assigned':int(both.sum()),'including_noise_as_one_group':metrics(a,b),
        'excluding_noise_in_either':metrics(a[both],b[both]),
        'label_matching':'ARI and AMI are invariant to cluster-label permutations; IDs inner-joined'}


def profiles(dataset,frame,vectors,labels,config,folder):
    ec=config['evaluation']
    rng=np.random.default_rng(ec['seed'])
    selected=[]
    rows=[]
    cluster_ids=sorted(set(labels)-{-1})
    term_limit=min(ec['profile_sample_per_cluster'],max(1,ec['profile_total_term_samples']//max(1,len(cluster_ids))))
    for label in cluster_ids:
        indices=np.flatnonzero(labels==label)
        centroid_sample=rng.choice(indices,min(ec['centroid_sample_per_cluster'],len(indices)),replace=False)
        center=np.asarray(vectors[centroid_sample]).mean(axis=0)
        # Dot-product ranking in original normalized features; sampled centroid for very large groups.
        distances=np.empty(len(indices),dtype='float32')
        for offset in range(0,len(indices),20000):
            distances[offset:offset+20000]=np.linalg.norm(vectors[indices[offset:offset+20000]]-center,axis=1)
        representative=indices[np.argsort(distances,kind='stable')[:ec['examples']]]
        random=rng.choice(indices,min(ec['examples'],len(indices)),replace=False)
        selected.extend(representative.tolist()+random.tolist())
        # Term profiling uses a recorded, deterministic sample per cluster.
        terms=rng.choice(indices,min(term_limit,len(indices)),replace=False)
        selected.extend(terms.tolist())
        rows.append({'cluster':int(label),'size':len(indices),'label_status':'preliminary automatic terms',
            'representative_ids':frame.iloc[representative].observation_id.tolist(),
            'random_ids':frame.iloc[random].observation_id.tolist(),
            'term_sample_ids':frame.iloc[terms].observation_id.tolist()})
        rows[-1]['centroid_sample_ids']=frame.iloc[centroid_sample].observation_id.tolist()
    selected_frame=frame.iloc[sorted(set(selected))]
    text_lookup={}
    for part in dataset.texts(selected_frame,config['resources']):
        for row in part.itertuples():
            text_lookup[row.observation_id]=str(getattr(row,'description',getattr(row,'context','')))
    for row in rows:
        texts=[text_lookup[oid] for oid in row['term_sample_ids']]
        row['representative_examples']=[{'id':oid,'text':text_lookup[oid],
            'metadata':frame.loc[frame.observation_id.eq(oid)].iloc[0].to_dict()} for oid in row.pop('representative_ids')]
        row['random_examples']=[{'id':oid,'text':text_lookup[oid]} for oid in row.pop('random_ids')]
        row['_text']=' '.join(texts)
    if rows:
        import sys
        from .io import ROOT
        sys.path.insert(0,str(ROOT/'platform/nlp/symbolic'))
        from rank_clusters import ctfidf, stop_words
        stops=ec['profile_stop_words']
        if stops=='auto':
            stops=stop_words()
            if dataset.spec['adapter']=='jobs':
                stops=sorted(set(stops)|set('och i att en ett för med på till som av är har vi du din våra den det om eller dig oss hos vara blir från så även kan ska kommer söker söka'.split()))
        try:
            keywords=ctfidf({row['cluster']:[row['_text']] for row in rows},top=ec['terms'],
                max_features=ec['profile_max_features'],stop_words_override=stops,
                token_pattern=r'(?u)\b[^\W\d_][^\W\d_]{2,}\b')
            for row in rows:
                row['characteristic_terms']=[{'term':keyword['term'],'weight':keyword['score']}
                    for keyword in keywords if keyword['cluster_id']==row['cluster']]
        except ValueError as error:
            for row in rows:
                row['terms_unavailable']=str(error)
    for row in rows:
        row.pop('_text',None)
    result={'method':'existing Atlas class-based TF-IDF across term-sample documents; original-feature centroid examples',
        'stop_words':stops if rows else [],'token_pattern':r'(?u)\b[^\W\d_][^\W\d_]{2,}\b',
        'term_sample_per_cluster':term_limit,'requested_term_sample_per_cluster':ec['profile_sample_per_cluster'],
        'configured_total_term_sample_budget':ec['profile_total_term_samples'],
        'centroid_sample_max':ec['centroid_sample_per_cluster'],'seed':ec['seed'],'profiles':rows}
    atomic_json(folder/'profiles.json',result)
    return result


def score(metrics,selection):
    if metrics['cluster_count']<selection['min_clusters']:
        return -100.0
    separation=metrics['silhouette_original']['value']
    # Missing separation cannot masquerade as zero quality or win selection.
    if separation is None:
        return -99.0
    dominance=max((v['weighted_top_share'] for k,v in metrics['dominance'].items()
        if k in ('employer','document_id','author')),default=0)
    return (selection['silhouette_weight']*separation-selection['noise_weight']*metrics['noise_share']
        -selection['largest_weight']*metrics['largest_cluster_share']-selection['dominance_weight']*dominance)


def shortlist(entries,count,selection,stabilities=None):
    viable=[e for e in entries if e['status']=='completed']
    ranked=sorted(viable,key=lambda e:(-score(e['metrics'],selection),e['id']))
    if not ranked:
        return []
    # Retain distinct tradeoffs rather than only the same score's near-duplicates.
    stable=[]
    if stabilities:
        supported=[entry for entry in ranked if entry['id'] in stabilities]
        if supported:
            stable=[max(supported,key=lambda e:stabilities[e['id']])]
    order=[ranked[0],min(ranked,key=lambda e:e['metrics']['noise_share']),*stable,
        max(ranked,key=lambda e:e['metrics']['cluster_count']),
        min(ranked,key=lambda e:e['metrics']['largest_cluster_share'])]+ranked
    picked=[]
    for entry in order:
        if entry['id'] not in [e['id'] for e in picked]:
            picked.append(entry)
        if len(picked)>=count:
            break
    return picked
