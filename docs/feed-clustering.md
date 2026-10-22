# Feed clusterings

`ml/cluster_lab/feed.py` runs small, validated clusterings for the "What does it even mean?"
feed. `configs/cluster_lab/feed.yaml` has one entry per clustering. Each entry has a DuckDB
query or existing vectors, a transform, a method and a reference label. Every method gets the
same diagnostics, and each clustering is exported as one compact JSON file. The text-corpus
sweeps (`ml/cluster_lab/cli.py`, `public_research.py`) remain the tool for large embedding
searches.

```powershell
python -m ml.cluster_lab.feed list
python -m ml.cluster_lab.feed run --only tax-mix --set warehouse=C:/path/to/shared/warehouse
python -m pytest ml/cluster_lab/tests/test_feed.py -q
```

`{warehouse}` in a query is the shared warehouse folder (default `warehouse`); `{data}` is
`frontend/public/data`. Outputs:
- `<warehouse>/features/clusters/<name>/assignments.parquet` and `metrics.json`
- `frontend/public/data/clusters/<name>.json`

Use `--set output=... --set publish=...` for trial runs outside the published folder.

## Limits

The machine usually has about 2 GB free. These defaults are deliberately small:
- **cluster_lab, feed and sweeps:** `memory_gb: 1.5`, `cpu_threads: 2`, `duckdb_memory_gb: 1`.
- **Torch:** `torch_threads: 1`, in cluster_lab only.

`ml/cluster_lab/limits.py` caps BLAS/numba threads, disables the TensorFlow import from
transformers, and starts an RSS watchdog. The watchdog ends the process with exit code 137
when memory passes the limit, including inside a fit. Sweeps resume from their last
checkpoint. On a GitHub runner, raise the limit explicitly, for example
`--set resources.memory_gb=6`.

Two methods keep a full n × n matrix: agglomerative clustering (`ward`, `average`, `chain`)
and co-clustering. They refuse inputs above 5,000 rows. Use `kmeans`, `gmm` or `hdbscan`
for larger inputs. For vectors, set `pca: 50` before clustering, and never fit UMAP on raw
384- or 1024-dimensional vectors on the laptop.

## Entry contract

| Key | Meaning |
|---|---|
| `name`, `family`, `title`, `note` | Export file name, feed family (`job`, `pol`, `wel`, `txt`), title, and a one-line method note shown to readers. |
| `query` | DuckDB SQL. It returns one row per entity, or per entity and period. Multiple statements are allowed (for example `attach ...;`); the last one must return the rows. |
| `vectors`, `ids` | `.npy` matrix and a JSON id list in the same order. `query` then only adds metadata by `id`. |
| `id`, `label`, `period`, `reference` | Entity key, display name, period column (pooled fit, then shares and flows per period), and a known grouping for AMI. |
| `features` | Default: every numeric column that is not a key. Rows with a missing feature are dropped and listed in the export. |
| `transform` | `zscore`, `clr` (shares or counts) or `none` (already standardised in SQL). |
| `pca` | Components before clustering. |
| `method` | `kmeans`, `gmm` (diagonal), `ward`, `average`, `chain` (only neighbours in query order may merge), `cocluster` (spectral co-clustering of rows and feature columns) or `hdbscan`. |
| `k` | Inclusive range. k is chosen by silhouette in the transformed space. |
| `min_cluster_size`, `min_samples` | HDBSCAN parameters. |
| `resample` | `rows`, which subsamples 80 % of whole entities, or `columns`, which subsamples 80 % of features. `chain` requires `columns`. |
| `resamples`, `nulls` | Per-entry overrides of the validation counts. |

## Export contract (`clusters/<name>.json`)

- **`method`:** method, transform, PCA, id, period, reference, features and seed.
- **`diagnostics`:**
  - entities, rows, dropped ids, k and the k search, noise share
  - silhouette in the transformed space, without UMAP
  - `stability`: mean and 5–95 % range of ARI across refits
  - `null`: silhouette under feature permutation (row-order permutation for `chain`) and p-value
  - `reference`: AMI against the known label
  - `verdict`:
    - `finding`: mean ARI ≥ 0.6, null p < 0.05 and at least 50 entities
    - `descriptive`: fewer than 50 entities
    - `exploratory`: anything else
- **`clusters`:**
  - size and share
  - the eight members closest to the centre
  - feature means in original units
  - the five most distinctive features in transformed units
  - column members for co-clustering
- **`members`:** `[id, cluster(, period)]`, when there are at most 3,000 rows.
- **`points`:** PCA 2D for up to 3,000 rows.
- **With a period:** `shares` per period and `flows` between consecutive periods, for a sankey.
- **Size:** an export above 300 KB fails. In that case, lower `validation.points`.

