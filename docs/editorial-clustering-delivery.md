# Editorial design and job clustering: delivery record

Implemented locally on 4 October 2026. No production deployment or Git push was performed.

## Current feature ensemble

Run: `d8fa92127e2655f9`. After 192 feature/parameter fits and seed checks, the selected
input combines cleaned multilingual embeddings (65%), title TF-IDF/SVD (15%) and existing
technology TF-IDF (20%). Three UMAP/HDBSCAN fits at seeds 42/43/44 require two agreeing
votes. UMAP uses 60 neighbours / 10 dimensions / minimum distance 0; HDBSCAN uses minimum
size 100 / minimum samples 3 / eom. The independent 2D map uses the fused input.

| Measure | Ensemble result |
|---|---:|
| Eligible ads | 6123 |
| Assigned ads | 5210 |
| Groups | 17 |
| Noise | 913 / 14.91% |
| Largest group | Snowflake / dbt: 699 / 11.42% |
| Assigned ads in majority-employer groups | 0% |
| Weighted top-employer share | 8.64% |
| Mean agreeing vote fraction, assigned ads | 0.960269 |
| 10D UMAP silhouette, assigned sample | 0.583701 |
| Original full-text cosine silhouette, assigned sample | −0.036395 |
| Fused-feature cosine silhouette, assigned sample | 0.115224 |
| 2D trustworthiness against fused features | 0.939999 |
| 2D trustworthiness against original text | 0.715685 |
| Diagnostic sample | 1500 |

The original-vector separation and its map-neighbour preservation are lower than in the
previous run. This is an explicit tradeoff of the feature-defined grouping, rather than
an improvement under every similarity metric. The higher coverage and lower employer
concentration remain exploratory findings. See [ensemble findings](job-clustering-ensemble.md)
and [all 192 candidates](job-clustering-features.csv) for ablations, limitations and
stability. A disjoint 45/46/47 ensemble gives 17 groups / 15.4% noise, all-row ARI .800 and
core ARI .989, with the common assigned core covering 80.94% of ads.

Profiles include Python/SQL (234), Snowflake/dbt (699), React/JavaScript (205),
Kubernetes/Docker (157) and C#/.NET (399). Two groups remain weakly differentiated.
Skill labels now require 15% within-group support so rare high-lift mentions cannot name
an entire group. The UI distinguishes vote support from probability, displays detected
skill coverage and records both original-text and fused-feature diagnostics.

Validation: 16 ML tests passed; 2 cluster marts / 11 data tests and 2 raw source tests
passed; 12 desktop/mobile browser checks passed; TypeScript/Vite production build passed.
The browser suite covers consensus support wording, real delivery reconciliation,
keyboard/legend interaction, honest map framing and accessibility. Real map screenshots
were reviewed. No production deployment was performed.

## Previous parameter-sweep run (superseded)

Run: `6ac28943b48400cd`. The 417-candidate search and profile/seed review selected
UMAP 30 neighbours / 5 dimensions / minimum distance 0 and HDBSCAN minimum size 60 /
minimum samples 5 / leaf selection. All 6,123 eligible ads and the existing embedding
cache are reused. The separate 2D display geometry is unchanged.

| Measure | Current result |
|---|---:|
| Groups excluding noise | 25 |
| Largest group | Spring / Kafka: 287 ads / 4.69% |
| Assigned ads | 3190 |
| Noise | 2933 ads / 47.90% |
| Mean assigned membership | 0.874274 |
| Silhouette, 5D UMAP excluding noise | 0.510003 |
| Silhouette, original embeddings / cosine excluding noise | 0.074529 |
| Silhouette sample | 1500 assigned ads |
| 2D trustworthiness | 0.811919 |
| Role adjusted Rand index | 0.032758 |

Selected groups include Databricks/dbt (277), Fabric/dbt (163), SQL/Python (129),
Angular/.NET (100) and Spring/Kafka (287). Six groups remain dominated by one employer.
The much smaller largest group improves resolution at a substantial coverage cost.
Original-vector separation remains modest. See [sweep findings](job-clustering-sweep.md)
and [all 417 candidates](job-clustering-sweep.csv) for comparisons and seed sensitivity.
The 1,500-row final diagnostic sample differs from the 1,200-row sweep sample.

The explorer now gives groups beyond the initial six palette entries distinct colours
and offers clickable numbered legend entries that isolate each group. Delivery records
the search count, selected metrics and two additional seed checks.
The default view fits assigned clusters, discloses ads outside the frame, and provides
a full-map control. It preserves every point and all original display coordinates.

