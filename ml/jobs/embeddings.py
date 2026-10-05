from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import hashlib

DEFAULT_MODEL = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
REPRESENTATION = 'token-chunks-mean-normalised-v1'


def embed(jobs, directory: Path, model_name=DEFAULT_MODEL, revision=None, batch_size=32):
    import numpy as np
    import pandas as pd
    from sentence_transformers import SentenceTransformer

    directory.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha256(f'{model_name}@{revision or "default"}:{REPRESENTATION}'.encode()).hexdigest()[:16]
    target = directory / f'embeddings-{key}.parquet'
    cached = pd.read_parquet(target) if target.exists() else pd.DataFrame()
    lookup = {r.text_hash: r.embedding for r in cached.itertuples()} if len(cached) else {}
    missing = jobs.loc[~jobs.text_hash.isin(lookup)].drop_duplicates('text_hash')
    if len(missing):
        model = SentenceTransformer(model_name, revision=revision, cache_folder=str(directory / 'models'))
        tokenizer = model.tokenizer
        chunk_size = max(16, model.max_seq_length - tokenizer.num_special_tokens_to_add())
        added = []
        for offset in range(0, len(missing), batch_size):
            group = missing.iloc[offset:offset + batch_size]
            chunks, owners, weights = [], [], []
            for row in group.itertuples():
                tokens = tokenizer.encode(row.text, add_special_tokens=False, truncation=False)
                for start in range(0, len(tokens), chunk_size):
                    part = tokens[start:start + chunk_size]
                    chunks.append(tokenizer.decode(part, skip_special_tokens=True))
                    owners.append(row.text_hash)
                    weights.append(len(part))
            vectors = model.encode(chunks, batch_size=batch_size, normalize_embeddings=True, show_progress_bar=False)
            for row in group.itertuples():
                indices = [i for i, owner in enumerate(owners) if owner == row.text_hash]
                vector = np.average(vectors[indices], axis=0, weights=np.asarray(weights)[indices])
                vector /= max(np.linalg.norm(vector), 1e-12)
                lookup[row.text_hash] = vector.astype('float32')
                added.append({'job_id': row.job_id, 'text_hash': row.text_hash, 'embedding_model': model_name,
                              'model_revision': revision, 'representation': REPRESENTATION,
                              'embedding': vector.astype('float32').tolist(), 'created_at': datetime.now(timezone.utc).isoformat()})
            print(f'Embedded {min(offset + batch_size, len(missing))}/{len(missing)} changed texts', flush=True)
            # Checkpoint each batch so interrupted jobs resume without starting over.
            combined = pd.concat([cached, pd.DataFrame(added)], ignore_index=True)
            temporary = target.with_suffix('.tmp.parquet')
            combined.to_parquet(temporary, index=False)
            temporary.replace(target)
    result = np.stack([lookup[h] for h in jobs.text_hash]).astype('float32')
    if not np.isfinite(result).all():
        raise ValueError('Nonfinite embeddings')
    return result, {'cache': str(target), 'reused': len(jobs) - len(missing), 'new_unique_texts': len(missing)}
