"""Drive the existing acquisition components; no presentation exports or dbt promotion."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import time

from .io import ROOT, atomic_json, now, read_json


def jobs(spec,config,checkpoint=lambda:None):
    sys.path.insert(0,str(ROOT/'platform/ingest/jobtech'))
    from ingest_history import download
    from full_corpus import import_archive_all
    from ingest_market import published_archives
    settings=spec.get('ingestion',{})
    output=Path(spec.get('path','warehouse/raw/jobtech/cluster-corpus'))
    archives=Path(spec.get('archives','warehouse/jobtech/archives'))
    names=settings.get('archives') or [name for name in published_archives() if 2023<=int(name[:4])<=2026]
    results=[]
    for name in names:
        checkpoint()
        try:
            existing=output/name/'state.json'
            if existing.exists() and read_json(existing).get('status')=='completed':
                result=read_json(existing)
                results.append(result)
                print(f'{name}: reusing completed full-text import',flush=True)
                if not settings.get('retain_downloads',True):
                    owned=(archives/f'{name}.jsonl.zip').resolve()
                    if owned.parent!=archives.resolve():
                        raise ValueError('Archive retention target escapes its configured directory')
                    if owned.exists():
                        owned.unlink()
                continue
            for attempt in range(settings.get('retries',4)):
                try:
                    path,url=download(name,archives,checkpoint)
                    break
                except (OSError,ConnectionError) as error:
                    if attempt+1==settings.get('retries',4):
                        raise
                    time.sleep(2**attempt)
                    checkpoint()
            result=import_archive_all(path,name,output,url,settings.get('checkpoint_rows',20000),checkpoint)
            results.append(result)
            if not settings.get('retain_downloads',True):
                owned=path.resolve()
                if owned.parent!=archives.resolve():
                    raise ValueError('Archive retention target escapes its configured directory')
                owned.unlink()
        except KeyboardInterrupt:
            raise
        except Exception as error:
            from .datasets import DataProblem
            if isinstance(error,DataProblem):
                raise
            results.append({'archive':name,'status':'failed','error':str(error)})
            print(f'Archive {name} unavailable: {error}; retaining usable available archives',flush=True)
        atomic_json(output/'acquisition.json',{'at':now(),'archives':results})
        time.sleep(settings.get('pause_seconds',1))
    if settings.get('active_snapshot',False):
        # The official bulk snapshot contains active adverts only. It supplements the
        # archives and does not certify the intervening history of removed adverts.
        from full_corpus import record, SCHEMA
        import pyarrow as pa
        import pyarrow.parquet as pq
        import json
        import hashlib
        import gzip
        sys.path.insert(0,str(ROOT/'platform/lib'))
        import rawstore
        folder=output/'active-snapshot'
        folder.mkdir(parents=True,exist_ok=True)
        state_path=folder/'state.json'
        if state_path.exists() and read_json(state_path).get('status')=='completed':
            return results
        url='https://jobstream.api.jobtechdev.se/v2/snapshot'
        fetched=now()
        shards=[]
        block=[]
        lines=0
        sha=hashlib.sha256()
        with rawstore.session() as http:
            with http.get(url,headers={'Accept':'application/jsonl'},stream=True,timeout=(30,180)) as response:
                response.raise_for_status()
                with gzip.open(folder/'snapshot.jsonl.gz.tmp','wb') as raw:
                    for line in response.iter_lines():
                        if not line.strip():
                            continue
                        ad=json.loads(line)
                        if not isinstance(ad,dict):
                            raise ValueError('Snapshot endpoint did not honor application/jsonl; no partial snapshot published')
                        raw.write(line+b'\n')
                        sha.update(line+b'\n')
                        lines+=1
                        block.append(record(ad,url,fetched))
                        if len(block)>=settings.get('checkpoint_rows',20000):
                            checkpoint()
                            shard=f'part-{lines:010d}.parquet'
                            pq.write_table(pa.Table.from_pylist(block,schema=SCHEMA),folder/(shard+'.tmp'),compression='zstd')
                            (folder/(shard+'.tmp')).replace(folder/shard)
                            shards.append(shard)
                            block.clear()
                    if block:
                        shard=f'part-{lines:010d}.parquet'
                        pq.write_table(pa.Table.from_pylist(block,schema=SCHEMA),folder/(shard+'.tmp'),compression='zstd')
                        (folder/(shard+'.tmp')).replace(folder/shard)
                        shards.append(shard)
        (folder/'snapshot.jsonl.gz.tmp').replace(folder/'snapshot.jsonl.gz')
        atomic_json(state_path,{'source':url,'source_sha256':sha.hexdigest(),'fetched_at':fetched,
            'status':'completed','lines':lines,'shards':shards,'scope':'all active ads; not historical coverage of removed ads'})
    return results


def symbolic(spec,config,checkpoint=lambda:None):
    import os
    import subprocess
    raw=Path(spec.get('raw','warehouse/raw/symbolic'))
    corpus=read_json(Path(spec.get('corpus','platform/ingest/symbolic/corpus.json')))['documents']
    if all((raw/'gutenberg'/f'{d["id"]}.txt').exists() for d in corpus):
        return
    env={**os.environ,'PORTFOLIO_RAW':str(raw.resolve().parent),'PYTHONUTF8':'1'}
    completed=subprocess.run([sys.executable,'-u','platform/ingest/symbolic/ingest_corpus.py'],cwd=ROOT,env=env)
    if completed.returncode and not spec.get('allow_partial',True):
        raise RuntimeError('Symbolic ingestion failed; see source log')


def prepare(config,checkpoint=lambda:None):
    done=set()
    for spec in config['datasets']:
        if not spec.get('prepare',False):
            continue
        key=(spec['adapter'],spec.get('path',spec.get('raw')))
        if key in done:
            continue
        done.add(key)
        print(f'Preparing {spec["name"]}',flush=True)
        (jobs if spec['adapter']=='jobs' else symbolic)(spec,config,checkpoint)
