# configs

Settings read by the pipeline, the ML layer and the Workers AI tools. Each YAML file starts
with a comment that names its reader.

| Folder | What it holds | Read by |
|---|---|---|
| `delivery/` | One spec per delivery group (`baseline`, `diva`, `jobs`, `jobs-analysis`, `news`, `public-data`, `sweden`): which files a release holds, and which JSON Schema in `delivery/schemas/` each file must pass | `platform/publish/release.py`, the `groups` in `platform/pipeline.yml` ([R2 delivery contract](../docs/r2-delivery-contract.md)) |
| `cluster_lab/` | Clustering runs: corpus, embedding, UMAP and HDBSCAN settings | `ml/cluster_lab/`, `ml/research/` ([Cluster Lab](../ml/cluster_lab/README.md)) |
| `workers_ai/` | The laws behind Ask the law, and the eval questions for both answer endpoints | `platform/ingest/sfs/ingest.py`, `platform/publish/workers_ai/eval_answer.ts` ([Workers AI](../docs/workers-ai.md)) |
