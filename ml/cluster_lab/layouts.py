"""Projection-only sweep: saved labels are inputs and are never refitted."""
from __future__ import annotations

import itertools
from pathlib import Path

import numpy as np
import pandas as pd

from .config import values
from .io import atomic_json, atomic_parquet, digest, file_hash, now, read_json, versions


def parameters(config):
    layout=config['layouts']
    combinations=list(itertools.product(values(layout['n_neighbors']),values(layout['min_dist']),
        values(layout['seeds']),values(layout['spread']),values(layout['repulsion_strength'])))
    # Deterministic space-filling subset rather than taking only one neighbor setting.
    count=min(layout['count'],len(combinations))
    indices=np.linspace(0,len(combinations)-1,count,dtype=int) if count else []
    return [{'n_neighbors':combinations[i][0],'min_dist':combinations[i][1],
        'random_state':combinations[i][2],'spread':combinations[i][3],
        'repulsion_strength':combinations[i][4],'n_components':2,'metric':layout['metric'],
        'n_jobs':1,'init':'random','n_epochs':layout['n_epochs'],'low_memory':True} for i in indices]


def create(run,params,config,registry,preview=True):
    from sklearn.manifold import trustworthiness
    from umap import UMAP

    folder=Path(run['folder'])
    labels_path=folder/'assignments.parquet'
    labels_hash=file_hash(labels_path)
    assignments=pd.read_parquet(labels_path)
    original=run['representation']
    source=original if config['layouts']['feature_source']=='representation' else {
        **run['reduction'],'representation_id':run['reduction'].get('reduction_id',original['representation_id']),
        'ids_sha256':original['ids_sha256']}
    vectors=np.load(source['path'],mmap_mode='r')
    ids=assignments.observation_id.tolist()
    if digest(ids)!=source['ids_sha256']:
        raise ValueError('Layout IDs do not match representation ordering')
    if params['n_neighbors']>=len(ids):
        raise ValueError('Layout n_neighbors must be smaller than observations')
    layout_id=digest({'run':run['id'],'assignment_hash':labels_hash,'params':params,
        'projection_source_id':source['representation_id'],
        'evaluation':{k:config['layouts'][k] for k in ('trust_sample_size','trust_neighbors','display_seed')},
        'display':{k:config['layouts'][k] for k in ('preview_points','point_size','alpha','neighbor_lines','density_contours')},
        'versions':versions(),'engine':file_hash(Path(__file__))})[:24]
    previous=registry.get(layout_id)
    if previous and previous['status']=='completed':
        return previous
    target=folder/'layouts'/layout_id
    target.mkdir(parents=True,exist_ok=True)
    body={'parent_run_id':run['id'],'folder':str(target.resolve()),'parameters':params,
          'resolved_config':config,'display_settings':config['layouts'],
          'assignment_sha256':labels_hash,'representation_id':source['representation_id'],'started_at':now()}
    registry.put(layout_id,'layout','running',body)
    try:
        geometry_id=digest({'representation':source['representation_id'],'params':params,'versions':versions(),
                            'implementation':file_hash(Path(__file__))})[:24]
        geometry_folder=Path(config['cache'])/'layout_geometry'/geometry_id
        geometry_folder.mkdir(parents=True,exist_ok=True)
        geometry_path=geometry_folder/'coordinates.parquet'
        if (geometry_folder/'complete.json').exists():
            if file_hash(geometry_path)!=read_json(geometry_folder/'complete.json')['sha256']:
                raise ValueError('Shared layout geometry checksum changed')
            layout=pd.read_parquet(geometry_path)
            if layout.observation_id.tolist()!=ids:
                raise ValueError('Shared layout geometry IDs differ')
            coords=layout[['x','y']].to_numpy()
        else:
            coords=UMAP(**params).fit_transform(vectors)
            layout=pd.DataFrame({'observation_id':ids,'x':coords[:,0],'y':coords[:,1]})
            atomic_parquet(layout,geometry_path)
            atomic_json(geometry_folder/'complete.json',{'sha256':file_hash(geometry_path),'params':params,'representation':source['representation_id']})
        import os
        coordinate_target=target/'coordinates.parquet'
        if not coordinate_target.exists():
            try:
                os.link(geometry_path,coordinate_target)
            except OSError:
                import shutil
                shutil.copy2(geometry_path,coordinate_target)
        body['shared_geometry_id']=geometry_id
        lc=config['layouts']
        rng=np.random.default_rng(lc['display_seed'])
        eval_indices=np.sort(rng.choice(len(ids),min(lc['trust_sample_size'],len(ids)),replace=False))
        k=lc['trust_neighbors']
        if k>=len(eval_indices)/2:
            quality={'value':None,'reason':'trust_neighbors must be less than half the evaluation sample'}
        else:
            original_vectors=np.load(original['path'],mmap_mode='r')
            original_metric=config['evaluation']['silhouette_metric']
            quality={'value':float(trustworthiness(np.asarray(original_vectors[eval_indices]),coords[eval_indices],
                n_neighbors=k,metric=original_metric)),'metric':original_metric,'n_neighbors':k,
                'projection_source':config['layouts']['feature_source'],
                'evaluation_population':'deterministic subset, neighborhoods ranked within that subset',
                'sample_size':len(eval_indices),'seed':lc['display_seed']}
        atomic_parquet(assignments.iloc[eval_indices][['observation_id']],target/'evaluation-ids.parquet')
        display=np.sort(rng.choice(len(ids),min(lc['preview_points'],len(ids)),replace=False))
        view=layout.iloc[display].merge(assignments,on='observation_id',validate='one_to_one')
        # Fetch metadata only for drawn points; corpus-wide assignments stay lightweight.
        manifest=read_json(run['dataset_manifest'])
        import duckdb
        with duckdb.connect() as con:
            con.register('display_ids',view[['observation_id']])
            schema=con.execute('describe select * from read_parquet(?)',[manifest['path']]).fetchall()
            skip={'description','context','sentence','previous_sentence','next_sentence','matched_term','text_hash','duplicate_of'}
            columns=','.join('o.'+row[0] for row in schema if row[0] not in skip)
            metadata=con.execute(f'select {columns} from read_parquet(?) o join display_ids using(observation_id)',[manifest['path']]).df()
        for column in ('cluster','probability','outlier_score','x','y'):
            if column in metadata:
                metadata=metadata.drop(columns=column)
        metadata=metadata.drop(columns=[c for c in metadata if c!='observation_id' and c in view])
        view=view.merge(metadata,on='observation_id',validate='one_to_one')
        atomic_parquet(view[['observation_id']],target/'display-ids.parquet')
        edges=[]
        if lc['neighbor_lines'] and len(display)>2:
            from sklearn.neighbors import NearestNeighbors
            nn=NearestNeighbors(n_neighbors=min(3,len(display)),metric=params['metric'],n_jobs=1).fit(vectors[display])
            neighbors=nn.kneighbors(return_distance=False)
            edges=[[int(i),int(neighbors[i,0])] for i in range(min(lc['neighbor_lines'],len(display)))]
        payload={'points':view.astype(object).where(pd.notna(view),None).to_dict(orient='records'),'edges':edges,
            'edge_representation':f'{config["layouts"]["feature_source"]}, source {source["representation_id"]}; nearest neighbor within saved display sample',
            'drawn':len(view),'total':len(ids),'sample_method':'uniform without replacement, sorted source indices',
            'sample_seed':lc['display_seed'],'display':{key:lc[key] for key in ('point_size','alpha','density_contours')}}
        atomic_json(target/'view.json',payload)
        if preview:
            import matplotlib
            matplotlib.use('Agg')
            import matplotlib.pyplot as plt
            fig,ax=plt.subplots(figsize=(10,6),facecolor='#f5f3ef')
            ax.set_facecolor('#f5f3ef')
            ax.scatter(view.x,view.y,c=view.cluster,cmap='tab20',s=lc['point_size'],alpha=lc['alpha'],linewidths=0)
            if lc['density_contours'] and len(view)>=100:
                from scipy.ndimage import gaussian_filter
                grid,x,y=np.histogram2d(view.x,view.y,bins=100)
                ax.contour((x[:-1]+x[1:])/2,(y[:-1]+y[1:])/2,gaussian_filter(grid.T,2),levels=4,alpha=.25,linewidths=.5)
            ax.set_aspect('equal',adjustable='datalim')
            ax.axis('off')
            fig.tight_layout()
            fig.savefig(target/'preview.tmp.png',dpi=120)
            plt.close(fig)
            (target/'preview.tmp.png').replace(target/'preview.png')
        if file_hash(labels_path)!=labels_hash:
            raise ValueError('Assignments changed during layout generation')
        body.update(quality=quality,coordinates_sha256=file_hash(target/'coordinates.parquet'),
            completed_at=now(),display_count=len(view),observation_count=len(ids),preview=preview)
        atomic_json(target/'layout.json',body)
        return registry.put(layout_id,'layout','completed',body)
    except BaseException as error:
        registry.put(layout_id,'layout','interrupted' if isinstance(error,KeyboardInterrupt) else 'failed',
                     {**body,'error':str(error)})
        raise
