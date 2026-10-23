# Feature engineering study: where combined features beat the baseline

Run on 2026-10-23 on a laptop: one process, DuckDB at 1 GB. Code is in `ml/feature_study/` and
the tests are in `platform/tests/python/test_feature_study.py`. Each experiment writes its full
result to `tmp/feature-study/<name>.json`. Nothing here reaches the site.

Within an analysis, the baseline and every engineered set get the same model, folds, bootstrap
and null, so those comparisons change only the features. The futures section also quotes the
registered UMAP + HDBSCAN pilot. That comparison changes the method as well. Intervals are 95 % (2.5th to 97.5th percentile) unless a
column says 5-95 %.

## Summary

| Analysis | Baseline | Gain over the baseline (paired interval) | No clear gain |
|---|---|---|---|
| Job ads, senior vs junior (AUC) | 32 skill flags: 0.56 [0.48, 0.63] | experience signals in the body: +0.147 [+0.105, +0.191] | skill count and length, co-occurrence stack vectors, boosted-tree interactions |
| Job ads, six roles (macro-F1) | 0.20 [0.18, 0.21] | experience +0.057 [+0.047, +0.069]; smaller gains from size +0.035, boosted trees +0.015 and stack vectors +0.014, each interval above 0; all together +0.084 [+0.075, +0.095] | none |
| Municipal types (bootstrap ARI) | plain levels | none | per-capita rates and logs, party CLR, change since 2015, slopes, job-field CLR |
| Riksdag party groups (session ARI, 3 sessions apart) | Hellinger on one session's topic words | none | pooling a session with its two neighbours (+0.16 [−0.07, +0.36]); CLR (Aitchison) of topic shares; talk added to votes |
| Futures sentences (exploratory) | PCA-50 K-means on the centred space: seed ARI 0.70 at k = 16 | none at k = 16 (k = 8 and 16 were both fixed before the run; centred k = 8 repeats at seed ARI 1.00, subsample 0.98, and follows the marker) | metadata regressed out (0.70 at k = 16); metadata as features (the clusters then follow the metadata) |

No gold mart is added. The one clear gain is the job-ad experience signals, and they are
ad-level features. The repository publishes job ads only as aggregates, and no aggregate
analysis uses them yet. Pooling Riksdag sessions has a positive point estimate, but its interval
includes zero once sessions, not session pairs, are resampled. In the futures run, regressing out
the metadata adds no stability at k = 16. A mart can follow once an analysis that is published depends on one of
these.

## Job ads: seniority and role

`python -m ml.feature_study.job_ads <folders>` reads the JobTech cluster corpus for 2024 and 2025
(pulled from R2 into the ignored `tmp/warehouse/raw`). The counts and scores below are in
`ml/feature_study/results/job_ads.json` (numbers only, no ad text). It keeps Data/IT ads with descriptions of
at least 300 characters, deduplicated on the exact lower-cased description: 62,966 ads. A repost
with an edited description counts twice. Every ad in these two years names an employer; the code
leaves out any ad that does not. The title
gives the label (senior: senior, lead, principal, sr, erfaren; junior: junior, graduate,
trainee, jr, nyexad). 12,557 ads carry a label, 86.9 % of them senior, from 1,467 employers. Duplicates of one
description can have different titles, and the query keeps any one of them, so a rerun can label
a few ads differently (12,554 in a later load).
The title is never a feature. The model is logistic regression with balanced class weights,
five folds grouped by employer, out-of-fold scores, and a 1,000-round employer bootstrap. Each
difference comes from the paired bootstrap, so it is an interval for the difference itself.

