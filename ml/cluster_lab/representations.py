"""Content-addressed shared embedding/reduction caches with batch checkpoints."""
from __future__ import annotations

from collections import Counter
import gc
import json
from pathlib import Path
import sqlite3

import numpy as np
import pandas as pd
from sklearn.preprocessing import normalize

from ml.jobs.embeddings import encode_text_batch
from ml.jobs.features import segments, MARKETING
from .io import ROOT, atomic_json, digest, file_hash, read_json, versions
from .datasets import DataProblem


def text_input(row, config, dataset):
    r=config['representation']
    if dataset.spec['adapter']=='symbolic':
        text=str(row.context)
        if r['mask_symbol'] and dataset.spec.get('family')!='passages':
            import sys
            sys.path.insert(0,str(ROOT/'platform/nlp/symbolic'))
            from transforms import mask_symbol
            text=mask_symbol(text,str(row.matched_term))
        return text
    fields=[]
    for field in r['text_fields']:
        raw=getattr(row,field)
        text='' if raw is None or pd.isna(raw) else str(raw)
        if field=='description' and r['preprocessing']=='boilerplate':
            parts=segments(text)
            # Only identified contact/application/benefit sentences are removed, not every
            # repeated occupational sentence. Preserve the original if removal empties it.
            removed=[part for part in parts if MARKETING.search(part)]
            text='\n'.join(part for part in parts if part not in removed) or text
        if text.strip() and (field!='title' or r['title_weight']>0):
            fields.append((field,text,r['title_weight'] if field=='title' else 1.0))
    if not fields:
        raise ValueError(f'Configured fields are empty for observation {row.observation_id}')
    return fields


def representation_identity(dataset, frame, config):
    return digest({'dataset':dataset.manifest['dataset_id'],'ids':frame.observation_id.tolist(),
        'text_hashes':frame.text_hash.tolist(),'representation':config['representation'],
        'seed':(config['representation']['fit_seed'] if config['representation'].get('fit_seed') is not None else config['seed']) if config['representation']['kind']=='tfidf_svd' else None,
        'version':versions(),'implementation':[file_hash(Path(__file__)),file_hash(ROOT/'ml/jobs/embeddings.py'),
                                             file_hash(ROOT/'ml/jobs/features.py')]})[:24]


