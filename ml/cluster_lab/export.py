"""Local gallery exports; no copying over published atlases or deployments."""
from __future__ import annotations

from pathlib import Path
import shutil

from .io import atomic_json, read_json


def export(registry,target):
    target=Path(target)
    target.mkdir(parents=True,exist_ok=True)
    runs=[run for run in registry.rows('run') if run['status']=='completed']
    layouts=registry.rows('layout')
    entries=[]
    selected_path=registry.root/'selected.json'
    selected=read_json(selected_path) if selected_path.exists() else []
    for run in runs:
        folder=target/run['id']
        folder.mkdir(parents=True,exist_ok=True)
        for filename in ['config.json','metrics.json','profiles.json','run.json']:
            shutil.copy2(Path(run['folder'])/filename,folder/filename)
        coverage={key:value for key,value in run['coverage'].items() if key in
            ('years','works','occurrences','passages','languages','last_publication','absent_years','2026_incomplete_calendar_year','scope')}
        metrics={key:value for key,value in run['metrics'].items() if key in
            ('observations','cluster_count','noise_share','coverage','largest_cluster_share','silhouette_original',
             'silhouette_analyzed','mean_probability','evaluation_sample','implementation','implementation_version','min_samples_definition')}
        entry={'run_id':run['id'],'dataset':run['dataset'],'family':run['family'],
            'stage':run['stage'],'coverage':coverage,'sample':run['sample'],
            'observations':run['metrics']['observations'],'clusters':run['metrics']['cluster_count'],
            'noise_share':run['metrics']['noise_share'],'metrics':metrics,
            'parameters':{k:run['config'][k] for k in ('representation','reduction','clustering','seed')},
            'selected':run['id'] in selected,'details':f'{run["id"]}/run.json','layouts':[]}
        comparisons=[c for c in registry.rows('comparison') if run['id'] in (c['reference'],c['candidate'])]
        atomic_json(folder/'stability.json',comparisons)
        entry['stability_details']=f'{run["id"]}/stability.json'
        for layout in layouts:
            if layout['status']!='completed' or layout['parent_run_id']!=run['id']:
                continue
            dest=folder/layout['id']
            dest.mkdir(parents=True,exist_ok=True)
            for filename in ['view.json','layout.json','preview.png']:
                path=Path(layout['folder'])/filename
                if path.exists():
                    shutil.copy2(path,dest/filename)
            entry['layouts'].append({'layout_id':layout['id'],'parameters':layout['parameters'],
                'quality':layout['quality'],'drawn':layout['display_count'],'total':layout['observation_count'],
                'view':f'{run["id"]}/{layout["id"]}/view.json',
                'preview':f'{run["id"]}/{layout["id"]}/preview.png' if layout['preview'] else None})
        entries.append(entry)
    atomic_json(target/'index.json',{'schema_version':1,'runs':entries,
        'note':'Local experiments. Actual dataset coverage and sample scopes are attached to each run.'})
    return target/'index.json'