| Features | Seniority AUC | vs skills | Role macro-F1 | vs skills |
|---|---|---|---|---|
| skills (32 flags, `technology_patterns.csv`) | 0.561 [0.482, 0.633] | | 0.195 [0.181, 0.209] | |
| + size (log skill count, log words) | 0.562 [0.518, 0.604] | +0.001 [−0.044, +0.052] | 0.230 [0.214, 0.247] | +0.035 [+0.027, +0.043] |
| + stack (8-dim SVD of skill PPMI, mean per ad) | 0.557 [0.484, 0.626] | −0.004 [−0.012, +0.004] | 0.208 [0.192, 0.226] | +0.014 [+0.008, +0.020] |
| + experience (years asked, lead/mentor words, entry words, remote/hybrid) | 0.708 [0.649, 0.764] | +0.147 [+0.105, +0.191] | 0.252 [0.232, 0.273] | +0.057 [+0.047, +0.069] |
| + all of the above | 0.712 [0.660, 0.762] | +0.151 [+0.101, +0.206] | 0.279 [0.261, 0.298] | +0.084 [+0.075, +0.095] |
| skills, boosted trees (interactions) | 0.567 [0.489, 0.637] | +0.006 [−0.011, +0.027] | 0.210 [0.193, 0.228] | +0.015 [+0.010, +0.022] |
| + all + "senior"/"junior" in the body | 0.927 [0.902, 0.946] | +0.366 [+0.280, +0.456] | | |

How to read it:
- The 32 repository skill flags barely separate senior from junior titles. An earlier run on
  2025 alone, without class weights, gave 0.45 [0.35, 0.57], which is no better than chance
  (`ml/feature_study/results/job_ads-2025-unweighted.json`).
- The skill co-occurrence vectors and boosted-tree interactions add nothing to seniority. The
  vectors are a linear summary of the same flags, and the flags hold little signal to begin with.
- Experience wording helps both tasks. The ad states the years of experience it asks for and
  whether the role leads or mentors. The years pattern counts "N års erfarenhet" and "N years of
  experience" and caps at 20. The senior label includes "erfaren" in the title, which is close to
  "erfarenhet" in the body. That overlap is lexical, but it is also what the ad asks for.
- The consistency row runs the title label regexes (senior, lead, principal, sr, erfaren and the
  junior words) on the body. The features are the label's own words, so the 0.93 shows how often
  title and body use the same words. It is not an independent signal and not a predictive gain.
- Limits: only 20 % of ads carry a title label, and "lead" also matches team-lead roles. Each
  regex flag means "mentioned in the ad", not "required". The same unweighted 2025 run gave
  role macro-F1 0.13, roughly the score of always predicting the majority group (58 % of ads).
  That is why every set uses balanced weights.

## Municipal types from the cross-subject panel

`python -m ml.feature_study.municipal` reads `gold.mart_municipality_year_cross_subject`, built
in a copy of the shared warehouse; the shared one did not have it yet. It uses seven indicators:
open unemployment, social assistance, median earned income, local income tax rate, library
visits, turnout and sick pay. It also uses the eight parties' shares in the latest election.
The reference year is 2024 and the baseline year 2015. K-means picks k by silhouette over 2-8
and is also run at a fixed k = 4. The checks are a 100-round bootstrap ARI (5-95 %), the
silhouette margin over the 95th percentile of a feature-wise permutation null (200 rounds), AMI
with SKR's municipality groups, and the ARI between the fit on 2014-2019 features and the fit on
2019-2024 features. Every set covers the same municipalities. Without library visits, 240 of the 290 municipalities
have every value. Library visits are missing for 38 of those 240, so the comparison runs without them
(240 units) and with them (202 units).

Without library visits (240 municipalities):

| Features | k | Bootstrap ARI, k chosen | ARI at k = 4 | Null margin at k = 4 | AMI SKR at k = 4 | Period ARI at k = 4 |
|---|---|---|---|---|---|---|
| levels as delivered | 2 | 0.73 [0.45, 0.97] | 0.59 [0.29, 0.88] | 0.095 | 0.17 | 0.37 |
| engineered (log income, CLR of party shares) | 2 | 0.77 [0.52, 1.00] | 0.56 [0.29, 0.87] | 0.097 | 0.23 | 0.37 |
| engineered + change since 2015 | 2 | 0.84 [0.60, 1.00] | 0.57 [0.26, 0.83] | 0.082 | 0.20 | 0.34 |
| engineered + slope 2015-2024 | 2 | 0.72 [0.40, 1.00] | 0.56 [0.29, 0.81] | 0.083 | 0.21 | 0.38 |
| engineered + job-field CLR (ads 2023-2025) | 2 | 0.74 [0.37, 0.95] | 0.47 [0.27, 0.78] | 0.066 | 0.27 | n/a |