A post shows the verdict and diagnostics next to the chart. An `exploratory` result is only
published as a counter-example or a method note.

## Catalogue

### Ready in `feed.yaml`

Smoke run on 2026-10-22 against the shared `shiner` warehouse, written to `tmp/` only and not published:

| Entry | Data | Verdict | k | Silhouette | ARI | Null p | AMI (reference) | Time |
|---|---|---|---|---|---|---|---|---|
| `municipal-trajectories` | Municipality panel, 290 × 2010–2024 | finding | 4 | 0.30 | 0.91 | 0.005 | 0.13 (SKR group) | 75 s for the first five |
| `municipality-job-mix` | 2.75M local ads, 289 municipalities × 26 fields | finding | 3 | 0.22 | 0.92 | 0.005 | 0.21 (SKR group) | |
| `occupation-demand-curves` | 200 occupation groups × 45 months | finding | 3 | 0.13 | 0.74 | 0.005 | none | |
| `riksdag-eras` | 33 sessions × 25 topics | descriptive (n = 33) | 2 | 0.19 | 0.63 | 0.05 | none | |
| `tax-mix` | 39 OECD countries, 2022 | descriptive (n = 39) | 6 | 0.44 | 0.92 | 0.005 | none | |
| `sfs-paragraphs` | 9,970 bge-m3 vectors | exploratory | HDBSCAN | 0.23 | 0.98 | 0.09 (10 nulls; now at least 20) | 0.92 (law) | 4–5 min |

Notes on the smoke results:
- **`sfs-paragraphs`:** the vectors come from only 40 laws, and the clusters largely recover them (AMI 0.92). Publish it only as a "the model finds the law" method note, or embed more laws first.
- **`occupation-demand-curves`:** ad volume falls about 40 % from 2023 to 2025. The curves are therefore monthly shares of all ads, not counts. 2026 months may be incomplete in the corpus; check them before publishing.
- **`riksdag-eras`:** 59 % of Riksdag words have no topic; the shares are among topic-assigned words.
- **`tax-mix`:** k = 6 is the edge of the searched range, so widen the range or fix k by argument before publishing.

### Next candidates

| Candidate | Data | How with this module | What to check |
|---|---|---|---|
| Debate topics over time | `cluster_lab/public-consensus-2026-10-13/debate-*/assignments.parquet` + `public-topics-2026-10-12/datasets/debate/observations.parquet` (year, party) | Not a new clustering. A SQL share per year and party of the existing bge-m3 and SBERT labels; export through a small script or a `period` query with fixed labels. | Show both models and keep only trends present in both. Noise is 29 % (bge-m3) and 16 % (SBERT). |
| Futures topics (pilot) | `futures-topics/warehouse/ml/futures_topics/run/embeddings/*.npy`, 36 shards, 70,495 × 384, plus `sample.parquet` | Concatenate the shards into one `.npy`, with ids in the shards' row order. Then use `hdbscan` with `pca: 50`, or the pre-registered sweep in the pilot's `cluster.py`. | Follow `docs/sweden-futures-topics-preregistration.md`. Never pool Riksdag and DiVA. Use a GitHub runner if UMAP is required. |
| AI Act, English vs Swedish | `features/workers_ai/ai-act-{en,sv}/run/vectors.npy` (1,413 each) | Two entries with the same method. Then compute the ARI between the two exports; this needs a few lines. | Whether translation keeps the grouping. |
| Political geography 1973–2022 | `gold fct_election_municipality` (SCB raw on R2) | Party shares per municipality and election, `clr`, `kmeans`, `period: election_year` (sankey flows). | Boundary changes across elections; fold small parties into OTHER. |
| Thesis topics | `raw/diva/records.jsonl` (R2), `platform/publish/diva_clusters.py` | Keep the existing TF-IDF + KMeans on `refresh-diva.yml`; add shares per year. | TF-IDF silhouette is near zero by construction. Use stability, not silhouette. |
| Ad-language profiles | `features/sweden/ad_language/*_YYYY.parquet` | Field × category rates, `cocluster` or `ward`. | 21–26 fields is small: descriptive. |
| Library trajectories | `sweden/belonging/municipalities.json` | Like `municipal-trajectories`, z-scored per year. | The national decline dominates unless it is removed per year. |
| Tech skill stacks | `gold bridge_job_skills` (not built locally) | A graph community method is not in the module yet; `networkx` 3.5 is installed (Louvain). | Degree-preserving rewiring as the null. |
| Statistics catalogue titles | `sweden/measurement/items.json` (10,130 titles) | bge-m3 through `platform/nlp/workers_ai.py` (about 0.2M tokens), then a vectors entry with `pca: 50`. | Compare with the official subject tree (AMI). |
| Ad text sample, speech excerpts | 2.75M ads, 256,498 speech excerpts | Stratified sample of at most 60k, bge-m3 within the daily quota (about 8.8M tokens), then a vectors entry. | Never embed the whole corpus. |