Follow-up validation: 10 ML tests passed; the 2 cluster marts and 11 data tests passed;
both raw source tests passed; 10 desktop/mobile clustering browser cases passed, including
real delivery reconciliation, clickable legend, keyboard interaction and accessibility;
TypeScript/Vite production build passed.

## Initial measured run (superseded)

Run: `45b729b5b643e5f6`. Source: the official 2025 JobTech historical archive, rebuilt through existing ingestion and dbt.

Model: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` at commit `e8f8c211226b894fcb81acc59f3b34ba3efd5f42`.

| Measure | Result |
|---|---:|
| Eligible ads | 6123 |
| Distinct text representations | 5286 |
| Discovered clusters (noise excluded) | 5 |
| Noise | 538 ads / 8.79% |
| Mean membership, assigned points | 0.958327 |
| Silhouette, 15D UMAP excluding noise | 0.238888 |
| 2D UMAP trustworthiness | 0.811919 |
| Trustworthiness sample | 1500 |
| Adjusted Rand index against existing role | -0.076541 |

## Discovered profiles

| ID | Automatic label | Ads | Dataset share | Largest employer share |
|---|---|---:|---:|---|
| -1 | Unassigned / noise | 538 | 8.79% | Syntronic AB / 16.91% |
| 0 | Kotlin / Spring | 123 | 2.01% | Deploja AB / 95.93% |
| 1 | Terraform / Node.js | 63 | 1.03% | IKEA of Sweden AB / 38.10% |
| 2 | Linux / Node.js | 103 | 1.68% | Axis Communications AB / 85.44% |
| 3 | Vue / Java | 92 | 1.50% | Försäkringskassan / 92.39% |
| 4 | Mixed tech advertisements | 5204 | 84.99% | Rasulson Consulting AB / 3.82% |

The largest group is deliberately labelled Mixed tech advertisements: its leading skill lift is only about 1.11 and the most common title has a small share. It contains all four existing role families (83.3% Software Developer, 11.7% Data Engineer, 4.4% Data Scientist and 0.6% Analytics Engineer). It does not represent a newly validated occupation.

Three smaller groups are strongly dominated by one employer. Kotlin / Spring has 118 of 123 ads from Deploja; Linux / Node.js has 88 of 103 from Axis; Vue / Java has 85 of 92 from Försäkringskassan. Terraform / Node.js has the strongest distinctive Terraform lift (about 5.51), but its largest employer supplies 24 of 63 ads. These are evidence for employer/template concentration, not proof that technology alone causes the clusters. The frontend exposes this uncertainty next to the profiles.

## Parameter sensitivity

| Neighbours | Minimum cluster size | Clusters | Noise | Silhouette | Trustworthiness |
|---:|---:|---:|---:|---:|---:|
| 30 | 50 | 5 | 8.79% | 0.2389 | 0.8119 |
| 15 | 50 | 5 | 7.87% | 0.2881 | 0.8034 |
| 30 | 25 | 43 | 45.88% | 0.5786 | 0.8119 |

A higher silhouette under minimum size 25 excludes nearly 46% of the dataset as noise. It is not a like-for-like improvement over the baseline; smaller dense groups may exaggerate template effects. This was the initial size-50 baseline; the parameter sweep above supersedes it. Its immutable delivery shards and run report remain available for comparison.

## Delivery and architecture

Existing JobTech ingestion → DuckDB bronze/silver → local cached embeddings → higher-dimensional UMAP/HDBSCAN plus separate 2D UMAP → raw ML sources → dbt gold cluster marts → dedicated compact exporter → React Canvas explorer.

The homepage reads a 1,500-point sample (about 111 KB uncompressed). The full explorer loads two versioned shards totalling about 1.90 MB; no descriptions or embedding vectors are shipped. The frontend module is loaded on demand. Existing politics, all-occupation job-market, welfare, DrugComb, Allegoria, thesis, Homie, source-browser, analytics and tax products remain available.

The new global tokens, reusable editorial primitives and four project rows remove contradictory decorative styling while preserving party identities. The homepage displays the real job UMAP. The incident project uses a methodological preview because its internal UMAP coordinates are not public.

## Validation

- Python ML tests: 6 passed, covering reproducible input/hash, duplicate/nonfinite/probability rejection, cache reuse and model invalidation, source selection, noise/profiles, delivery content and run consistency.
- Existing dbt jobs build: 43 steps passed, including 30 data tests.
- New cluster marts: 2 models and 11 data tests passed; the 2 raw ML source tests also passed.
- Full desktop/mobile browser suite: 82 passed. After adding employer concentration, the 8 cluster browser cases were rerun and passed.
- Existing tax calculator unit checks executed during browser discovery: 17 passed.
- Responsive visual inspection: actual desktop/mobile homepage, project previews and real-data explorer screenshots reviewed.
- Production build: TypeScript and Vite succeeded. The final build includes the real delivery datasets.

## Limits and work not performed

- Coverage is the 2025 archive, including 27 selected spillover advertisements published in 2024. Earlier archives were not downloaded for this run; the existing historical ingestion supports extending coverage.
- Labels are deterministic automatic descriptions; selected profiles were inspected, but no expert occupational annotation was performed. Employer/template concentration and noise limit interpretation.
- No employer-grouped, template-deduplicated or cross-year stability study was run. The ensemble has additional seed-window checks, including a disjoint three-seed ensemble; results are in the ensemble findings.
- The internal incident UMAP cannot be shown without the original coordinates; no replacement map was fabricated.
- No production publishing was requested or performed.

## Changed-file inventory

Ignored raw archives, weights, databases, search caches, build output and screenshots are not part of this inventory.

### Documentation and entry points

- `README.md`
- `docs/design-system.md`
- `docs/editorial-clustering-delivery.md`
- `docs/job-market-clustering.md`
- `docs/job-clustering-sweep.md`
- `docs/job-clustering-sweep.csv`
- `docs/job-clustering-ensemble.md`
- `docs/job-clustering-features.csv`
- `ml/README.md`

### Frontend implementation

- `frontend/src/App.tsx`
- `frontend/src/budget.css`
- `frontend/src/datamodel/datamodel.css`
- `frontend/src/design-system.css`
- `frontend/src/home/HomePage.tsx`
- `frontend/src/home/PoliticsPreview.tsx`
- `frontend/src/home/home.css`
- `frontend/src/jobs/ClusterMap.tsx`
- `frontend/src/jobs/ClusterPreview.tsx`
- `frontend/src/jobs/ClusteringSection.tsx`
- `frontend/src/jobs/JobMarketPage.tsx`
- `frontend/src/jobs/TechReport.tsx`
- `frontend/src/jobs/clusterData.ts`
- `frontend/src/jobs/clusters.css`
- `frontend/src/parties/parties.css`
- `frontend/src/politik/politik.css`
- `frontend/src/styles.css`
- `frontend/src/ui/Editorial.tsx`

### Frontend tests

- `frontend/tests/clusters.spec.ts`
- `frontend/tests/language.spec.ts`
- `frontend/tests/portfolio.spec.ts`

### Real delivery data

- `frontend/public/data/jobs/cluster-preview.json`
- `frontend/public/data/jobs/cluster-summary.json`
- `frontend/public/data/jobs/clusters/45b729b5b643e5f6/points-0.json`
- `frontend/public/data/jobs/clusters/45b729b5b643e5f6/points-1.json`
- `frontend/public/data/jobs/clusters/6ac28943b48400cd/points-0.json`
- `frontend/public/data/jobs/clusters/6ac28943b48400cd/points-1.json`
- `frontend/public/data/jobs/clusters/d8fa92127e2655f9/points-0.json`
- `frontend/public/data/jobs/clusters/d8fa92127e2655f9/points-1.json`

### ML implementation and tests

- `ml/__init__.py`
- `ml/jobs/__init__.py`
- `ml/jobs/cluster.py`
- `ml/jobs/embeddings.py`
- `ml/jobs/evaluate.py`
- `ml/jobs/pipeline.py`
- `ml/jobs/prepare.py`
- `ml/jobs/profile.py`
- `ml/jobs/reduce.py`
- `ml/jobs/sweep.py`
- `ml/jobs/features.py`
- `ml/jobs/feature_experiment.py`
- `ml/jobs/tests/test_jobs.py`
- `ml/jobs/tests/test_sweep.py`
- `ml/jobs/tests/test_features.py`

### dbt and export

- `platform/models/bronze/jobs/clusters_sources.yml`
- `platform/models/gold/jobs/clusters_schema.yml`
- `platform/models/gold/jobs/dim_job_clusters.sql`
- `platform/models/gold/jobs/mart_job_clusters.sql`
- `platform/publish/export_job_clusters.py`
- `platform/tests/jobs/assert_cluster_output.sql`
