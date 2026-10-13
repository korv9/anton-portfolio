"""Welfare profiles: groups of municipalities, and the counties as a gradient.

python -m ml.research.regions --config configs/cluster_lab/public_regions.yaml

Municipalities (Kolada, one year): standardised indicators, principal components, then K-means,
Ward and a Gaussian mixture for each k. The pick is the smallest K-means k that passes the gap
rule and is stable under bootstrap; SKR's municipality groups are an outside comparison, never a
selection criterion. Counties are too few to cluster (21): they are drawn on their first two
principal components with the indicator loadings.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

from ml.cluster_lab.io import atomic_json, file_hash, read_json


def bootstrap_ari(fit,space,reference,rng,rounds):
    """Mean ARI between the full fit and a refit on a resample, over the rows drawn."""
    from sklearn.metrics import adjusted_rand_score
    scores=[]
    for _ in range(rounds):
        drawn=rng.choice(len(space),len(space),replace=True)
        rows,first=np.unique(drawn,return_index=True)
        scores.append(adjusted_rand_score(reference[rows],fit(space[drawn])[first]))
    return float(np.mean(scores))


def gap(space,k,rng,rounds):
    """Tibshirani's gap: log within-cluster dispersion of uniform reference data minus the data's."""
    from sklearn.cluster import KMeans
    log_w=lambda x:float(np.log(KMeans(k,n_init=10,random_state=0).fit(x).inertia_))
    reference=[log_w(rng.uniform(space.min(axis=0),space.max(axis=0),space.shape)) for _ in range(rounds)]
    return float(np.mean(reference)-log_w(space)),float(np.std(reference)*np.sqrt(1+1/rounds))


def components(frame,features,share=None):
    from sklearn.decomposition import PCA
    from sklearn.preprocessing import StandardScaler
    scaled=StandardScaler().fit_transform(frame[features])
    pca=PCA().fit(scaled)
    kept=int(np.searchsorted(np.cumsum(pca.explained_variance_ratio_),share)+1) if share else 2
    return pca.transform(scaled)[:,:kept],pca,scaled


def municipalities(cfg,root):
    from sklearn.cluster import AgglomerativeClustering, KMeans
    from sklearn.metrics import adjusted_mutual_info_score, adjusted_rand_score, silhouette_score
    from sklearn.mixture import GaussianMixture
    features=cfg['features']
    panel=pd.read_parquet(cfg['panel'])
    year=panel[panel.year.eq(cfg['year'])]
    frame=year.dropna(subset=features).sort_values('municipality_code').reset_index(drop=True)
    groups={member['member_id']:group['title'].replace(' (ovägt medel)','')
        for group in read_json(cfg['groups'])['values'] if group['id'] in cfg['skr_groups'] for member in group['members']}
    frame['skr_group']=frame.municipality_code.map(groups)
    if frame.skr_group.isna().any() or frame.municipality_code.duplicated().any():
        raise ValueError('Every municipality needs exactly one profile and one SKR group')
    space,pca,scaled=components(frame,features,cfg['variance_share'])
    rng=np.random.default_rng(cfg['seed'])
    fits=lambda k:{'kmeans':lambda x:KMeans(k,n_init=20,random_state=cfg['seed']).fit_predict(x),
        'ward':lambda x:AgglomerativeClustering(k).fit_predict(x),
        'gaussian_mixture':lambda x:GaussianMixture(k,n_init=5,random_state=cfg['seed']).fit(x).predict(x)}
    comparison=[]
    for k in cfg['k']:
        value,error=gap(space,k,rng,cfg['gap_rounds'])
        for method,fit in fits(k).items():
            labels=fit(space)
            comparison.append({'k':k,'method':method,'silhouette':float(silhouette_score(space,labels)),
                'bootstrap_ari':bootstrap_ari(fit,space,labels,rng,cfg['bootstrap_rounds']),
                'smallest_group':int(np.bincount(labels).min()),'gap':value,'gap_standard_error':error,
                'ami_skr_groups':float(adjusted_mutual_info_score(frame.skr_group,labels))})
    table=pd.DataFrame(comparison)
    kmeans=table[table.method.eq('kmeans')].set_index('k')
    # Tibshirani's rule: the smallest k whose gap is within one standard error of the next k's.
    k=next(k for k in cfg['k'][:-1] if kmeans.bootstrap_ari[k]>=cfg['min_bootstrap_ari']
        and kmeans.gap[k]>=kmeans.gap[k+1]-kmeans.gap_standard_error[k+1])
    labels=fits(k)['kmeans'](space)
    # Number the groups by median income, highest first, so ids mean the same on every rerun.
    order=frame.groupby(labels).median_earned_income_sek.mean().sort_values(ascending=False).index
    labels=np.array([list(order).index(label) for label in labels])
    null=[]
    for _ in range(cfg['permutations']):
        shuffled=np.column_stack([rng.permutation(scaled[:,j]) for j in range(scaled.shape[1])])
        mixed=pca.transform(shuffled)[:,:space.shape[1]]
        null.append(float(silhouette_score(mixed,KMeans(k,n_init=10,random_state=cfg['seed']).fit_predict(mixed))))
    actual=float(silhouette_score(space,labels))
    profiles=[]
    for group in range(k):
        rows=labels==group
        centre=space[rows].mean(axis=0)
        nearest=np.flatnonzero(rows)[np.argsort(np.linalg.norm(space[rows]-centre,axis=1))[:5]]
        profiles.append({'group':group,'municipalities':int(rows.sum()),
            'population':float(frame.population[rows].sum()),
            'means':frame.loc[rows,features].mean().to_dict(),
            'standardised_means':dict(zip(features,scaled[rows].mean(axis=0).tolist())),
            'skr_groups':frame.skr_group[rows].value_counts().to_dict(),
            'counties':frame.county_name[rows].value_counts().head(5).to_dict(),
            'nearest_to_centre':frame.municipality_name.iloc[nearest].tolist()})
    result={'year':cfg['year'],'features':features,'municipalities':len(frame),
        'excluded_for_missing_values':sorted(set(year.municipality_name)-set(frame.municipality_name)),
        'components':int(space.shape[1]),'explained_variance':pca.explained_variance_ratio_.tolist(),
        'loadings':{feature:pca.components_[:2,j].tolist() for j,feature in enumerate(features)},
        'method':f'StandardScaler, PCA {space.shape[1]} components, K-means k={k}, n_init=20',
        'criterion':f'smallest K-means k with gap(k) >= gap(k+1) - se(k+1) and bootstrap ARI >= {cfg["min_bootstrap_ari"]}',
        'k':k,'silhouette':actual,'comparison':comparison,
        'permutation':{'rounds':cfg['permutations'],'median':float(np.median(null)),
            'percentile_95':float(np.quantile(null,.95)),'share_at_least_actual':float((1+sum(v>=actual for v in null))/(1+len(null))),
            'note':'columns shuffled independently; a reference for structure beyond the indicators\' own spread'},
        'ami_skr_groups':float(adjusted_mutual_info_score(frame.skr_group,labels)),
        'ari_skr_groups':float(adjusted_rand_score(frame.skr_group,labels)),
        'profiles':profiles,
        'points':[{'code':row.municipality_code,'name':row.municipality_name,'county':row.county_name,
            'skr_group':row.skr_group,'group':int(labels[i]),'x':float(space[i,0]),'y':float(space[i,1])}
            for i,row in enumerate(frame.itertuples())],
        'sources':{cfg['panel']:file_hash(cfg['panel']),cfg['groups']:file_hash(cfg['groups'])},
        'limits':'profiles of municipalities, not of residents; equal weight per indicator after standardisation; one year'}
    atomic_json(root/'regions-municipalities.json',result)
    print('municipalities',len(frame),'k',k,'silhouette',round(actual,3),
        table[table.method.eq('kmeans')&table.k.eq(k)].round(3).to_dict('records'),flush=True)


def counties(cfg,root):
    features=list(cfg['features'])
    panel=pd.read_json(cfg['panel'],dtype={'region_code':str})
    frame=panel[panel.year.eq(cfg['year'])&~panel.is_country].dropna(subset=features).sort_values('region_code')
    if len(frame)!=21:
        raise ValueError('Expected one complete profile for each of the 21 counties')
    space,pca,_=components(frame,features)
    atomic_json(root/'regions-counties.json',{'year':cfg['year'],'features':features,'counties':len(frame),
        'method':'StandardScaler, PCA; no clustering',
        'explained_variance':pca.explained_variance_ratio_.tolist(),
        'loadings':{feature:pca.components_[:2,j].tolist() for j,feature in enumerate(features)},
        'points':[{'code':row.region_code,'name':row.region_name,'x':float(space[i,0]),'y':float(space[i,1])}
            for i,row in enumerate(frame.itertuples())],
        'sources':{cfg['panel']:file_hash(cfg['panel'])},
        'limits':'21 counties lie along gradients; earlier two- and three-group splits changed when one county or indicator was removed'})
    print('counties',len(frame),'explained',pca.explained_variance_ratio_[:2].round(3).tolist(),flush=True)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--config',default='configs/cluster_lab/public_regions.yaml')
    settings=yaml.safe_load(Path(parser.parse_args().config).read_text(encoding='utf-8'))
    root=Path(settings['output'])
    root.mkdir(parents=True,exist_ok=True)
    municipalities(settings['municipalities'],root)
    counties(settings['counties'],root)


if __name__=='__main__':main()
