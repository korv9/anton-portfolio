# Job clustering parameter sweep — 4 October 2026

The original five-cluster fit put 84.99% of the 6,123 advertisements in one mixed group.
The selected replacement produces **25 groups**, with the largest containing **287 ads
(4.69%)**. It assigns 3,190 ads and leaves **2,933 (47.90%)** as noise. This improves the
resolution of identifiable groups while reducing coverage; it does not establish a clean
occupational taxonomy for the whole dataset.

## Search and selection

The same corpus, 384D cached multilingual embeddings, model commit and random seed 42
were used for all **417 candidates**. No advertisements were removed, translated or
re-embedded, and no embeddings contain the title-rule role labels.

Grid: UMAP neighbours 10/30/60 × dimensions 5/15 × minimum distance 0/.1;
HDBSCAN minimum cluster size 20/30/60/100 × minimum samples 3/5/10/20 × eom/leaf.
The initial UMAP 30/15/.05 representation was also searched, and its original
HDBSCAN 50/10/eom fit was retained: 13 × 32 + 1 = 417.

Reductions and density hierarchies were reused. Cosine silhouette in original embeddings
and Euclidean silhouette in UMAP use one fixed sample of 1,200 ads, excluding noise for
each candidate. As different ads become noise, these are **not** evaluations on identical
assigned subsets. Full-corpus noise, largest-cluster share and employer concentration are
reported separately. The [complete candidate table](job-clustering-sweep.csv) contains
every setting and result; local assignments, reductions, profiles and seed checks are in
`warehouse/ml/jobs/sweeps/25820ae69496eeba/`.

| Candidate | UMAP n / dimensions / min_dist | HDBSCAN size / samples / selection | Groups | Noise | Largest group | Original cosine silhouette | UMAP silhouette |
|---|---|---|---:|---:|---:|---:|---:|
| Previous | 30 / 15 / .05 | 50 / 10 / eom | 5 | 8.79% | 84.99% | −0.0882 | 0.2247 |
| **Selected** | **30 / 5 / 0** | **60 / 5 / leaf** | **25** | **47.90%** | **4.69%** | **0.0739** | **0.5222** |
| Finer eom fit | 30 / 5 / 0 | 30 / 5 / eom | 46 | 39.46% | 3.67% | 0.0654 | 0.5429 |
| Highest exploratory rank | 60 / 15 / 0 | 20 / 3 / leaf | 84 | 48.02% | 2.11% | 0.1185 | 0.5759 |

The exploratory rank is `original_silhouette − .3*noise_share − .5*largest_share
− .15*employer_majority_share`. It is a screening heuristic, not an accuracy metric.
Manual selection favoured a manageable number of interpretable groups, no dominant mixed
group, less than half the dataset as noise at seed 42 and stronger seed agreement than
the reviewed 46-group fit. The 25-group fit has better original-space separation and less
employer-majority concentration than the reviewed 46-group fit, although it assigns fewer ads.
The 84-group fit was not selected simply because it ranked higher.

## Profiles

Examples of the selected automatic descriptive profiles:

| ID | Label | Ads | Largest employer share |
|---:|---|---:|---:|
| 8 | Databricks / dbt | 277 | 12.64% |
| 9 | Fabric / dbt | 163 | 5.52% |
| 14 | SQL / Python | 129 | 10.08% |
| 15 | Angular / .NET | 100 | 45.00% |
| 16 | Spring / Kafka | 287 | 6.62% |
| 18 | PHP / Node.js | 172 | 6.40% |

Six groups remain majority-employer groups, covering 615 ads (19.28% of assigned ads).
These include Deploja, Veritaz, Försäkringskassan, Axis and SAAB. Employer/template
concentration remains visible in the explorer. Some C++/Linux profiles repeat across
several groups: numbering and examples distinguish them, but the skill labels alone do
not establish separate occupations. Original-vector silhouette of approximately .074 is
modest despite the much stronger UMAP score; parameter tuning has not eliminated the
limitations of mean-pooled full advertisement text.

## Seed sensitivity

Both the 25-group and 46-group configurations were checked with seeds 43 and 44. UMAP
was refitted; HDBSCAN parameters were held constant. Adjusted Rand index handles
permuted cluster IDs.

| Selected fit seed | Groups | Noise | ARI vs seed 42, including noise | ARI on mutually assigned ads | Mutually assigned share of corpus |
|---:|---:|---:|---:|---:|---:|
| 43 | 24 | 51.27% | .6136 | .9060 | 42.61% |
| 44 | 24 | 47.59% | .6751 | .8796 | 45.91% |

The 46-group alternative had mutually assigned ARI .7307/.7425 and all-row ARI
.5191/.5996. The selected fit has more consistent groups within the common assigned
core; membership/noise boundaries remain sensitive. The seed 43 fit puts more than half
the corpus in noise. These checks do not prove stability across years or employers.

## Reproduction and delivery

```powershell
ml/.venv/Scripts/python.exe -m ml.jobs.sweep
ml/.venv/Scripts/python.exe -m ml.jobs.sweep --review `
  warehouse/ml/jobs/sweeps/25820ae69496eeba/n30-d5-md0.0-s42-c60-ms5-leaf.json
ml/.venv/Scripts/python.exe -m ml.jobs.pipeline `
  --feature-recipe baseline --assignment-method hdbscan `
  --neighbors 30 --dimensions 5 --min-cluster-size 60 --min-samples 5 --selection-method leaf `
  --revision e8f8c211226b894fcb81acc59f3b34ba3efd5f42 `
  --sweep-candidate warehouse/ml/jobs/sweeps/25820ae69496eeba/n30-d5-md0.0-s42-c60-ms5-leaf.json
$env:PORTFOLIO_DB = "$PWD/warehouse/jobtech/history.duckdb"
python -m dbt.cli.main build --project-dir platform --profiles-dir platform `
  --vars '{job_clusters_enabled: true}' --select tag:job_clusters
python platform/publish/export_job_clusters.py
```

These were the embedding-only defaults; the current pipeline uses the
[feature ensemble](job-clustering-ensemble.md). For this older run the independent display UMAP is 2D with 30
neighbours, minimum distance .08 and seed 42; clustering is performed in 5D. The changed
colours reflect new memberships in the same display geometry. The explorer supports
distinct colours beyond six groups and clickable numbered legend entries to isolate a
group. Noise, original-vector silhouette and the sweep/seed provenance remain visible.
The default camera fits the assigned clusters; it reports the number of ads outside the
frame and has a full-map control that includes every distant noise point. This is an
affine view change, not a refit, removal of ads or independent repositioning of groups.

The pipeline validates the chosen corpus, source metadata, model, parameters and package
versions, and checks the recomputed labels/probabilities against the reviewed assignments
before updating raw. dbt owns gold and the existing exporter supplies the map and homepage.
No production deployment was performed. See [delivery record](editorial-clustering-delivery.md)
for the current run identity and validation results.
