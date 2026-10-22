# Three Swedens: pre-registration

Written 2026-10-22, before any distance, test or neighbour list was computed. It fixes the
question, data, method, seeds and decision rules of H4 (idea I-2) in roadmap item P1.4. The
commit that adds this file is the record. The code comes in later commits, and any departure
from this text is listed in the export's `method` block with its reason.

## Question

Are municipalities that are alike on social indicators also alike in the jobs they advertise
and in how they voted? Which municipalities have different neighbours in the three spaces?

This is a descriptive measurement. Every sentence says "municipalities where", never "people
who". No result is read as a cause.

## Units

A municipality is analysed when it is present in all three spaces and has a boundary. The
number dropped from each space is published with the result.

## Three spaces

- Social: the 12 indicators of `sweden/similarity/municipalities.json` (2024), for the
  municipalities SWEDEN C analysed (no missing value). Each indicator is standardised to mean 0
  and standard deviation 1 over the analysed municipalities. Distance: Euclidean. One indicator,
  Riksdag turnout, is electoral; it is kept, because it is part of the published social map,
  and the overlap is stated as a limit.
- Jobs: `gold.mart_job_ad_municipality_field`, distinct ads per municipality and occupation
  field (21 fields), pooled over 2023, 2024 and 2025. As in `labour-market-types`, a
  municipality needs at least 900 ads over the three years. Features: centred log-ratios (CLR)
  of the counts with 0.5 added to every count. Distance: Euclidean on the CLR values, which is
  the Aitchison distance.
- Votes: `gold.fct_election_municipality`, the 2022 Riksdag election, the shares of valid votes
  of S, SD, M, C, KD, V, L, MP and OTHER. Features: CLR of the vote counts with 0.5 added.
  Distance: Aitchison, as for jobs.
- Geography: the straight-line distance in kilometres between centroids, in SWEREF 99 TM
  (EPSG:3006) from `sweden/similarity/geometry.json`. A municipality's centroid is the area
  centroid of its largest ring, so islands do not pull it out to sea.

## Tests

For each of the three pairs (social and jobs, social and votes, jobs and votes):

- Mantel r: Pearson correlation between the upper triangles of the two distance matrices.
- Partial Mantel r: the same correlation after each triangle is regressed on geographic distance
  (Smouse, Long and Sokal 1986), so that "nearby municipalities are alike" is held constant.
- p: one-sided, from 9,999 permutations of the municipalities of the first matrix (rows and
  columns together), with the +1 rule: p = (1 + count of permuted r ≥ observed) / 10,000.
- Seed 20261022. Each pair starts its own generator from it.
- Spread: r on 1,000 subsamples of 80 % of the municipalities, drawn without replacement. The
  2.5 and 97.5 percentiles are published as a sensitivity range, not as a confidence interval.

A pair is reported as "agree" when its partial Mantel p is below 0.05 after Holm correction over
the three pairs, and as "no measurable agreement" otherwise. Raw and Holm-adjusted p are both
published. The size of r is described in numbers, not adjectives.

## Neighbours and misfits

- In each space, a municipality's 10 nearest neighbours by that space's distance, itself
  excluded. Ties are broken by municipality code.
- Agreement of a municipality: the mean of the three pairwise Jaccard indices of its neighbour
  sets.
- Misfits: the 20 municipalities with the lowest agreement, ties broken by code. For each, the
  export lists its three neighbour sets so a reader can check the result without colour.
- Reference: the expected Jaccard of two random 10-sets drawn from the other municipalities, so
  the reader can see how far each agreement is from chance.

## The municipality grouping (k = 4 against k = 2)

The site shows two groupings of the same 280 municipalities: k = 2 by the gap rule and k = 4 as
a finer split. This analysis settles which one the site uses.

- Input: the fit `export_similarity.py` uses (the standardised 12 indicators, PCA with 4
  components, k-means with 20 starts), for k = 2 and k = 4.
- Stability: bootstrap ARI, 200 rounds, rows drawn with replacement, refitted and compared on
  the drawn rows. Null: the same fit on data with each indicator permuted on its own, 200
  rounds, silhouette against the observed silhouette.
- A k qualifies when its mean bootstrap ARI is at least 0.75, its 5th percentile is at least
  0.6 and its null p is below 0.05.
- Rule: the site uses the qualifying k with the higher 5th percentile ARI; at equal values to
  three decimals, the smaller k. If neither qualifies, the site shows no grouping as a finding.
- The export also reports, for each k, how well the groups separate the jobs and votes spaces
  (silhouette of the k labels in those spaces). This is context and does not change the rule.

## Outputs

- `python -m ml.three_swedens` computes the matrices, tests, neighbours and the grouping check.
- Gold `mart_municipality_three_spaces`: one row per analysed municipality with its agreement,
  pairwise Jaccard values, misfit flag and group labels.
- `clusters/three-swedens.json`: method, diagnostics (Mantel r, partial r, p, n per pair),
  misfits, the grouping decision with its evidence, and `generated_at`.

## Limits

- Spatial autocorrelation can remain after the partial test, because a straight-line distance
  does not capture commuting regions or coastlines.
- Ads are counted where they are posted, not where people live. A municipality with few ads is
  dropped, which removes the smallest ones from the comparison.
- The three spaces use different years: 2024 indicators, 2023-2025 ads and the 2022 election.
- Mantel tests on distance matrices have lower power than tests on the raw data, and r on
  distances is not the same as a correlation between variables.
