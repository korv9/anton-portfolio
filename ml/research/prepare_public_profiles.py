"""Create a separate audited debate snapshot; retain original character-span IDs."""
from pathlib import Path
import re
import shutil

import pandas as pd
import yaml

from ml.cluster_lab.io import atomic_json, digest, file_hash, read_json
from ml.cluster_lab.public_research import snapshot

WORD_FIELD=re.compile(r'\bSTYLEREF\s+Kantrubrik\s+\\?\*\s+MERGEFORMAT[^\r\n]*',re.I)
LINE_HYPHEN=re.compile(r'(?<=\w)-[ \t]*[\r\n]+[ \t]*(?=\w)')


def clean(text):
    text=WORD_FIELD.sub('',text)
    text=LINE_HYPHEN.sub('',text)
    return ' '.join(text.split())


def main():
    source=Path('warehouse/cluster_lab/public-research-2026-10-12')
    target=Path('warehouse/cluster_lab/public-research-clean-2026-10-12')
    if (target/'datasets/debate/manifest.json').exists():
        frozen=read_json(target/'datasets/debate/manifest.json')
        if file_hash(frozen['path'])!=frozen['data_sha256']:
            raise ValueError('Existing cleaned snapshot checksum changed')
        print('Reusing immutable cleaned snapshot',frozen['dataset_id'],flush=True)
        return
    frame=pd.read_parquet(source/'datasets/debate/observations.parquet')
    transformed=frame.context.map(clean)
    if transformed.str.len().eq(0).any():
        raise ValueError('Cleaning empties passages; define a paired observation exclusion policy before proceeding')
    audit=pd.DataFrame({'observation_id':frame.observation_id,'changed':transformed.ne(frame.context),
        'word_field_removed':frame.context.map(lambda s:bool(WORD_FIELD.search(s))),
        'line_hyphens_rejoined':frame.context.map(lambda s:len(LINE_HYPHEN.findall(s))),
        'raw_characters':frame.context.str.len(),'clean_characters':transformed.str.len()})
    target.mkdir(parents=True,exist_ok=True)
    audit.to_parquet(target/'cleaning-audit.parquet',index=False)
    frame['raw_word_count']=frame.word_count
    frame['context']=transformed
    frame['word_count']=transformed.str.split().str.len()
    frame['text_hash']=transformed.map(digest)
    original=read_json(source/'datasets/debate/manifest.json')
    coverage={**original['coverage'],'scope':original['coverage']['scope']+'; Word-field and line-hyphen cleanup',
        'cleaning':{'word_field_passages':int(audit.word_field_removed.sum()),
            'line_hyphen_passages':int(audit.line_hyphens_rejoined.gt(0).sum()),
            'removed_characters':int((audit.raw_characters-audit.clean_characters).sum()),
            'minimum_clean_words':int(frame.word_count.min()),'row_exclusions':0,
            'rules':'remove only Word STYLEREF Kantrubrik MERGEFORMAT lines; join hyphenated line-break words; normalize whitespace',
            'limitation':'heuristic line-hyphen joining can join genuine compounds; original source span IDs remain available'},
        'raw_snapshot_id':original['dataset_id'],'repeated_exact_passages':int(frame.text_hash.duplicated().sum())}
    sources={'raw_manifest':file_hash(source/'datasets/debate/manifest.json'),
        'raw_observations':original['data_sha256'],'cleaning_code':file_hash(Path(__file__))}
    snapshot(frame,original['dataset'],target/'datasets/debate',coverage,sources)
    destination=target/'datasets/welfare'
    destination.mkdir(parents=True,exist_ok=True)
    shutil.copy2(source/'datasets/welfare/manifest.json',destination/'manifest.json')
    # The immutable welfare manifest still points to the original numeric Parquet snapshot.
    shutil.copy2(source/'datasets/welfare/coverage.json',destination/'coverage.json')
    settings=yaml.safe_load(Path('configs/cluster_lab/public_research.yaml').read_text(encoding='utf-8'))
    settings['lab']['output']=target.as_posix()
    Path('configs/cluster_lab/public_research_clean.yaml').write_text(yaml.safe_dump(settings,sort_keys=False,allow_unicode=True),encoding='utf-8')
    leaf=yaml.safe_load(yaml.safe_dump(settings))
    leaf['lab']['clustering']['cluster_selection_method']='leaf'
    leaf['research']={'debate':leaf['research']['debate']}
    leaf['research']['debate']['kmeans_clusters']=[]
    Path('configs/cluster_lab/public_research_clean_leaf.yaml').write_text(yaml.safe_dump(leaf,sort_keys=False,allow_unicode=True),encoding='utf-8')
    atomic_json(target/'cleaning-summary.json',coverage['cleaning'])
    print('Cleaned snapshot',len(frame),'unchanged observation IDs',coverage['cleaning'],flush=True)


if __name__=='__main__':
    main()
