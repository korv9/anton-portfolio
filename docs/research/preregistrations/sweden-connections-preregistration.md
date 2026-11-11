# SWEDEN Connections: pre-registration of candidates 3.1 and 3.2

Written 2026-10-21, before either analysis was run. It fixes the question, data, method, seeds,
decision rule and limits of candidates 3.1 and 3.2 in
[sweden-statistical-research-plan.md](sweden-statistical-research-plan.md) (section 3, step 5).
The commit that adds this file is the record: the code that computes them comes in a later
commit, and any departure from this text is listed in the export's `method` block with its
reason.

Shared by both analyses:

- Source: `gold.mart_municipality_year_cross_subject` and `gold.fct_municipal_similarity`, read
  by `platform/publish/sweden/export_connections.py`. Nothing is read from published JSON.
- Rates as SWEDEN D publishes them: physical visits per inhabitant and staffed service points
  per 10,000 inhabitants, both over D's `library_population`. A value D set to missing stays
  missing; it is not restored.
- County is the first two digits of the municipality code.
- Seed 20261021. Each analysis starts its own generator from it, so the order of computation
  does not change a result.
- Assessment labels are the page's existing ones: `robust`, `uncertain`, `not_supported`.
  Holm-adjusted p-values are published beside the raw ones and never decide a label on their
  own.
- Every sentence says "municipalities where", never "people who".

## 3.1 Matched-neighbour comparison (C × D)

- Question: Among municipalities that SWEDEN C finds socially alike, how much do library use
  and library supply differ?
- Data: the 280 municipalities C analysed in 2024 and their five nearest neighbours. The
  neighbours follow `export_similarity.py`: Euclidean distance over the 12 indicators of
  `gold.fct_municipal_similarity`, each standardised over the 280. Library rates for 2024.
- Measure: for each municipality, the log ratio of its own rate to the median rate of those of
  its five neighbours that have a value. A municipality needs its own value and at least three
  neighbour values; the others are counted as missing. Two measures: visits per inhabitant and
  service points per 10,000.
- Summary: the median absolute log ratio, and the share of municipalities whose rate is more
  than 1.5 times, or less than 1/1.5 times, their neighbours' median.
- Reference: each neighbour set replaced by five municipalities drawn without replacement from
  the same SKR group (excluding the municipality itself), 999 rounds. The reference shows how
  alike municipalities of one SKR type are without C's matching.
- Decision rule, per measure: `robust` if the observed median absolute log ratio is below the
  reference's 2.5th percentile (C's neighbours are more alike than SKR peers); `uncertain` if it
  is below the reference median but not below the 2.5th percentile; `not_supported` otherwise.
  One-sided permutation p = (1 + rounds at or below observed) / 1,000. The family is the two
  measures; Holm over the two.
- Sensitivity, pre-stated: the same comparison with 2019 library rates against the 2024
  neighbours. The neighbour variants of plan section 2.3 belong to SWEDEN C's step and are not
  part of this run.
- Evidence class: descriptive comparison.
- What cannot be concluded: that library provision causes use; anything about residents. A
  municipality far from its neighbours may host a regional library, a university or a tourist
  season, and the 12 indicators do not cover those. Door counters differ between
  municipalities.

## 3.2 Within-municipality change (C panel × D)

- Question: Did library visits fall more in municipalities where population fell or median
  earned income fell?
- Data: library visits from D, population and median earned income (Kolada N00906) from the
  municipal panel, in 2014, 2019 and 2024. Two periods: 2014→2019 and 2019→2024, kept apart
  because the pandemic falls in the second.
- Departure from the plan: the plan also names the dependency ratio. The yearly panel has no
  dependency ratio (only C's 2024 Kolada inputs do), so ageing is not tested. No new data is
  fetched for it.
- Model, per period: least squares of Δ ln visits on Δ ln population and Δ ln median earned
  income, with an intercept, over the municipalities that have all three values at both ends
  of the period (paired panel).
- Intervals: 95 % percentile county-cluster bootstrap of each coefficient, 2,000 resamples of
  the 21 counties.
- Permutation: the outcome vector shuffled across municipalities, 4,999 rounds; two-sided p per
  coefficient = (1 + rounds with |β*| ≥ |β|) / 5,000. The family is two coefficients × two
  periods = four tests; Holm over the four.
- Decision rule: `robust` if at least one coefficient's interval excludes zero in both periods
  with the same sign; `not_supported` if every interval includes zero; `uncertain` otherwise.
- Sensitivity, pre-stated: the balanced panel (municipalities with visits in every year
  2014–2024) beside the paired one. The 13 values D repaired cannot be restored: 12 are zero
  visits, which have no logarithm.
- Evidence class: exploratory statistical relationship. It becomes a validated relationship
  only if this specification is committed before the first run and 2025→2026 data confirms it
  later.
- What cannot be concluded: a causal effect of demographic or income change on library use.
  Shrinking municipalities may close branches first, so the ordering can run the other way.
  Library reorganisation, changed counting methods and merged service points are not
  controlled.
