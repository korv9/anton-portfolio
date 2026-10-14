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


def kolada(cfg,year):
    """Total-population values of the configured Kolada KPIs for one year; downloaded once, then read from disk."""
    path=Path(cfg['file'])
    if not path.exists():
        import json
        from urllib.request import Request, urlopen
        rows,url=[],f"https://api.kolada.se/v3/data/kpi/{','.join(cfg['kpis'].values())}/year/{year}?per_page=5000"
        while url:
            page=json.load(urlopen(Request(url,headers={'User-Agent':'anton-portfolio research'}),timeout=120))
            rows+=page['values']
            url=page.get('next_url')
        path.parent.mkdir(parents=True,exist_ok=True)
        atomic_json(path,{'source':'https://api.kolada.se/v3','year':year,'kpis':cfg['kpis'],'values':rows})
    names={kpi:name for name,kpi in cfg['kpis'].items()}
    flat=[{'municipality_code':row['municipality'],'feature':names[row['kpi']],'value':value['value']}
        for row in read_json(path)['values'] for value in row['values'] if value['gender']=='T']
    return pd.DataFrame(flat).pivot(index='municipality_code',columns='feature',values='value').reset_index()


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
    if cfg.get('kolada'):
        year=year.merge(kolada(cfg['kolada'],cfg['year']),on='municipality_code',how='left',validate='one_to_one')
    year=year.assign(log_population=np.log(year.population))
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
    def numbered(n):
        # Number the groups by median income, highest first, so ids mean the same on every rerun.
        found=fits(n)['kmeans'](space)
        order=frame.groupby(found).median_earned_income_sek.mean().sort_values(ascending=False).index
        return np.array([list(order).index(label) for label in found])
    labels=numbered(k)
    # A finer split is reported beside the pick when a larger k is at least as stable under bootstrap.
    above=kmeans[(kmeans.index>k)&(kmeans.bootstrap_ari>=cfg['min_bootstrap_ari'])]
    finer=numbered(int(above.bootstrap_ari.idxmax())) if len(above) else None
    # The same shuffled data for every k, so a finer stable split can be read against its own reference.
    mixes=[pca.transform(np.column_stack([rng.permutation(scaled[:,j]) for j in range(scaled.shape[1])]))[:,:space.shape[1]]
        for _ in range(cfg['permutations'])]
    nulls={n:[float(silhouette_score(mixed,KMeans(n,n_init=10,random_state=cfg['seed']).fit_predict(mixed))) for mixed in mixes] for n in cfg['k']}
    null=nulls[k]
    actual=float(silhouette_score(space,labels))
    def profiled(found):
        out=[]
        for group in range(found.max()+1):
            rows=found==group
            centre=space[rows].mean(axis=0)
            nearest=np.flatnonzero(rows)[np.argsort(np.linalg.norm(space[rows]-centre,axis=1))[:5]]
            out.append({'group':group,'municipalities':int(rows.sum()),
                'population':float(frame.population[rows].sum()),
                'means':frame.loc[rows,features].mean().to_dict(),
                'standardised_means':dict(zip(features,scaled[rows].mean(axis=0).tolist())),
                'skr_groups':frame.skr_group[rows].value_counts().to_dict(),
                'counties':frame.county_name[rows].value_counts().head(5).to_dict(),
                'nearest_to_centre':frame.municipality_name.iloc[nearest].tolist()})
        return out
    profiles=profiled(labels)
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
        'kmeans_null_95':{n:float(np.quantile(values,.95)) for n,values in nulls.items()},
        'ami_skr_groups':float(adjusted_mutual_info_score(frame.skr_group,labels)),
        'ari_skr_groups':float(adjusted_rand_score(frame.skr_group,labels)),
        'profiles':profiles,
        'finer':None if finer is None else {'k':int(finer.max()+1),'silhouette':float(silhouette_score(space,finer)),
            'ami_skr_groups':float(adjusted_mutual_info_score(frame.skr_group,finer)),'profiles':profiled(finer),
            'criterion':'the K-means k above the pick with the highest bootstrap ARI, when it reaches the same bar'},
        'points':[{'code':row.municipality_code,'name':row.municipality_name,'county':row.county_name,
            'skr_group':row.skr_group,'group':int(labels[i]),'finer_group':None if finer is None else int(finer[i]),'x':float(space[i,0]),'y':float(space[i,1])}
            for i,row in enumerate(frame.itertuples())],
        'sources':{path:file_hash(path) for path in [cfg['panel'],cfg['groups']]+([cfg['kolada']['file']] if cfg.get('kolada') else [])},
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