With library visits per 1,000 residents (202 municipalities), at k = 4: levels 0.53
[0.27, 0.86], engineered 0.59 [0.33, 0.85], + change 0.61 [0.29, 0.88], + slope 0.59
[0.39, 0.86], + jobs 0.46 [0.25, 0.74]. The period ARIs are 0.35, 0.35, 0.44, 0.39 and n/a.

None of these feature sets helps. Every bootstrap interval overlaps the others almost
completely, and every period ARI stays under 0.6. Under the clustering batches' rule
(`docs/cluster-batches.md`), each set would be a counter-example. The silhouette always picks
k = 2, the low end of the sweep. Adding the job-field shares moves the groups a little closer to
SKR's groups (AMI 0.27 against 0.17) but makes them less stable. On this panel, a municipal
"type" is mostly a level difference that drifts over five years, whatever the features.

## Riksdag: party talk and votes per session

`python -m ml.feature_study.talk_vote` takes its inputs from the published talk-vote clustering
(`platform/publish/clusters/talk_vote.py`): 33 sessions with seven to nine parties. Each set's
distances are cut into three groups by average linkage. All intervals come from a bootstrap
over sessions (1,000 rounds). The topic bootstrap ARI and the Mantel r have one value per
session. A session sits in up to two lag pairs, so for the session ARI each round draws 33
sessions with replacement and averages the pairs whose two sessions were both drawn, weighted by
how often each was drawn. The lag counts positions in the full session order, so pairs stay the
same distance apart even when a session is left out. In this run all 33 sessions are consecutive.

| Distance | Session ARI, 1 apart (95 %, session bootstrap) | Session ARI, 3 apart (95 %, session bootstrap) | Topic bootstrap ARI (95 %, session bootstrap) | Mantel r with votes (95 %, session bootstrap) |
|---|---|---|---|---|
| Hellinger, one session's topic words (published) | 0.21 [−0.01, 0.45] | 0.07 [−0.09, 0.26] | 0.44 [0.40, 0.49] | −0.04 [−0.12, 0.06] |
| Aitchison (CLR of topic shares) | 0.06 [−0.09, 0.19] | 0.03 [−0.08, 0.20] | 0.42 [0.37, 0.46] | 0.01 [−0.06, 0.08] |
| Hellinger, session pooled with its neighbours | 0.48 [0.30, 0.72] | 0.23 [0.02, 0.46] | 0.47 [0.41, 0.53] | −0.04 [−0.12, 0.06] |
| votes (1 − agreement) | 0.76 [0.58, 0.91] | 0.52 [0.29, 0.76] | | |
| talk + votes (mean of scaled distances) | 0.56 [0.35, 0.80] | 0.47 [0.24, 0.69] | 0.79 [0.75, 0.84] | |

- The Hellinger row matches the published topic bootstrap (0.44, published with a 5-95 %
  interval), so the setup is the same.
- Pooled windows overlap one session apart, so that column flatters them. Three sessions apart
  the windows share nothing. Pooling gives 0.23 against 0.07, but on the same 30 session pairs
  the paired difference is +0.16 [−0.07, +0.36]. The interval includes zero, so this run does not
  show that pooling helps, and the talk tree is unstable either way.
- CLR makes the talk groups less persistent: small topics get as much weight as large ones.
- Talk does not track votes under any of these distances (Mantel r near 0). Adding talk to votes
  gives groups that persist less than votes alone. Its high topic bootstrap ARI is partly built
  in, because the votes stay fixed in that bootstrap.

## Futures sentences: exploratory, outside the pre-registration

