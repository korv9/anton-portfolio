"""Adapters for existing archive and Symbolic Atlas models, with immutable snapshots."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
import hashlib
import importlib.util
from pathlib import Path
import sys
import os
import uuid

import duckdb
import numpy as np
import pandas as pd
import pyarrow.parquet as pq

from .io import ROOT, atomic_json, atomic_parquet, digest, file_hash, read_json


class DataProblem(RuntimeError):
    pass


def connection(resources):
    con = duckdb.connect()
    con.execute(f"set memory_limit='{resources['duckdb_memory_gb']}GB'")
    con.execute(f"set threads={resources['cpu_threads']}")
    con.execute('set enable_progress_bar=false')
    con.execute('set preserve_insertion_order=false')
    spill=Path(resources['spill_directory'])/f'{os.getpid()}-{uuid.uuid4().hex[:8]}'
    spill.mkdir(parents=True,exist_ok=True)
    con.execute('set temp_directory='+sql_string(spill.resolve()))
    con.execute(f"set max_temp_directory_size='{resources['max_spill_gb']}GB'")
    return con


def sql_string(value):
    return "'" + str(value).replace("'", "''") + "'"


@dataclass
class Dataset:
    spec: dict
    path: Path
    manifest: dict
    metadata: pd.DataFrame

    def sample(self, size, seed):
        frame = self.metadata
        if size is None or size >= len(frame):
            return frame.copy(), {'kind': 'full', 'total': len(frame), 'selected': len(frame)}
        # Every observed year/field (or work) gets a point; remainder is uniform hash sampling.
        groups = ['year','occupation_field_id'] if self.spec['adapter']=='jobs' else ['document_id']
        if self.spec.get('family')=='numeric':
            groups=[]
        ranked = frame.assign(_hash=frame.observation_id.map(
            lambda x: hashlib.sha256(f'{seed}:{x}'.encode()).hexdigest())).sort_values('_hash')
        mandatory = ranked.groupby(groups, dropna=False, sort=False).head(1) if groups else ranked.iloc[:0]
        if len(mandatory) > size:
            raise DataProblem(f'Sample {size} cannot cover {len(mandatory)} observed strata')
        rest = ranked.loc[~ranked.observation_id.isin(mandatory.observation_id)].head(size-len(mandatory))
        result = pd.concat([mandatory,rest]).sort_values('observation_id').drop(columns='_hash').reset_index(drop=True)
        return result, {'kind': 'sample', 'method': 'one hash-selected row per observed stratum; uniform hash remainder',
            'strata': groups, 'seed': seed, 'selected': len(result), 'total': len(frame),
            'ids_sha256': digest(result.observation_id.tolist())}

    def texts(self, frame, resources):
        """Stream the snapshot once, retaining only selected IDs and preserving ID order."""
        full=len(frame)==len(self.metadata)
        selected = None if full else set(frame.observation_id)
        pending=[]
        count=0
        checkpoint_rows=resources['embedding_checkpoint_rows']
        for batch in pq.ParquetFile(self.path).iter_batches(batch_size=resources['embedding_checkpoint_rows']):
            part = batch.to_pandas()
            if not full:
                # pandas.isin rebuilds a large hash set per batch; Python's existing set
                # keeps corpus-wide streaming linear in the number of observations.
                part = part.loc[np.fromiter((oid in selected for oid in part.observation_id),dtype=bool)]
            if len(part):
                pending.append(part)
                count+=len(part)
                if count>=checkpoint_rows:
                    yield pd.concat(pending,ignore_index=True)
                    pending=[]
                    count=0
        if pending:
            yield pd.concat(pending,ignore_index=True)


def symbolic_snapshot(spec, directory):
    raw = Path(spec.get('raw','warehouse/raw/symbolic'))
    database = Path(spec.get('database','warehouse/portfolio.duckdb'))
    corpus_path = Path(spec.get('corpus','platform/ingest/symbolic/corpus.json'))
    # Hash input bytes before consulting the prepared cache, never just row counts or paths.
    signature=digest({'raw':[(str(p),file_hash(p)) for p in sorted((raw/'gutenberg').glob('*.txt'))],
        'corpus':file_hash(corpus_path),'database':file_hash(database) if database.is_file() else None,
        'implementation':[file_hash(Path(__file__)),file_hash(ROOT/'platform/nlp/symbolic/cleaning.py'),
            file_hash(ROOT/'platform/nlp/symbolic/context.py'),file_hash(ROOT/'platform/seeds/symbolic/symbol_aliases.csv')]})
    cached=directory/'sources'/'prepared-symbolic.json'
    if cached.exists():
        record=read_json(cached)
        if record['signature']==signature and Path(record['folder']).is_dir():
            folder=Path(record['folder'])
            if all(file_hash(folder/name)==sha for name,sha in record['files'].items()):
                return folder
    if database.is_file():
        with duckdb.connect(str(database),read_only=True) as con:
            frame = con.execute('''select o.*, d.title, d.author, d.language
                from silver.int_symbol_occurrences o join silver.int_symbolic_documents d using(document_id)
                order by occurrence_id''').df()
            documents = con.execute('select * from silver.int_symbolic_documents order by document_id').df()
        frame['source_reference'] = frame.document_id
        sources = {'database': str(database.resolve()), 'sha256': file_hash(database)}
    else:
        corpus_path = Path(spec.get('corpus','platform/ingest/symbolic/corpus.json'))
        corpus = read_json(corpus_path)['documents']
        available, missing, hashes = [], [], {}
        for doc in corpus:
            path = raw / 'gutenberg' / f"{doc['id']}.txt"
            if not path.is_file():
                missing.append(doc['id'])
                continue
            hashes[doc['id']] = file_hash(path)
            available.append({**doc, 'document_id': doc['id'], 'raw_text': path.read_text(encoding='utf-8'),
                              'source_hash': hashes[doc['id']]})
        if not available or (missing and not spec.get('allow_partial',True)):
            raise DataProblem(f'Symbolic raw corpus unavailable: {len(missing)} missing works; run ingest_corpus.py')
        # Run the same dbt Python models on the local raw texts, rather than reimplement cleaning/extraction.
        sys.path.insert(0,str(ROOT/'platform/nlp/symbolic'))
        aliases_path = ROOT/'platform/seeds/symbolic/symbol_aliases.csv'
        aliases = pd.read_csv(aliases_path)
        def model(name, tables):
            filename = ROOT/f'platform/models/silver/symbolic/{name}.py'
            loaded = importlib.util.spec_from_file_location('cluster_lab_'+name,filename)
            module = importlib.util.module_from_spec(loaded)
            loaded.loader.exec_module(module)
            class DBT:
                def config(self,**kwargs):
                    pass
                def ref(self,key):
                    class Table:
                        def df(self):
                            return tables[key]
                    return Table()
            return module.model(DBT(),None)
        documents = model('int_symbolic_documents',{'stg_symbolic_documents':pd.DataFrame(available)})
        frame = model('int_symbol_occurrences',{'int_symbolic_documents':documents,'symbol_aliases':aliases})
        frame = frame.merge(documents[['document_id','title','author','language']],on='document_id',validate='many_to_one')
        references = {d['id']:f"https://www.gutenberg.org/ebooks/{d['gutenberg_id']}" for d in corpus}
        frame['source_reference'] = frame.document_id.map(references)
        sources = {'corpus_sha256':file_hash(corpus_path),'text_hashes':hashes,
                   'aliases_sha256':file_hash(aliases_path),'missing_works':missing}
    if not len(frame):
        raise DataProblem('Symbolic corpus has no occurrences')
    from context import sentence_spans
    passages = []
    # Unique, untruncated source sentences, including passages without symbol matches.
    for doc in documents.itertuples():
        for start,end in sentence_spans(doc.clean_text):
            text = doc.clean_text[start:end]
            if len(text.split()) < 3:
                continue
            passages.append({'observation_id':hashlib.sha256(f'{doc.document_id}:{doc.source_hash}:{start}:{end}'.encode()).hexdigest()[:24],
                'document_id':doc.document_id,'title':doc.title,'author':doc.author,
                'language':doc.language,'tradition':doc.tradition,'context':text,
                'symbol_id':None,'source_reference':f'{doc.document_id}#{start}:{end}',
                'char_start':start,'char_end':end,'text_hash':digest(text)})
    frame['observation_id'] = frame.occurrence_id.astype(str)
    frame['text_hash'] = frame.context.map(digest)
    repeated = int(frame.duplicated(['document_id','context']).sum())
    coverage = {'works':len(documents),'occurrences':len(frame),'passages':len(passages),
        'languages':documents.language.value_counts(dropna=False).to_dict(),
        'symbols':int(frame.symbol_id.nunique()),'reprint_occurrences':int(frame.duplicate_of.notna().sum()),
        'repeated_context_observations':repeated,'sources':sources,
        'note':'Occurrences repeat contexts when several symbols or matches share a passage. Passage experiments use unique source-sentence spans; no per-work/symbol cap.'}
    identity = digest({'sources':sources,'cleaning':file_hash(ROOT/'platform/nlp/symbolic/cleaning.py'),
        'context':file_hash(ROOT/'platform/nlp/symbolic/context.py'),
        'models':[file_hash(ROOT/f'platform/models/silver/symbolic/{n}.py') for n in ['int_symbolic_documents','int_symbol_occurrences']]})[:24]
    folder = directory/'sources'/('symbolic-'+identity)
    folder.mkdir(parents=True,exist_ok=True)
    atomic_parquet(frame.sort_values('observation_id'),folder/'occurrences.parquet')
    atomic_parquet(pd.DataFrame(passages).sort_values('observation_id'),folder/'passages.parquet')
    atomic_json(folder/'coverage.json',coverage)
    atomic_json(cached,{'signature':signature,'folder':str(folder.resolve()),
        'files':{name:file_hash(folder/name) for name in ('occurrences.parquet','passages.parquet','coverage.json')}})
    return folder


def load(spec, config, symbolic_source=None):
    if spec.get('manifest'):
        manifest=read_json(spec['manifest'])
        path=Path(manifest['path'])
        if not path.is_file() or file_hash(path)!=manifest['data_sha256']:
            raise DataProblem('Pinned replay dataset is absent or its content hash changed')
        schema=pq.ParquetFile(path).schema_arrow.names
        excluded={'description','context','sentence','previous_sentence','next_sentence','matched_term','duplicate_of','occurrence_id'}
        metadata=pq.read_table(path,columns=[c for c in schema if c not in excluded]).to_pandas().sort_values('observation_id').reset_index(drop=True)
        for column in metadata:
            if column!='year':
                metadata[column]=metadata[column].astype('string[pyarrow]').fillna('')
        if digest(metadata.observation_id.tolist())!=manifest['ordered_ids_sha256']:
            raise DataProblem('Pinned replay dataset ID ordering changed')
        return Dataset({**manifest['dataset'],**spec},path,manifest,metadata)
    output = Path(config['output'])/'datasets'
    output.mkdir(parents=True,exist_ok=True)
    resources = config['resources']
    con = connection(resources)
    try:
        if spec['adapter']=='jobs':
            corpus = Path(spec.get('path','warehouse/raw/jobtech/cluster-corpus'))
            states = []
            paths = []
            for state_path in sorted(corpus.glob('*/state.json')):
                if spec.get('source_archives') and state_path.parent.name not in spec['source_archives']:
                    continue
                state = read_json(state_path)
                if state['status']!='completed' and not spec.get('allow_partial',False):
                    raise DataProblem(f'Job archive not complete: {state_path}; finish or resume ingestion')
                if state['status']=='completed' or spec.get('allow_partial',False):
                    states.append(state)
                    paths.extend(state_path.parent/p for p in state['shards'])
            if not paths:
                raise DataProblem('No full-text all-occupation job shards available. Existing tech warehouse is not the intended corpus.')
            files='['+','.join(sql_string(path) for path in paths)+']'
            con.execute(f'create view input as select * from read_parquet({files}, filename=true, file_row_number=true)')
            start,end = spec.get('start','2023-01-01'),spec.get('end','2027-01-01')
            as_of = spec.get('as_of') or date.today().isoformat()
            # Deduplicate only lightweight source pointers. Sorting full descriptions here
            # would spill many gigabytes; text stays in the existing compressed shards.
            con.execute('''create table source_keys as select observation_id, filename, file_row_number
                from input where try_cast(published_at as timestamp)>=cast(? as date)
                and try_cast(published_at as timestamp)<cast(? as date)
                and try_cast(published_at as timestamp)<cast(? as date)+interval 1 day
                qualify row_number() over (partition by observation_id order by ingested_at desc, source desc)=1''',[start,end,as_of])
            print(f'Dataset {spec["name"]}: stable-ID deduplication complete',flush=True)
            # Compute text fingerprints before joining the chosen IDs. A wide probe
            # containing descriptions can otherwise spill the entire text corpus.
            con.execute('''create table source_metadata as select * exclude(description),
                description is null or length(trim(coalesce(description,'')))=0 as description_missing,
                sha256(coalesce(description,'')||chr(10)||coalesce(title,'')) as text_hash,
                sha256(lower(regexp_replace(coalesce(description,''),'\\s+',' ','g'))) as normalized_text_hash
                from input''')
            con.execute('''create view selected_metadata as select i.* exclude(filename,file_row_number),
                year(try_cast(published_at as timestamp)) as year from source_metadata i
                join source_keys k on i.filename=k.filename and i.file_row_number=k.file_row_number''')
            con.execute('''create view selected as select i.* exclude(filename,file_row_number),
                year(try_cast(published_at as timestamp)) as year from input i
                join source_keys k on i.filename=k.filename and i.file_row_number=k.file_row_number''')
            missing_cols=['published_at','title','description','occupation_group','occupation_field','employer','municipality','region','employment_type','source','ingested_at']
            missing_sql=','.join('count(*) filter(where description_missing)' if col=='description' else f"count(*) filter(where {col} is null or trim(cast({col} as varchar))='')" for col in missing_cols)
            missing=dict(zip(missing_cols,con.execute('select '+missing_sql+' from selected_metadata').fetchone()))
            print(f'Dataset {spec["name"]}: missing-field audit complete',flush=True)
            years = dict(con.execute('select year,count(*) from selected_metadata group by 1 order by 1').fetchall())
            months = dict(con.execute("select strftime(try_cast(published_at as timestamp),'%Y-%m'),count(*) from selected_metadata group by 1 order by 1").fetchall())
            fields = dict(con.execute("select coalesce(occupation_field,'(missing)'),count(*) from selected_metadata group by 1 order by 1").fetchall())
            coverage = {'years':years,'months':months,'occupation_fields':fields,'missing_fields':missing,
                'last_publication':str(con.execute('select max(try_cast(published_at as timestamp)) from selected_metadata').fetchone()[0]),
                'start_inclusive':start,'end_exclusive':end,'as_of':as_of,'2026_incomplete_calendar_year':True,
                'absent_years':[y for y in range(2023,2027) if y not in years],
                'archive_states':states,'invalid_date_source_rows':con.execute('select count(*) from input where try_cast(published_at as timestamp) is null').fetchone()[0],
                'duplicate_id_versions':con.execute('select count(*)-count(distinct observation_id) from input').fetchone()[0],
                'scope':'all available occupation fields; publication date selection; no skill/title/tech filters',
                'source_scope':'Platsbanken advertisements, not every vacancy in Sweden',
                '2026_gaps':'Quarterly archives do not cover dates after their last publication. Active ads alone cannot recover removed ads in that gap.'}
            con.execute("create view observations as select *, sha256(coalesce(description,'')||chr(10)||coalesce(title,'')) as text_hash from selected where length(trim(coalesce(description,'')))>0")
            coverage['excluded_empty_description']=missing['description']
            duplicates=con.execute("""select normalized_text_hash text_group,
                count(*) ads, count(distinct employer) employers from selected_metadata
                where not description_missing group by 1 having count(*)>1 order by ads desc limit 50""").fetchall()
            coverage['identical_normalized_text_groups']=[{'hash':h,'ads':ads,'employers':employers} for h,ads,employers in duplicates]
            print(f'Dataset {spec["name"]}: date/coverage/text-duplicate audit complete',flush=True)
            coverage['text_deduplication_policy']='Stable ID versions deduplicated; text groups reported only. Different real advertisements retained.'
            meta_cols=['observation_id','title','employer','year','occupation_field','occupation_field_id','occupation_group','occupation_code','region','municipality','published_at','employment_type','source','ingested_at','text_hash']
            sources={'archives':[(s['source_sha256'],s['lines'],s['status']) for s in states],
                     'shard_hashes':{str(path.resolve()):file_hash(path) for path in paths}}
        else:
            folder = symbolic_source or symbolic_snapshot(spec,output)
            family = spec.get('family','occurrences')
            path = folder/('passages.parquet' if family=='passages' else 'occurrences.parquet')
            con.execute('create table observations as select * from read_parquet(?)',[str(path)])
            if family!='passages' and not spec.get('include_reprints',True):
                con.execute('delete from observations where duplicate_of is not null')
            if family=='per_symbol':
                if not spec.get('symbol'):
                    raise DataProblem('Per-symbol datasets must be expanded before loading')
                con.execute('delete from observations where symbol_id != ?',[spec['symbol']])
            coverage=read_json(folder/'coverage.json')
            meta_cols=['observation_id','title','document_id','author','language','tradition','symbol_id','source_reference','char_start','char_end','text_hash']
            sources={'snapshot':str(path),'sha256':file_hash(path)}
        metadata_source='selected_metadata where not description_missing' if spec['adapter']=='jobs' else 'observations'
        n=con.execute('select count(*) from '+metadata_source).fetchone()[0]
        if n<20:
            raise DataProblem(f'{spec["name"]}: only {n} nonempty observations; at least 20 required')
        if con.execute('select count(distinct observation_id) from '+metadata_source).fetchone()[0]!=n:
            raise DataProblem('Nonunique stable observation IDs')
        metadata=con.execute(f'select {",".join(meta_cols)} from {metadata_source} order by observation_id').df()
        print(f'Dataset {spec["name"]}: {len(metadata):,} eligible observations',flush=True)
        for column in metadata:
            if column!='year':
                metadata[column]=metadata[column].astype('string[pyarrow]').fillna('')
                if column in ('employer','occupation_field','occupation_field_id','occupation_group','occupation_code',
                              'region','municipality','employment_type','source','ingested_at','author','document_id','tradition','language','symbol_id'):
                    metadata[column]=metadata[column].astype('category')
        identity=digest({'spec':spec,'sources':sources,'ordered_id_text_hash':digest(metadata[['observation_id','text_hash']].values.tolist())})[:24]
        folder=output/identity
        folder.mkdir(parents=True,exist_ok=True)
        target=folder/'observations.parquet'
        if not target.exists():
            temporary=target.with_suffix('.tmp.parquet')
            # Snapshot storage order may follow shards; every matrix/assignment is explicitly
            # indexed by the separately sorted stable IDs, so text never needs a full sort.
            con.execute(f'copy (select * from observations) to {sql_string(temporary)} (format parquet, compression zstd, row_group_size 20000)')
            temporary.replace(target)
        if spec['adapter']=='jobs':
            audit_path=folder/'near-duplicates.json'
            audit_config={k:config['evaluation'][k] for k in ('duplicate_sample_size','duplicate_similarity','seed')}
            if audit_path.exists() and read_json(audit_path).get('config')==audit_config:
                near=read_json(audit_path)
            else:
                from sklearn.feature_extraction.text import TfidfVectorizer
                from sklearn.neighbors import NearestNeighbors
                indices=np.sort(np.random.default_rng(audit_config['seed']).choice(n,min(n,audit_config['duplicate_sample_size']),replace=False))
                audit_ids=metadata.iloc[indices][['observation_id']]
                con.register('audit_ids',audit_ids)
                sampled=con.execute('select o.observation_id,o.description,o.employer from observations o join audit_ids using(observation_id)').df()
                pairs=[]
                try:
                    vectorizer=TfidfVectorizer(ngram_range=(1,2),max_features=20000,min_df=2)
                    matrix=vectorizer.fit_transform(sampled.description)
                    distance,neighbors=NearestNeighbors(n_neighbors=2,metric='cosine',n_jobs=1).fit(matrix).kneighbors(matrix)
                    seen=set()
                    for i in range(len(sampled)):
                        j=int(neighbors[i,1]); similarity=float(1-distance[i,1])
                        key=tuple(sorted([str(sampled.iloc[i].observation_id),str(sampled.iloc[j].observation_id)]))
                        if similarity>=audit_config['duplicate_similarity'] and key not in seen:
                            seen.add(key)
                            pairs.append({'ids':key,'cosine_similarity':similarity,
                                'same_employer':str(sampled.iloc[i].employer)==str(sampled.iloc[j].employer)})
                    near={'config':audit_config,'sample_ids':audit_ids.observation_id.tolist(),
                        'sample_size':len(sampled),'total_observations':n,'pairs':pairs,
                        'method':'TF-IDF 1-2 grams, min_df=2, max_features=20000; nearest neighbor within deterministic audit sample; no merges'}
                except ValueError as error:
                    near={'config':audit_config,'value':None,'reason':str(error)}
                atomic_json(audit_path,near)
            coverage['near_duplicate_audit']={k:v for k,v in near.items() if k not in ('sample_ids','pairs')}
            coverage['near_duplicate_audit']['pair_count']=len(near.get('pairs',[]))
            coverage['near_duplicate_audit']['details']=str(audit_path.resolve())
        manifest={'dataset_id':identity,'dataset':spec,'observations':n,'coverage':coverage,'sources':sources,
            'ordered_ids_sha256':digest(metadata.observation_id.tolist()),'data_sha256':file_hash(target),
            'path':str(target.resolve()),'scope':'full available intended corpus, before any explicitly recorded experiment sample'}
        atomic_json(folder/'manifest.json',manifest)
        atomic_json(folder/'coverage.json',coverage)
        return Dataset(spec,target,manifest,metadata)
    except duckdb.Error as error:
        raise DataProblem(f'Dataset {spec["name"]}: warehouse preparation failed: {error}') from error
    finally:
        con.close()


def expand(spec, config, symbolic_source):
    if spec.get('manifest'):
        return [spec]
    if spec['adapter']!='symbolic' or spec.get('family')!='per_symbol' or spec.get('symbol'):
        return [spec]
    with connection(config['resources']) as con:
        symbols=con.execute('''select symbol_id, count(*) n, count(distinct document_id) works
            from read_parquet(?) group by 1 having n>=? and works>=? order by n desc,symbol_id''',
            [str(symbolic_source/'occurrences.parquet'),spec.get('min_occurrences',100),spec.get('min_works',3)]).fetchall()
    maximum=spec.get('max_symbols')
    if maximum is not None:
        symbols=symbols[:maximum]
    return [{**spec,'symbol':symbol,'name':f'{spec["name"]}:{symbol}'} for symbol,_,_ in symbols]