def build(dataset, frame, config, checkpoint=lambda:None):
    r=config['representation']
    key=representation_identity(dataset,frame,config)
    folder=Path(config['cache'])/'representations'/key
    folder.mkdir(parents=True,exist_ok=True)
    target=folder/'matrix.npy'
    if (folder/'complete.json').exists():
        info=read_json(folder/'complete.json')
        if info['sha256']!=file_hash(target):
            raise DataProblem(f'Representation cache corrupted: {folder}')
        return np.load(target,mmap_mode='r'),info
    ids=frame.observation_id.tolist()
    positions={oid:i for i,oid in enumerate(ids)}
    text_hashes=[None]*len(ids)
    preprocessing_audit=Counter()
    if r['kind']=='numeric':
        from sklearn.preprocessing import StandardScaler, RobustScaler
        from joblib import dump
        raw=pd.read_parquet(dataset.path).set_index('observation_id').loc[ids,r['numeric_features']].to_numpy(dtype='float64')
        if not np.isfinite(raw).all():
            raise DataProblem('Numeric snapshot contains missing or nonfinite values; choose and document a missingness policy before fitting')
        scaler=StandardScaler() if r['numeric_scaler']=='standard' else RobustScaler()
        matrix=scaler.fit_transform(raw).astype('float32')
        dump(scaler,folder/'scaler.joblib')
        text_hashes=frame.text_hash.tolist()
        model_info={'model':r['numeric_scaler'],'revision':None,'features':r['numeric_features'],
                    'scaler_path':str((folder/'scaler.joblib').resolve()),'missing_policy':'complete cases, no imputation',
                    'raw_feature_means':raw.mean(axis=0).tolist(),'raw_feature_std':raw.std(axis=0).tolist()}
    elif r['kind']=='tfidf_svd':
        from ml.jobs.features import tfidf_svd
        texts=['']*len(ids)
        for part in dataset.texts(frame,config['resources']):
            for row in part.itertuples():
                value=text_input(row,config,dataset)
                text=value if isinstance(value,str) else '\n'.join(
                    f'{field.upper()}: {text}' for field,text,weight in value for _ in range(max(1,round(weight))))
                texts[positions[row.observation_id]]=text
                text_hashes[positions[row.observation_id]]=digest(value)
        # Existing lexical implementation; its complete effective parameters are recorded.
        fit_seed=r['fit_seed'] if r.get('fit_seed') is not None else config['seed']
        matrix,lexical=tfidf_svd(texts,r['svd_dimensions'],fit_seed,artifact_path=folder/'lexical.joblib')
        model_info={'model':None,'revision':None,'lexical':lexical,
                    'lexical_parameters':{'max_features':20000,'min_df':2,'max_df':0.9,'ngram_range':[1,2]}}
        if r['max_features']!=20000:
            raise ValueError('Existing tfidf_svd uses max_features=20000; change its shared implementation before overriding max_features')
    else:
        from sentence_transformers import SentenceTransformer
        # Raw text vector cache is independent of samples, centering, reductions and clustering.
        settings={k:v for k,v in r.items() if k not in ('centering','centering_strength','normalize',
                  'author_min_observations','author_min_works','metadata_features')}
        cache_key=digest({'settings':settings,'adapter':dataset.spec['adapter'],
                         'packages':versions(),'engine':file_hash(ROOT/'ml/jobs/embeddings.py'),
                         'text_engine':file_hash(Path(__file__))})[:24]
        cache_folder=Path(config['cache'])/'text_vectors'/cache_key
        cache_folder.mkdir(parents=True,exist_ok=True)
        db=sqlite3.connect(cache_folder/'vectors.sqlite')
        db.execute('pragma journal_mode=WAL')
        db.execute('create table if not exists vectors (text_hash text primary key, vector blob not null)')
        dtype=np.dtype(r['storage_dtype'])
        progress=sqlite3.connect(folder/'embedding-progress.sqlite')
        progress.execute('pragma journal_mode=WAL')
        progress.execute('create table if not exists cells (position integer primary key, text_hash text, vector_hash text)')
        model=None
        raw_path=folder/'raw.tmp.npy'
        if not raw_path.exists() and target.exists():
            target.replace(raw_path)
        matrix=np.load(raw_path,mmap_mode='r+') if raw_path.exists() else None
        quantization_error=0.0
        new_vectors=0
        done=0
        try:
            for part in dataset.texts(frame,config['resources']):
                checkpoint()
                row_positions=[positions[oid] for oid in part.observation_id]
                saved={index:(h,sha) for index,h,sha in progress.execute(
                    f'select position,text_hash,vector_hash from cells where position in ({",".join("?" for _ in row_positions)})',row_positions)}
                if saved and matrix is None:
                    raise DataProblem('Embedding progress exists without its checkpoint matrix')
                if saved:
                    import hashlib
                    for index,(h,sha) in saved.items():
                        if hashlib.sha256(matrix[index].tobytes()).hexdigest()!=sha:
                            raise DataProblem('Checkpoint vector checksum changed; inspect the partial cache before retrying')
                        text_hashes[index]=h
                if len(saved)==len(part):
                    done+=len(part)
                    print(f'  checkpoint vectors reused: {done:,}/{len(ids):,}',flush=True)
                    continue
                part=part.loc[[index not in saved for index in row_positions]]
                inputs=[text_input(row,config,dataset) for row in part.itertuples()]
                hashes=[digest(value) for value in inputs]
                found={h:np.frombuffer(blob,dtype=dtype) for h,blob in db.execute(
                    f'select text_hash,vector from vectors where text_hash in ({",".join("?" for _ in hashes)})',hashes)}
                missing={h:value for h,value in zip(hashes,inputs) if h not in found}
                if missing:
                    if model is None:
                        model=SentenceTransformer(r['model'],revision=r['revision'],device=r['device'],
                            cache_folder=str(Path(config['cache'])/'models'))
                        actual=getattr(model[0].auto_model.config,'_commit_hash',None)
                        if actual and actual!=r['revision']:
                            raise DataProblem(f'Model revision mismatch: requested {r["revision"]}, loaded {actual}')
                    values=list(missing.values())
                    if dataset.spec['adapter'] in ('jobs','snapshot'):
                        flat=[text for value in values for _,text,_ in value]
                        encoded=encode_text_batch(model,flat,r['batch_size'])
                        vectors=[]
                        offset=0
                        for value in values:
                            weights=np.array([weight for _,_,weight in value])
                            vector=np.average(encoded[offset:offset+len(value)],axis=0,weights=weights)
                            vector/=max(np.linalg.norm(vector),1e-12)
                            vectors.append(vector)
                            offset+=len(value)
                        vectors=np.asarray(vectors,dtype='float32')
                    else:
                        prefix='query: ' if r['model']=='intfloat/e5-base-v2' else ''
                        vectors=model.encode([prefix+value for value in values],batch_size=r['batch_size'],
                            normalize_embeddings=True,convert_to_numpy=True,show_progress_bar=False).astype('float32')
                    stored=vectors.astype(dtype)
                    new_vectors+=len(stored)
                    quantization_error=max(quantization_error,float(np.max(np.abs(vectors-stored.astype('float32')))))
                    vectors=stored
                    db.executemany('insert or ignore into vectors values (?,?)',
                        [(h,vector.tobytes()) for h,vector in zip(missing,vectors)])
                    db.commit()
                    found.update(zip(missing,vectors))
                if matrix is None:
                    dimensions=len(next(iter(found.values())))
                    matrix=np.lib.format.open_memmap(raw_path,mode='w+',dtype=dtype,shape=(len(ids),dimensions))
                for oid,h in zip(part.observation_id,hashes):
                    index=positions[oid]
                    matrix[index]=found[h]
                    text_hashes[index]=h
                # Flush the matrix before committing its cell hashes. An interrupted
                # incomplete block is replayed; committed vectors survive bounded text-cache eviction.
                matrix.flush()
                import hashlib
                progress.executemany('insert or replace into cells values (?,?,?)',
                    [(positions[oid],h,hashlib.sha256(matrix[positions[oid]].tobytes()).hexdigest()) for oid,h in zip(part.observation_id,hashes)])
                progress.commit()
                limit=config['resources']['text_vector_cache_rows']
                count=db.execute('select count(*) from vectors').fetchone()[0]
                if count>limit:
                    db.execute('delete from vectors where rowid in (select rowid from vectors order by rowid limit ?)',[count-limit])
                    db.commit()
                if dataset.spec['adapter']=='jobs' and r['preprocessing']=='boilerplate':
                    for row in part.itertuples():
                        for segment in segments(row.description):
                            if MARKETING.search(segment):
                                preprocessing_audit[segment]+=1
                done+=len(part)
                done+=len(saved)
                print(f'  embeddings {dataset.spec["name"]}: {done:,}/{len(ids):,}',flush=True)
            model_info={'model':r['model'],'revision':r['revision'],'vector_cache':str(cache_folder.resolve()),
                'encoding':'token-length-weighted normalized chunk means per field, title-weighted mean' if dataset.spec['adapter']=='jobs'
                    else 'existing Atlas normalized context encoding; model tokenizer truncation applies',
                'symbol_metadata_in_embedding':False,'preprocessing_audit':preprocessing_audit.most_common(100)}
            model_info['storage_dtype']=r['storage_dtype']
            model_info['new_vectors_measured']=new_vectors
            model_info['max_new_vector_quantization_error']={'value':quantization_error} if new_vectors else {'value':None,'reason':'All vectors reused; pre-storage precision not available'}
            model_info['text_cache_limit_rows']=config['resources']['text_vector_cache_rows']
        finally:
            db.close()
            progress.close()
            del model
            gc.collect()
    if any(h is None for h in text_hashes):
        raise DataProblem('Representation missing selected observation texts')
    if r['centering']!='none':
        # Transform a separate copy so a hard interruption cannot corrupt raw checkpoints.
        matrix=np.asarray(matrix,dtype='float32').copy()
        import sys
        sys.path.insert(0,str(ROOT/'platform/nlp/symbolic'))
        from transforms import center_document_means
        column='document_id' if r['centering']=='work' else 'author'
        groups=frame[column].astype(str)
        if column=='author':
            stats=frame.groupby('author').agg(n=('observation_id','count'),works=('document_id','nunique'))
            supported=stats.index[(stats.n>=r['author_min_observations']) & (stats.works>=r['author_min_works']) & (stats.index!='')]
            mask=groups.isin(supported).to_numpy()
            if not mask.any():
                raise ValueError('Author centering unsupported: no authors meet observation/work metadata thresholds')
        else:
            mask=np.ones(len(frame),dtype=bool)
        # Existing per-document operation is also the grouping operation for authors;
        # grouping field, supported coverage and strength are explicitly recorded.
        centered=center_document_means(np.asarray(matrix[mask]),groups[mask].tolist())
        matrix[mask]=(1-r['centering_strength'])*matrix[mask]+r['centering_strength']*centered
        model_info['centering']={'group':column,'strength':r['centering_strength'],
                                'centered_observations':int(mask.sum()),'unmodified_observations':int((~mask).sum())}
    if r['metadata_features']:
        from sklearn.feature_extraction import FeatureHasher
        for field in r['metadata_features']:
            if field not in frame:
                raise ValueError(f'Unavailable metadata feature {field}')
        hashed=FeatureHasher(n_features=64,input_type='dict').transform(
            [{f'{field}={row[field]}':1. for field in r['metadata_features']} for _,row in frame.iterrows()]).toarray().astype('float32')
        matrix=np.concatenate([matrix,hashed],axis=1)
        model_info['metadata_feature_variant']={'fields':r['metadata_features'],'encoding':'FeatureHasher 64 dimensions, equal scale'}
    if r['normalize'] and (r['centering']!='none' or r['metadata_features'] or r['kind']=='tfidf_svd'):
        for offset in range(0,len(matrix),20000):
            matrix[offset:offset+20000]=normalize(matrix[offset:offset+20000])
    if not np.isfinite(matrix).all():
        raise DataProblem('Nonfinite representation vectors')
    if isinstance(matrix,np.memmap) and r['centering']=='none' and not r['metadata_features']:
        matrix.flush()
        del matrix
        (folder/'raw.tmp.npy').replace(target)
    else:
        temporary=folder/'matrix.tmp.npy'
        with temporary.open('wb') as stream:
            np.save(stream,matrix.astype(r['storage_dtype']))
        temporary.replace(target)
        del matrix
    if (folder/'raw.tmp.npy').exists():
        (folder/'raw.tmp.npy').unlink()
    pd.DataFrame({'observation_id':ids,'embedding_text_sha256':text_hashes}).to_parquet(folder/'texts.parquet',index=False)
    info={'representation_id':key,'path':str(target.resolve()),'sha256':file_hash(target),
          'config':r,'ids_sha256':digest(ids),'dataset_id':dataset.manifest['dataset_id'],
          'text_hashes_path':str((folder/'texts.parquet').resolve()),**model_info}
    atomic_json(folder/'complete.json',info)
    return np.load(target,mmap_mode='r'),info


