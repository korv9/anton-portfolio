# Clustering batches 0-2: results

Code: `platform/publish/clusters/`. Statuses come from `stats.diagnostics`:

- `counter_example`: the mean bootstrap ARI is under 0.6, or the same fit on two periods agrees at an ARI under 0.6.
- `descriptive`: fewer than 50 units.
- `unvalidated`: there is no stability check.

`three-swedens.json` in the same folder comes from `ml/three_swedens.py` and is documented in [sweden-three-spaces-preregistration.md](sweden-three-spaces-preregistration.md).

Only `finding` may be posted as a finding. Every k is picked by silhouette over 2-8 (2-10 for the labour-market types). The pick is flagged when it sits at an end of the sweep or when the runner-up is within 0.005.

## Fits of 2026-10-22, after review round 2 of PR #94

The fits ran again on 2026-10-22 after review round 2, against the restored warehouse (CI build of 2026-10-20 plus the job-ad aggregates in R2). Every number below matches the round-1 fit log, and the files in `frontend/public/data/clusters/` now hold these runs. The riksdag eras now sweep 2-8 eras as well; the largest merge-cost jump is still at 6.

| Clustering | n | k | ARI mean (p05) | Null p | Period ARI | Status |
|---|---|---|---|---|---|---|
| debate-topics | 33,023 | 33 | 0.68 (0.59), seed agreement | 0.003 | | finding |
| session-maps | 13,200 | 25 | none | none | | unvalidated |
| talk-vote | 33 sessions | 3 | 0.44 (0.23) | 0.81 | | counter_example |
| riksdag-eras | 33 | 6 | 0.63 (0.44) | 0.001 | | descriptive |
| tax-mix | 38 | 2 | 0.50 (-0.04) | 0.025 | | counter_example |
| field-language | 21 | 2 | 0.85 (-0.07) | 0.005 | 0.49 (2010-16 vs 2019-25) | counter_example |
| labour-market-types | 255 | 2 | 0.50 (-0.01) | 0.35 | 0.21 (2023 vs 2025) | counter_example |
| demand-curves, trend | 200 | 2 | 0.80 (0.59) | 0.005 | | finding |
| demand-curves, season | 200 | 2 | 0.50 (0.21) | 0.005 | | counter_example |
| municipal-trajectories | 290 | 2 | 0.83 (0.15) | 0.005 | | finding (level groups) |
| municipal states | 4,350 | 2 | 0.71 (0.24) | 0.005 | | finding |

Every k above that comes from a silhouette sweep is 2, the low end of the sweep, and is flagged. The trajectory silhouette beats the year-shuffle null's 95th percentile by only 0.008, and that null keeps each municipality's levels, so the groups are published as level groups. In the labour-market types, Ward agrees with K-means at ARI 0.87 and the co-clustering at 0.55; the gap statistic picks k = 5. Of all ads, 2.5 % name no municipality. In seven group-months JobTech files Kundtjänstpersonal, Banktjänstemän or Barnskötare under a second field, so each occupation group keeps the field with the most ads over the whole period.
