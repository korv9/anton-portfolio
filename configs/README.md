# configs

Settings read by the pipeline, the ML layer and the Workers AI tools. Each YAML file starts
with a comment that names its reader.

| Folder | What it holds | Read by |
|---|---|---|
| `delivery/` | One spec per delivery group (`baseline`, `diva`, `job-assistant`, `jobs`, `jobs-analysis`, `news`, `public-data`, `sweden`): which files a release holds, and which JSON Schema in `delivery/schemas/` each file must pass | `src/portfolio/publish/release.py`, the `groups` in `platform/pipeline.yml` ([R2 delivery contract](../docs/r2-delivery-contract.md)) |
| `cluster_lab/` | Clustering runs: corpus, embedding, UMAP and HDBSCAN settings | `ml/cluster_lab/`, `ml/research/` ([Cluster Lab](../ml/cluster_lab/README.md)) |
| `experiments/` | Frozen acceptance criteria per clustering experiment domain (`frozen_at` date), the job-ad refresh rule and `reproduction.yaml`, the notes on decisions that differed between machines | `ml/experiments/accept.py`, `ml/experiments/export.py` ([cluster experiments](../docs/cluster-experiments.md)) |
| `workers_ai/` | The laws behind Ask the law, and the eval questions for the answer endpoint | `platform/ingest/sfs/ingest.py`, `platform/publish/workers_ai/eval_answer.ts` ([Workers AI](../docs/workers-ai.md)) |
