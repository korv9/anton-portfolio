"""python -m ml.cluster_lab.cli --help"""
from __future__ import annotations

import argparse
from collections import Counter
import json
import os
from pathlib import Path
import sys

from .config import load
from .io import atomic_json, read_json


def main():
    parser=argparse.ArgumentParser(description='Local Cluster Lab; immutable runs, resumable finite plans')
    sub=parser.add_subparsers(dest='command',required=True)
    for command in ('validate','plan','run','prepare','layouts'):
        p=sub.add_parser(command)
        p.add_argument('--config',required=True)
        p.add_argument('--set',action='append',default=[],metavar='PATH=VALUE')
        if command=='run':
            p.add_argument('--resume',action='store_true')
        if command=='layouts':
            p.add_argument('--run-id',required=True)
    for command in ('status','stop','compare','export','select','replay'):
        p=sub.add_parser(command)
        p.add_argument('--output',default='warehouse/cluster_lab')
        if command=='compare':
            p.add_argument('--dataset')
        if command=='export':
            p.add_argument('--destination')
        if command in ('select','replay'):
            p.add_argument('--run-id',required=True)
        if command=='select':
            p.add_argument('--remove',action='store_true')
        if command=='replay':
            p.add_argument('--destination',required=True,help='Write exact resolved YAML; run it with --resume or a new registry')
    args=parser.parse_args()
    try:
        if hasattr(args,'config'):
            config=load(args.config,args.set)
            for key in ('OMP_NUM_THREADS','MKL_NUM_THREADS','OPENBLAS_NUM_THREADS','NUMBA_NUM_THREADS'):
                os.environ[key]=str(config['resources']['cpu_threads'])
            if args.command=='validate':
                print(json.dumps({'valid':True,'datasets':[d['name'] for d in config['datasets']],
                    'overrides':args.set},indent=2))
                return 0
            if args.command=='prepare':
                from .prepare import prepare
                from .registry import Registry
                registry=Registry(config['output'])
                with registry.writer():
                    prepare(config)
                registry.close()
                return 0
            from .sweep import Runner, plan
            if args.command=='run':
                return Runner(config).run(args.resume)
            if args.command=='plan':
                runner=Runner(config)
                with runner.registry.writer():
                    loaded=runner.load_datasets()
                    body=plan(config,loaded,runner.source)
                    target=Path(config['output'])/'plans'/body['plan_id']/'plan.json'
                    atomic_json(target,body)
                    print(json.dumps({'plan_id':body['plan_id'],'attempts':body['attempts'],
                        'stages':dict(Counter(s['stage'] for s in body['slots'])),
                        'datasets':{d.spec['name']:{'observations':len(d.metadata),'coverage':d.manifest['coverage']} for d in loaded},
                        'saved':str(target)},indent=2,ensure_ascii=False,default=str))
                runner.registry.close()
                return 0
            if args.command=='layouts':
                from .registry import Registry
                from .layouts import parameters,create
                from .export import export
                registry=Registry(config['output'])
                with registry.writer():
                    run=registry.get(args.run_id)
                    if not run or run['status']!='completed':
                        raise ValueError('Layout parent must be a completed clustering run')
                    for i,params in enumerate(parameters(config)):
                        print(create(run,params,config,registry,i<config['layouts']['preview_count'])['id'])
                    export(registry,Path(config['output'])/'gallery')
                registry.close()
                return 0
        from .registry import Registry
        registry=Registry(args.output)
        if args.command=='status':
            rows=registry.rows()
            info={'output':str(registry.root.resolve()),'states':dict(Counter(r['status'] for r in rows)),
                'runs':dict(Counter(r['status'] for r in rows if r['kind']=='run')),
                'layouts':dict(Counter(r['status'] for r in rows if r['kind']=='layout')),
                'running':[{k:r.get(k) for k in ('id','kind','dataset','stage','slot','updated_at')} for r in rows if r['status']=='running']}
            for name in ('writer','heartbeat','active-plan','stop-reason'):
                path=registry.root/(name+'.json')
                if path.exists():
                    info[name]=read_json(path)
            if 'active-plan' in info:
                active=info['active-plan']
                slots=[r for r in rows if r['kind']=='slot' and r.get('plan_id')==active['plan_id']]
                counts=Counter(r['status'] for r in slots)
                info['progress']={'plan_id':active['plan_id'],'planned':active['attempts'],
                    'completed':counts['completed'],'failed':counts['failed'],
                    'remaining':max(0,active['attempts']-counts['completed']-counts['failed']),
                    'states':dict(counts)}
            pid=info.get('writer',{}).get('pid')
            import psutil
            info['writer_process_alive']=bool(pid and psutil.pid_exists(pid))
            print(json.dumps(info,indent=2,ensure_ascii=False,default=str))
        elif args.command=='stop':
            (registry.root/'STOP').write_text('Stop requested at next checkpoint\n',encoding='utf-8')
            print('Stop requested. After exit, remove STOP before --resume.')
        elif args.command=='compare':
            rows=[r for r in registry.rows('run') if r['status']=='completed' and (not args.dataset or r['dataset']==args.dataset)]
            print(json.dumps([{'run_id':r['id'],'dataset':r['dataset'],'stage':r['stage'],'sample':r['sample'],
                              'metrics':r['metrics']} for r in rows],indent=2,default=str))
        elif args.command=='export':
            from .export import export
            with registry.writer():
                print(export(registry,args.destination or registry.root/'gallery'))
        elif args.command=='select':
            path=registry.root/'selected.json'
            with registry.writer():
                selected=set(read_json(path)) if path.exists() else set()
                if args.remove:
                    selected.discard(args.run_id)
                else:
                    if not registry.get(args.run_id) or registry.get(args.run_id)['status']!='completed':
                        raise ValueError('Select requires a completed run')
                    selected.add(args.run_id)
                atomic_json(path,sorted(selected))
        elif args.command=='replay':
            import yaml
            run=registry.get(args.run_id)
            if not run or run['kind']!='run':
                raise ValueError('Unknown clustering run')
            config={k:v for k,v in run['config'].items() if not k.startswith('_')}
            dataset=read_json(run['dataset_manifest'])['dataset']
            dataset={**dataset,'manifest':run['dataset_manifest'],'prepare':False}
            config['datasets']=[{k:v for k,v in dataset.items() if k not in ('sweep','representation','reduction','clustering')}]
            config['sweep'].update(coarse_candidates=0,finalists=0,refinements_per_finalist=0,search=[],baseline={})
            Path(args.destination).write_text(yaml.safe_dump(config,sort_keys=False,allow_unicode=True),encoding='utf-8')
            print(f'Exact model, sample and evaluation configuration written to {args.destination}; dataset hash {run["identity"]["dataset_id"]}')
        registry.close()
        return 0
    except (ValueError,RuntimeError,FileNotFoundError) as error:
        print(f'Cluster Lab: {error}',file=sys.stderr)
        return 2


if __name__=='__main__':
    raise SystemExit(main())
