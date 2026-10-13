"""Merge near-duplicate clusters and return noise to a cluster, both in the original representation.

HDBSCAN on a UMAP space splits one subject into several dense groups and leaves the sparse
remainder as noise. Both steps here judge by cosine similarity to cluster centroids after the
corpus mean is removed, so the decision does not depend on the reduction that found the groups.
"""
from __future__ import annotations

import numpy as np


def _centroids(unit,labels):
    ids=np.array(sorted(set(labels)-{-1}))
    centres=np.vstack([unit[labels==i].mean(axis=0) for i in ids])
    return ids,centres/np.linalg.norm(centres,axis=1,keepdims=True)


def _reassign(unit,labels,quantile,margin):
    """Noise joins its nearest centroid when at least as close as that cluster's `quantile` member."""
    ids,centres=_centroids(unit,labels)
    similarity=unit@centres.T
    order=np.argsort(similarity,axis=1)
    best,second=order[:,-1],order[:,-2]
    rows=np.arange(len(unit))
    top,gap=similarity[rows,best],similarity[rows,best]-similarity[rows,second]
    floor=np.array([np.quantile(similarity[labels==i,k],quantile) for k,i in enumerate(ids)])
    accept=(labels<0)&(top>=floor[best])&(gap>=margin)
    return np.where(accept,ids[best],labels)


def refine(vectors,labels,merge_similarity=None,reassign_quantile=None,reassign_margin=0.0,seed=42):
    labels=np.asarray(labels).astype(int).copy()
    info={'core_clusters':int(len(set(labels)-{-1})),'core_noise_share':float((labels<0).mean())}
    if (merge_similarity is None and reassign_quantile is None) or info['core_clusters']<3:
        return labels,info
    unit=np.asarray(vectors,dtype='float32')
    unit=unit-unit.mean(axis=0)
    unit/=np.linalg.norm(unit,axis=1,keepdims=True).clip(min=1e-12)
    if merge_similarity is not None:
        from sklearn.cluster import AgglomerativeClustering
        ids,centres=_centroids(unit,labels)
        groups=AgglomerativeClustering(n_clusters=None,metric='cosine',linkage='average',
            distance_threshold=1-merge_similarity).fit_predict(centres)
        merged={}
        for cluster,group in zip(ids.tolist(),groups.tolist()):
            merged.setdefault(group,[]).append(cluster)
        # Largest first, so cluster 0 is always the biggest group after merging.
        ordered=sorted(merged.values(),key=lambda members:-int(np.isin(labels,members).sum()))
        mapping={cluster:new for new,members in enumerate(ordered) for cluster in members}
        labels=np.array([mapping.get(label,-1) for label in labels.tolist()])
        info['merged']={'similarity':merge_similarity,'clusters':len(ordered),
            'groups':[members for members in ordered if len(members)>1]}
    if reassign_quantile is not None and len(set(labels)-{-1})>=2:
        # Hide a fifth of the clustered points, treat them as noise and see where the rule puts them.
        rng=np.random.default_rng(seed)
        assigned=np.flatnonzero(labels>=0)
        hidden=rng.choice(assigned,len(assigned)//5,replace=False)
        masked=labels.copy()
        masked[hidden]=-1
        guessed=_reassign(unit,masked,reassign_quantile,reassign_margin)[hidden]
        returned=guessed>=0
        refined=_reassign(unit,labels,reassign_quantile,reassign_margin)
        info['reassigned']={'quantile':reassign_quantile,'margin':reassign_margin,
            'observations':int((refined!=labels).sum()),
            'held_out_precision':float((guessed[returned]==labels[hidden][returned]).mean()) if returned.any() else None,
            'held_out_recall':float(returned.mean()),'held_out':int(len(hidden)),
            'note':'precision and recall on clustered points hidden as noise; noise itself is harder'}
        labels=refined
    info['noise_share']=float((labels<0).mean())
    return labels,info