def reduce(vectors,representation,config):
    d=config['reduction']
    if d['method']=='none':
        return vectors,{'method':'none','parent':representation['representation_id'],'path':representation['path']}
    key=digest({'parent':representation['representation_id'],'reduction':d,'seed':config['seed'],
                'packages':versions(),'implementation':file_hash(Path(__file__))})[:24]
    folder=Path(config['cache'])/'reductions'/key
    folder.mkdir(parents=True,exist_ok=True)
    target=folder/'matrix.npy'
    if (folder/'complete.json').exists():
        info=read_json(folder/'complete.json')
        if info['sha256']!=file_hash(target):
            raise DataProblem('Reduction cache checksum mismatch')
        return np.load(target,mmap_mode='r'),info
    dimensions=2 if d['method']=='umap_2d' else d['n_components']
    if dimensions>=min(vectors.shape):
        raise ValueError(f'{dimensions} reduction dimensions invalid for {vectors.shape}; change YAML')
    if d['method']=='pca':
        from sklearn.decomposition import IncrementalPCA
        model=IncrementalPCA(n_components=dimensions,batch_size=max(2048,dimensions*4))
    elif d['method']=='svd':
        from sklearn.decomposition import TruncatedSVD
        model=TruncatedSVD(n_components=dimensions,random_state=config['seed'])
    else:
        from umap import UMAP
        if d['n_neighbors']>=len(vectors):
            raise ValueError('n_neighbors must be smaller than observations; no silent UMAP truncation')
        model=UMAP(n_neighbors=d['n_neighbors'],n_components=dimensions,min_dist=d['min_dist'],
            metric=d['metric'],random_state=config['seed'],n_jobs=1,init=d['init'],n_epochs=d['n_epochs'],low_memory=True)
    pre_pca=None
    if d['method'] in ('umap','umap_2d') and d['pre_pca_components'] is not None:
        from sklearn.decomposition import IncrementalPCA
        components=d['pre_pca_components']
        if components>=min(vectors.shape):
            raise ValueError('Pre-UMAP PCA dimensions must be smaller than input dimensions and row count')
        pca_key=digest({'parent':representation['representation_id'],'components':components,
                       'batch_size':d['pca_batch_size'],'packages':versions(),'engine':file_hash(Path(__file__))})[:24]
        pca_folder=Path(config['cache'])/'pre_pca'/pca_key
        pca_folder.mkdir(parents=True,exist_ok=True)
        pca_target=pca_folder/'matrix.npy'
        if not (pca_folder/'complete.json').exists():
            pca=IncrementalPCA(n_components=components)
            step=max(d['pca_batch_size'],components*2)
            start=0
            while start<len(vectors):
                end=min(start+step,len(vectors))
                if len(vectors)-end<components:
                    end=len(vectors)
                pca.partial_fit(np.asarray(vectors[start:end],dtype='float32'))
                start=end
            compressed=np.lib.format.open_memmap(pca_folder/'matrix.tmp.npy',mode='w+',dtype='float32',shape=(len(vectors),components))
            for start in range(0,len(vectors),step):
                compressed[start:start+step]=pca.transform(np.asarray(vectors[start:start+step],dtype='float32'))
            compressed.flush()
            del compressed
            (pca_folder/'matrix.tmp.npy').replace(pca_target)
            atomic_json(pca_folder/'complete.json',{'sha256':file_hash(pca_target),'dimensions':components,
                'batch_size':step,'explained_variance':float(pca.explained_variance_ratio_.sum()),
                'parent':representation['representation_id'],'ordered_ids_sha256':representation['ids_sha256']})
        pre_pca=read_json(pca_folder/'complete.json')
        if file_hash(pca_target)!=pre_pca['sha256']:
            raise DataProblem('Pre-PCA cache checksum mismatch')
        vectors=np.load(pca_target,mmap_mode='r')
    if d['method']=='pca':
        from sklearn.decomposition import IncrementalPCA
        model=IncrementalPCA(n_components=dimensions)
        step=max(d['pca_batch_size'],dimensions*2)
        start=0
        while start<len(vectors):
            end=min(start+step,len(vectors))
            if len(vectors)-end<dimensions:
                end=len(vectors)
            model.partial_fit(np.asarray(vectors[start:end],dtype='float32'))
            start=end
        space=np.lib.format.open_memmap(folder/'pca-output.tmp.npy',mode='w+',dtype='float32',shape=(len(vectors),dimensions))
        for start in range(0,len(vectors),step):
            space[start:start+step]=model.transform(np.asarray(vectors[start:start+step],dtype='float32'))
        space.flush()
    else:
        space=model.fit_transform(vectors).astype('float32')
    with target.with_suffix('.tmp.npy').open('wb') as stream:
        np.save(stream,space)
    target.with_suffix('.tmp.npy').replace(target)
    info={'reduction_id':key,'method':d['method'],'path':str(target.resolve()),'sha256':file_hash(target),
          'parent':representation['representation_id'],'config':d,'dimensions':dimensions,
          'exploratory_2d_clustering':d['method'] in ('umap','umap_2d') and dimensions==2,'seed':config['seed']}
    info['pre_pca']=pre_pca
    if pre_pca:
        info['pre_pca']['path']=str(pca_target.resolve())
    if d['method']=='pca':
        info['explained_variance']=float(model.explained_variance_ratio_.sum())
        info['actual_pca_batch_size']=step
        del space
        (folder/'pca-output.tmp.npy').unlink()
    from joblib import dump
    dump(model,folder/'model.joblib')
    atomic_json(folder/'complete.json',info)
    return np.load(target,mmap_mode='r'),info