This section is a labelled exploratory analysis dated 2026-10-23. It does not amend the
registered pilot (`docs/sweden-futures-topics-preregistration.md`). That pilot found no stable
topic structure: seed ARI 0.38 and subsample ARI 0.36 for UMAP + HDBSCAN. Its result stands, and
nothing here is published as topics.

`python -m ml.feature_study.futures` reads the pilot's 70,495 sampled sentences and their MiniLM
vectors. Each space is reduced to 50 PCA components and clustered with K-means, one start per
seed. The checks are the mean pairwise ARI over seeds 1-3, the ARI between the seed-1 fit and
seed-1 refits on three 80 % subsamples (rows drawn with seeds 11-13), and the silhouette on
10,000 sentences against the 95th percentile of a null where each component is permuted on its
own. The null has only 20 rounds, so its 95th percentile is indicative. Marker type is the alternative of
the registered future marker that occurs first: framtid 45,430, long-term 17,365, vision 3,534,
year horizon 2,868, coming generations 778, "morgondagens" 520.

| Space | k | Seed ARI | Subsample ARI | Silhouette (null 95th) | AMI marker | AMI corpus |
|---|---|---|---|---|---|---|
| centred (registered space) | 8 | 1.00 | 0.98 | 0.061 (0.030) | 0.15 | 0.02 |
| centred | 16 | 0.70 | 0.69 | 0.059 (0.026) | 0.11 | 0.04 |
| residualised (corpus × year, length, marker removed) | 8 | 0.61 | 0.53 | 0.057 (0.030) | 0.01 | 0.02 |
| residualised | 16 | 0.70 | 0.68 | 0.059 (0.025) | 0.01 | 0.03 |
| conditioned (metadata joined as features) | 8 | 0.71 | 0.89 | 0.148 (0.075) | 0.74 | 0.38 |
| conditioned | 16 | 0.57 | 0.60 | 0.104 (0.069) | 0.56 | 0.35 |

- On the same vectors, K-means after PCA repeats far better than the pilot's UMAP + HDBSCAN.
  That comparison changes the method, not the features. The very stable k = 8 split follows
  partly which marker word occurs (AMI 0.15).
- With corpus × year, sentence length and marker regressed out, k = 16 repeats (seed ARI 0.70,
  subsample 0.68) and the clusters no longer follow the marker (AMI 0.01). The centred space at
  k = 16 repeats as well (0.70 and 0.69), so residualising removes the marker signal but adds no
  stability.
- The silhouette stays around 0.06, about twice the null but low in absolute terms. K-means can
  cut a continuous cloud the same way every time without the cloud having separate groups. So
  this is a reproducible partition, not evidence of distinct topics.
- Joining the metadata as features gives a higher silhouette, but the clusters then follow
  marker and corpus (AMI 0.74 and 0.38). That is the metadata, not topics, so this space is
  rejected.
- A next step, if wanted, would be a new and separately registered analysis on the residualised
  space: name the k = 16 clusters after review, then test their trends as the pilot specifies.

## Reproducing

```bash
# The cross-subject mart, in a copy of the warehouse
PORTFOLIO_DB=tmp/portfolio.duckdb dbt build --select +mart_municipality_year_cross_subject
PORTFOLIO_DB=tmp/portfolio.duckdb python -m ml.feature_study.municipal
python -m ml.feature_study.job_ads tmp/warehouse/raw/jobtech/cluster-corpus/2024 tmp/warehouse/raw/jobtech/cluster-corpus/2025
PORTFOLIO_FEATURES=<warehouse>/features python -m ml.feature_study.futures
python -m ml.feature_study.talk_vote
```

The job-ad corpus folders come from `warehouse_store.py pull --only raw --path
jobtech/cluster-corpus/<year>`. Each run fits in 1 GB on a laptop, so none needs
`cluster-jobs.yml`. The job-ad run is the slowest: 15 minutes for 2025 alone, longer for two
years, mostly in the employer bootstraps.