### Do not cluster

- **MPs by vote:** party discipline makes the clusters equal the parties. `politics/parliament/story.json` already has deviation counts.
- **Roll calls:** coalition patterns are discrete, so count them instead.
- **ESS countries, 21 counties, poll series:** too few entities. Any k fits.
- **The symbolic atlas, again:** 49 % noise and no reviewed clusters.

## What to think about

- **Data is real or absent.** Use only queries on published or warehouse data. Rows with missing features are dropped and listed, never imputed.
- **Remove the obvious axis first.** A national trend, the population size or the source corpus otherwise becomes the clustering. Z-score within the period, divide by totals, or centre per corpus.
- **Choose the reference label before running.** A high AMI against the SKR group, party, law or corpus means the clustering mostly recovers something known. Say so in the post.
- **The verdict decides how a post may speak.** Only a `finding` may be described as structure. A `descriptive` result (n < 50) is a picture of the data, and an `exploratory` one is a method note.
- **Silhouette is relative.** 0.13–0.30 is normal for real social data. Never quote a UMAP-space silhouette as quality.
- **Name clusters from their profile.** Use the distinctive features and the closest members, and keep the numbers next to the name. Cluster numbers are not ranks.
- **Respect the memory limits.** Run one process at a time, and keep the laptop limits. Use Actions or another explicit raised limit for anything above the n × n limit or for UMAP sweeps.
- **No private data.** Ads are aggregated to occupation or municipality. Do not export ad text, employer contacts or private profiles.
- **Delivery.** Adding a new `clusters/*.json` file needs:
  - a delivery group entry in `configs/delivery/`
  - `catalog.json` regeneration through the normal release tools
  - one post file `frontend/src/meaning/posts/<family>-clusters-<name>.tsx`

  Verify with `npm run verify:quick`, the feed tests and `npm run verify:delivery`.

## Prompt for a full run

Paste the text below into a new agent session in this repository.

```text
Run the feed clusterings and add the results to the "What does it even mean?" feed.

Read CLAUDE.md, AGENTS.md and docs/feed-clustering.md first. Start code lookup with the
Graphify graph as in .claude/skills/graph-first/SKILL.md. The machine has about 2 GB free:
one Python process at a time, no dev server, no browser, keep resources.memory_gb at 1.5
and never fit UMAP on raw vectors locally.

1. Run `python -m ml.cluster_lab.feed list`. For each entry in configs/cluster_lab/feed.yaml,
   run it alone with `--set warehouse=<shared warehouse>` and trial outputs under tmp/
   (`--set output=tmp/feed/features --set publish=tmp/feed/publish`). Save each log in tmp/
   and record exit status, time, verdict, k, silhouette, ARI, null p and AMI.
2. Before trusting a result, open its export and check the cluster profiles:
   - Do the distinctive features and closest members make sense?
   - Is k at the edge of the range? If so, widen the range.
   - Do dropped rows or a high reference AMI change the story?
3. Add the "Next candidates" from docs/feed-clustering.md that the module can run now
   (debate topics over time, AI Act en/sv, ad-language profiles, library trajectories,
   futures topics after concatenating its shards). Write one yaml entry each, with real
   columns checked against the data first. Skip candidates whose data is not available
   locally and list them with the reason.
4. For every result with verdict finding or descriptive, write a feed post in
   frontend/src/meaning/posts/<family>-clusters-<name>.tsx. Use useData('clusters/<name>.json'),
   the existing Frame/Slicer/PALETTE kit and one focal accent. Use these charts:
   - a sankey from flows when there is a period
   - a reordered heatmap for co-clustering and job mix
   - small multiples for demand curves
   - a dendrogram or bar profile for small n
   Show the verdict and diagnostics in a small "how sure" line. Never name a cluster without
   its distinctive features. Exploratory results get at most a method note.
5. Publish only after step 4. Run the entries without the trial overrides, add the files to
   the delivery configuration and catalogue with the repo's own tools, and run
   `npm run verify:quick`, the feed tests and `npm run verify:delivery`.
6. Report a table of all entries (verdict, key numbers, published or not and why), the posts
   added, and anything skipped. Do not commit, push or deploy without explicit approval.
```
