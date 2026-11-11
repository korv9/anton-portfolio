# SWEDEN E: pre-registration of the futures topic pilot

Written 2026-10-22, before any sentence was embedded or clustered. It fixes the unit, sample,
model, clustering, selection rule, stability criterion, null models and what will count as a
finding for an unsupervised reading of what futures the Riksdag and Swedish student theses talk
about. The commit that adds this file is the record; any departure is listed in the export's
`method` block with its reason. No cluster is named in this pilot: every cluster is published as
"unreviewed cluster N" with its top terms until the owner has reviewed it.

## Unit and sample

- Unit: one sentence that contains a match of SWEDEN E's existing future marker (`future` in
  `platform/seeds/sweden_futures/future_terms.csv`). The marker decides only which sentences are
  read, never what they are about. Sentences are split on line breaks and on `.`, `!` or `?`
  followed by white space; sentences under 6 or over 80 words are left out.
- Riksdag: every speech in data.riksdagen.se's session archives, year from the speech date.
- DiVA: the Swedish abstract of student theses (`studentThesis`, first dc:language Swedish,
  `futures_theses.swedish()`), year of publication, the latest version of each OAI identifier.
  The title is not a sentence and is not read. Harvested from record month 2005-01: a record's
  datestamp is its last change, after the thesis was deposited.
- At most one sentence per speech or abstract: the matching sentence with the lowest SHA-1 of
  `seed:document id:sentence index`. One long speech cannot fill a year.
- Per year and corpus, at most 1,500 such sentences: the 1,500 documents with the lowest SHA-1 of
  `seed:document id`. Seed 20261022. Years analysed: Riksdag 1994–2025, DiVA 2005–2025 (complete
  years; DiVA has under 300 future-oriented abstracts a year before 2005).
- Text stays in ignored local storage. Published rows carry sentence id, corpus, year and cluster.

## Representation

- `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`, revision
  `e8f8c211226b894fcb81acc59f3b34ba3efd5f42`, on CPU, through `ml/jobs/embeddings.py` (normalised,
  checkpointed per batch).
- Primary space: each corpus's mean vector subtracted, then re-normalised, so that the clustering
  does not split parliamentary speech from academic prose before it splits subjects.
  Sensitivity: the same selected configuration on the uncentred vectors; the corpus AMI of both
  is reported.

## Clustering and selection

- Family: UMAP (5 dimensions, cosine, `min_dist` 0, `n_neighbors` 15, 30, 50) then HDBSCAN
  (`min_cluster_size` 0.5 %, 1 %, 2 % of the sample; `min_samples` 5, 10; excess of mass).
  Each UMAP is fitted with seeds 1, 2 and 3. Baseline: k-means and a diagonal Gaussian mixture on
  the 50-component PCA of the same vectors, k = 8, 12, 16, 24, 32, seed 1.
- Eligible: coverage (share not noise) at least 50 % and between 5 and 60 clusters.
- Selection: highest mean DBCV over the three seeds among eligible HDBSCAN configurations;
  silhouette in the UMAP space is reported beside it.
- Stability, required of the selected configuration: mean pairwise ARI across the three seeds at
  least 0.6 (assigned in both), and mean ARI at least 0.5 between the full fit and three refits
  on 80 % subsamples without replacement (seeds 11, 12, 13), on common sentences. A cluster is
  stable when its best Jaccard match in each other seed is at least 0.5. If no configuration
  passes, the pilot reports that no stable topic structure was found and publishes no topics.

## Null models

- Structure: every embedding dimension permuted independently across sentences (seed 20261022),
  then the selected configuration. The real space must give a higher DBCV and more than one
  cluster with more than 1 % of the sentences; otherwise the clusters are treated as artefacts.
- Trends: years permuted within corpus, 999 rounds, for every trend and correlation p-value.

## Analyses

- Share: sentences of a cluster over all sampled sentences of that year and corpus, noise
  included in the denominator. 95 % bootstrap CI, 1,000 resamples of sentences within each cell.
- Trend: OLS slope of share on year per stable cluster and corpus; permutation p; Holm over all
  stable cluster × corpus tests.
- Riksdag vs DiVA: per stable cluster with at least 1 % of sentences in both corpora, Pearson
  correlation of first-differenced yearly shares over 2005–2025, and cross-correlation at lags
  −3 to +3 years. p from 999 permutations of the differenced DiVA series; Holm over clusters for
  lag 0 and for the largest absolute lag correlation.
- Securitisation reading: trends of clusters whose top terms concern security, defence, threat or
  crisis are listed as exploratory only, until a reviewer has named the clusters.

## What counts as a finding

- A finding: a stable cluster whose trend, or whose Riksdag–DiVA correlation, has a Holm-adjusted
  p below 0.05 and that beats both null models.
- Not a finding: any cluster name or reading before review; unstable clusters; noise; a single
  year's spike; correlations over fewer than 10 overlapping years; a lag that is not significant
  after Holm; a corpus-specific cluster (90 % or more from one corpus) used as evidence that the
  two corpora talk about the same future.
- What cannot be concluded: what speakers or students intend or believe; anything about futures
  not voiced with the marker; that one corpus influences the other.

## Changes after registration

- 2026-10-22, storage. The first UMAP fit ran out of memory on the laptop, so the clustering
  moves to `.github/workflows/cluster-jobs.yml`. The sample (with its sentence text) and the
  embedding shards are therefore stored in the project's R2 warehouse store under
  `features/sweden/futures_topics/run/`, beside the raw speeches and abstracts they were drawn
  from. They are not part of any release, and the site still receives only sentence ids,
  corpus, year and cluster. The candidate files stay local.
- 2026-10-22, compute. The method is unchanged: UMAP runs on the full 384-dimensional centred
  vectors with the registered grid, on a 16 GB runner. The laptop memory fixes that would alter
  the method are not applied: PCA to 50 dimensions before UMAP, fewer epochs, fitting on a sample
  and transforming the rest, or fixing `n_neighbors` after a pilot. TensorFlow is kept out of the
  process, and the centred space is rebuilt from the shards for the analysis instead of being
  saved as a second copy.
