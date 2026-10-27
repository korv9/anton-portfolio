# SWEDEN statistical research plan

Statistical audit, 2026-10-21, of `origin/main` at `4cf7d191` (after PR #77, the SWEDEN repairs,
and PR #78, the medallion hardening). Nothing here changes code, data or published findings. It
followed two Phase 0 documents (the alignment audit and the research roadmap, both removed on
2026-10-23; see Git history) and only repeats their findings where the repairs left something
open.

Status, 2026-10-23: implemented in 3c185c71, 036861e0, 44d272f0 and eda71f5e. The method
conventions from section 5 now live in [sweden-design.md](sweden-design.md#statistical-conventions).
This plan is kept because [the connections pre-registration](sweden-connections-preregistration.md)
cites it.

The question throughout is what the data can legitimately show, and where the statistical
representation and the social reality part ways.

## Evidence and provenance

| Tag | Meaning |
|---|---|
| [pub] | Read from a committed file under `frontend/public/data/sweden/`. |
| [src] | Read from the cited source line at `4cf7d191`. |
| [b] | `tmp/b_check.py` over `language/trends.json`. |
| [cx] | `tmp/cx_check.py` over `similarity/*.json` and `connections/connections.json`. Seeds 20261021, 7, 11; log in `tmp/cx_check.log`. |
| [d] | `tmp/d_check.py` over `belonging/municipalities.json`; log in `tmp/d_check.log`. |
| [e] | `tmp/e_check.py` over `futures/trends.json`; log in `tmp/e_check.log`. |
| [wh] | Read-only DuckDB queries over the shared warehouse: `warehouse/cluster_lab/public-topics-2026-10-12/sources/mart_municipality_year_panel.parquet` and `warehouse/features/sweden/futures_theses/*.parquet`. |

The scripts live in this worktree's ignored `tmp/` and read committed JSON with numpy, scipy and
scikit-learn already installed. The shared `warehouse/portfolio.duckdb` is a 7.6 MB file without
the SWEDEN gold schemas, so no gold mart was queried. The Graphify graph sits in a sibling
worktree and returned no SWEDEN nodes; source lookup was targeted.

Each proposal is marked with what it needs:

- supported: the repository already has the data and most of the code
- verify: something has to be checked before the analysis is trusted
- new data: an ingestion or recount the repository does not yet do

## 1. Statistical audit of existing published findings

### A. Politics of Measurement

| Item | Finding |
|---|---|
| Question | How SCB's table catalogue and Kolada's KPI catalogue distribute over 13 research domains. |
| Unit, n | One SCB table (4,270) or one Kolada KPI (5,860); 10,130 rows in `measurement/items.json` [pub]. These are different units, so one table is not one indicator. |
| Method | Single-label mapping by SCB subject code and Kolada operating area (`platform/seeds/sweden/*.csv`), then counts. Descriptive. |
| Repairs held | Claims are now limited to SCB (`products.ts:72`); spirituality's zero is described as structural (`Measurement.tsx:166`, `:595`). |
| Open: classification artefact | Kolada's trust KPI U01413 ("avsaknad av tillit till andra") and mental well-being KPI U01473 sit in `health`, because the mapping follows the Kolada area "Hälso- och sjukvård" [pub, `items.json`]. Kolada therefore shows 0 KPIs for `wellbeing` and for `social_relationships` [pub, `summary.json`], while the same platform uses those two KPIs as municipal well-being and trust measures (`platform/models/gold/welfare/serving/mart_municipality_year_panel.sql:9-10`). A keyword pass finds 16 Kolada items matching well-being terms (8 in health, 8 in economy) and 22 Kolada library KPIs in culture [own query over `items.json`]. The zeros and the health count both depend on the mapping. |
| Open: Porter verdict | `Measurement.tsx:577` prints `supports` whenever economy or employment has the most SCB tables and the most sub-annual tables. No other result is possible for a national statistics office, so the check cannot fail and tests nothing. |
| Ecological or causal risk | Low. The page already says that a count shows availability, not importance (`Measurement.tsx:6-8`). |
| Evidence class | Descriptive. Correctly labelled. |

### B. The Ideal Human

| Item | Finding |
|---|---|
| Question | How the vocabulary of personal traits in Swedish job ads changed, 2006–2026. |
| Unit, n | Distinct ad text per archive; 23 archives, 8,736,050 distinct texts [pub, `language/coverage.json`]. Near-census, so sampling error is negligible. Measurement error (lexicon, denominator, composition) dominates. |
| Method | Regex lexicon of nine categories (`platform/seeds/sweden_language/ad_language_terms.csv`); matches per 1,000 words with the occupation-field mix fixed at its pooled share; single least-squares break. |
| Repairs held | Changes now end at the last complete year (2025); verdicts must agree across baselines 2008, 2010 and 2012 (`languageChange.ts:15-22`); the 2020–23 field labels are crosswalked (`occupation_field_crosswalk.csv`). |
| Open: denominator decides the sign | Ads grew from 177 words (2008) to 445 (2025) [b]. Every category is used by a larger share of ads (competence +29 %, passion +245 %, stress +42 %, mix fixed), and six of nine fall per 1,000 words [b]. Per-word normalisation assumes mentions grow in proportion to length. A requirement that is stated once per ad, such as a degree or a driving licence, breaks that assumption. Neither denominator is neutral. |
| Open: human-capital verdict | Competence per 1,000 words changes by −17.1 %, −18.6 % and −12.4 % from the three baselines [b], so `Language.tsx:631` returns `challenges`. In share-of-ads terms the same category rises 29 %. The verdict follows from the choice of denominator. |
| Open: personal mean | The mean personal change is +12.6 %, +4.5 % and +3.3 % by baseline; without passion it is −1.5 %, −5.0 % and −3.6 % [b]. One category carries the result. The published verdict comes out `undetermined`, which is correct. `passion` still contains `engage\w*` (`ad_language_terms.csv`), which was 75 % of passion matches in a 2025 shard [alignment doc, B `q5.py`]. |
| Open: breaks | See E. A best single split of a straight line explains 75.2 % of its variance [e]; competence's published 0.772 is at that level. |
| Composition | Occupation field (21 groups) is fixed. Employer, staffing-agency share, SSYK-4 occupation and ad platform are not. County is null 2006–2019. |
| Evidence class | Descriptive. Correct, though the verdicts read as tests of theory. |

### C. The Invisible Sweden

| Item | Finding |
|---|---|
| Question | Which municipalities are socially similar despite distance. |
| Unit, n | Municipality; 280 of 290 analysed, 10 excluded for a missing indicator [pub]. |
| Method | 12 standardised indicators; Euclidean nearest neighbours in 12-D; PCA to 4 components; K-means k = 2 (gap rule) and k = 4 shown. |
| Repairs held | Random-partner baseline and 1,000 profile permutations: 72 of 280 nearest neighbours share a county against 20.5 expected, 0 of 1,000 shuffles reach it [pub, `municipalities.json` `summary.county_null`]. Turnout carries its 2022 reference year. The source line credits own processing. |
| Open: wrong null for clusters | The published silhouette null shuffles each column independently (`groups.json` `permutation.note`). That removes the correlation between indicators, and PC1 alone holds 40 % of the variance [pub]. The test therefore asks whether the indicators correlate, which is already known. A Gaussian null with the observed covariance is stricter. Its 95th percentile is 0.287 for k = 2 and 0.240 for k = 4, against 0.192 and 0.201 for the column shuffle. The observed 0.352 and 0.274 still exceed every Gaussian draw (100 each) [cx]. The page's wording, "a weak structure", holds; the null it cites is too lenient. Skewed marginals could still produce the excess, so a Gaussian-copula null with empirical marginals is the next check. |
| Open: centre–periphery verdict | `Similarity.tsx:590-592` prints `supports` for "Social conditions follow distance to the big cities" from a same-county test. The test shows spatial clustering. It does not measure distance to a city, as the limits text at `:601` says itself. |
| Open: SKR verdict | `Similarity.tsx:611-612` prints `challenges` when AMI < 0.5. The threshold is arbitrary. Four groups against SKR's nine types caps the attainable AMI, and log population and commuting feed both partitions. |
| Feature leakage | Population and commuting are inputs to the clustering and to SKR's typology, so agreement with SKR is partly circular. No outcome outside the 12 indicators has been compared with the groups yet. |
| Reproducibility | Run `public-consensus-2026-10-13` with hash-pinned sources [pub, `groups.json` provenance]; `run_id` and `code_sha` are null. |
| Evidence class | Exploratory. Correct. |

### D. Infrastructure of Belonging

| Item | Finding |
|---|---|
| Question | Where people can take part in collective life without consuming; measured through public libraries. |
| Unit, n | Municipality-year, 2014–2025, 3,446 rows [pub]. Balanced panels: service points 271, visits 216 municipalities [pub, `belonging/coverage.json`]. |
| Repairs held | 12 zero-visit rows, one zero-service-point row and 6 partial organisation sums set to missing and counted [pub]. The Putnam/Habermas verdict is now `undetermined` (`Belonging.tsx:688`). |
| Open: the decline is mostly the pandemic | In the 216-municipality balanced panel, visits go 53.77 M (2014), 50.01 M (2019), 25.08 M (2021), 40.36 M (2025) [d]. Paired change 2014→2019 is −6.7 % (n 262) and 2019→2025 −19.3 % (n 265) [d]. The headline at `Belonging.tsx:287` puts the 12 % fall in service points and the 25 % fall in visits in one sentence, which invites the reader to link them. Within municipalities, those that lost a service point 2014→2019 had a median log visit change of −0.089 against −0.085 for the rest; Spearman ρ between the change in service points and the change in log visits is 0.079 [d]. |
| Open: "use follows supply" | Cross-sectional ρ between service points per 10,000 and visits per inhabitant is 0.145 (2025, n 281) and 0.21 (2019) [d]. With log population partialled out it is 0.03 and 0.06 [d]. Service points per inhabitant correlate −0.67 with log population [d], so the association is population size. The reading at `Belonging.tsx:699-710` also says "more people visit them", but a visit is an event at a door counter, not a person. |
| Concepts | Availability (service points), accessibility (distance, hours), use (visits, loans), participation (active borrowers, activities) and belonging (not measured) are separate. Only the first and third are on the page. Visits include commuters and visitors from other municipalities. |
| Evidence class | Descriptive. Correct. |

### E. The Lost Futures

| Item | Finding |
|---|---|
| Question | How often the Riksdag speaks of the future and with which themes; DiVA thesis abstracts as a second corpus. |
| Unit, n | Speech; 32 calendar years 1994–2025 [pub, `futures/trends.json`]. DiVA: abstracts deduplicated to each record's latest month (`int_sweden_future_theses_latest.sql`); 720,979 record-months for 444,894 records in the feature files [wh]. |
| Repairs held | Session 1999/2000 counted, running year 2026 dropped, words per speech published, DiVA Swedish-only and deduplicated. |
| Open: length | Future share against words per speech: ρ 0.826 in levels and 0.565 in first differences (n 31) [e]. The length link survives detrending, so it is a real confounder and not only a shared trend. `marker_per_1000_words` is still null in every row [pub], so the per-word rate promised by `export_futures.py:8-9` does not exist yet. |
| Open: break statistic | The break reported per theme is the best two-mean split. A pure linear trend gives 0.751 of variance explained at n = 32, and a random walk reaches 0.70 or more in 37.7 % of 2,000 runs [e]. Published values: security 0.739, culture 0.759, alternatives 0.729 [pub]. None of them is distinguishable from a smooth trend or a random walk. Lag-1 autocorrelation of the yearly series runs from 0.32 to 0.88 [e]. FuturesExplore labels it "Most likely single break" (`FuturesExplore.tsx:199`), which implies a probability model that is not there. |
| Open: lexicon vintage | The `alternatives` theme is a list of named proposals: löntagarfonder, sextimmars arbetsdag, medborgarlön, basinkomst, kooperativ (`trends.json` pattern). Yearly counts of future speeches with the theme fall from 76 (1994) to 9–18 (2022–2025) [pub]. That records the end of specific 1990s debates. Alternatives phrased in today's terms (four-day week, degrowth) do not match. "Faded from the chamber's future talk" (`Futures.tsx:192`) reads as a statement about imagination. |
| Open: theme polysemy | `security` contains `trygghet\w*` (welfare security, trygghetssystem) and `stabilitet\w*` (financial stability) beside `försvar\w*` and `gängkriminalitet\w*`. `technology` contains `forskning\w*`; `culture` contains `bibliotek\w*` and every `kultur\w*` compound. The securitisation verdict (`Futures.tsx:556-559`) needs the sub-terms apart. |
| Open: DiVA jump | DiVA future share is 0.121–0.137 for 2015–2023, then 0.162 (2024) and 0.188 (2025) [wh]. Median abstract length stays at 226–234 words, and the rise appears in every length quartile (lowest quartile 0.079 in 2023, 0.143 in 2025) [wh]. Length does not explain it. Candidates to check: generated or template text after 2022, the "framtida forskning" convention matching `framtid\w*`, and changes in which institutions deposit. |
| Evidence class | Descriptive. Correct. |

### Connections

| Item | Finding |
|---|---|
| Relationships | Visits per inhabitant against post-secondary share, and against median earned income, 2024; service points per 10,000 against log population (marked trivial) [pub]. Two joins rejected with reasons (B×E, speeches×theses). |
| Unit, n, missing | Municipality; n 280 for the two visit relationships. The 10 missing are not C's 10 exclusions. They are municipalities without 2024 visits, including Upplands Väsby, Haninge and Upplands-Bro [cx]. That missingness is unlikely to be random: three of ten are Stockholm suburbs. The docstring calls the panel "SWEDEN C's municipalities" (`export_connections.py:69`) while it keeps all 290. |
| Method | Spearman ρ, iid percentile bootstrap (2,000, seed 20261020), partial ρ after removing rank of log population from both ranks (`export_connections.py:55-65`). |
| Results reproduce | ρ 0.005 and 0.102; partial 0.203 and 0.180 [cx]. |
| Suppression | The raw association is about zero. The partial exists because post-secondary share correlates 0.75 with log population and visits per inhabitant −0.17 [cx]. The finding is conditional on a linear adjustment in ranks. |
| Uncertainty not shown | No interval is published for the partial ρ. Recomputed: iid bootstrap [0.072, 0.328] for education and [0.060, 0.293] for income; county-cluster bootstrap [0.000, 0.354] and [0.038, 0.302] [cx]. Residual permutation p, unadjusted, 0.0006 and 0.0018 [cx]. Moran's I (6 nearest neighbours) of the visit rate is −0.021 and of its partial residual −0.013, so spatial dependence in the outcome is small; education and income have I 0.56 and 0.54 [cx]. |
| Two tests, one question | Partialling income out of the education relationship lowers it to 0.125; education out of income lowers it to 0.083 [cx]. They are one socioeconomic gradient counted twice, not two findings. Adding in- and out-commuting moves them little (0.189, 0.165) [cx]. |
| Multiple comparisons | The page says "several relationships are tested; none is called significant" (`export_connections.py:191`). That avoids false claims, but it is not a correction. The `assessment` rule (`:165-166`) mixes the interval for raw ρ with the point estimate of partial ρ against a fixed 0.1, and both relationships come out `uncertain` although the partials are the better-supported quantity. With Holm over the two, both partials stay below 0.01. The family the rule should cover is every relationship ever considered for the page, and nothing records that family. |
| Pre-specification | `Connections.tsx:107` says each relationship "was defined before it was computed". The export and the first `connections.json` were added in the same commit, `8f7dbcb5`. No dated specification exists, so the claim cannot be checked. |
| Trivial pair | The partial ρ of service points per 10,000 against log population, with log population held constant, is 0.015 by construction [pub]. Publishing it adds nothing. |
| Tests | No pytest covers `export_connections.py` (no test file references it). |
| Evidence class | Exploratory. Correct. No causal language found. |

## 2. The five highest-value new analyses

Ordered by research value against cost. All five use data the repository already holds or
already knows how to fetch.

### 2.1 E: separate length from theme, and test breaks against a trend null

- Question: Does future talk, and does each theme, change once speech length and smooth
  trend are accounted for?
- Method: (1) Store marker and theme matches per speech so a per-1,000-word rate exists. (2)
  Report shares within fixed length bands (quartiles of 1994–2025 speech length), so a year is
  compared with itself at equal length. (3) Replace the two-mean split with a linear trend plus one
  break, scored against a null of an AR(1) process around a linear trend fitted to the same series.
  Fit by least squares and use a parametric bootstrap of 999 series (seed fixed). Report the break
  year only when the improvement over trend exceeds the null's 95th percentile. Treat the nine
  themes as one family with Holm. (4) Split `security` into defence and crime, welfare security
  and stability, and `culture` into arts and heritage, libraries and other compounds. Report each
  sub-term's yearly count.
- Supported: the series in `trends.json`, `one_break` in `export_language.py:46`, the
  theme patterns.
- Verify: sub-term counts need the recount; parties.json uses the same denominators.
- New data: a recount of the 32 Riksdag sessions from the archives (the source exists;
  `futures_language.py` needs per-speech match counts).
- What cannot be concluded: frequency does not measure imagination or intent. The Riksdag
  is one genre.

### 2.2 B: denominators, sub-lexicons and composition

- Question: Which changes in job-ad language survive the choice of denominator, the split of
  broad term families, and a change in who advertises?
- Method: (1) Publish three measures side by side: share of texts, matches per 1,000 words,
  and share of texts within fixed length bands (2010 quartiles). Call a change stable only when
  all three agree in sign. (2) Split `passion` into `engag*` and passion/brinner/entusiasm, and
  `identity` into the recruitment formulas ("personlig lämplighet", "personliga egenskaper") and
  the rest. (3) Shift-share decomposition per category: total change = within-field change +
  field-mix change, at the 21-field level, then at SSYK-4 where taxonomy ids exist (2023+). (4)
  A staffing-agency indicator from employer name for 2023+, with the change computed with and
  without agencies. (5) Manual validation: 50 matches per category and period, coded by two
  readers, with precision and Cohen's κ.
- Supported: `fields.json` cells, the trends mart, the crosswalk, the JobTech taxonomy cache.
- Verify: whether SSYK-4 and employer fields exist in the 2006–2019 archives; the
  agency rule's precision on a sample.
- New data: a re-stream of the 23 archives to store length bands and sub-lexicon counts.
- What cannot be concluded: how employers select, how work feels, or anything about
  individual workers.

### 2.3 C: sensitivity of neighbours and groups, plus an outcome outside the model

- Question: How much of the similarity map is the definition, and do the groups separate
  anything they were not built from?
- Method: (1) Neighbour stability: Jaccard overlap of each municipality's five neighbours
  under five variants (all 12 features; without log population; without the commuting pair; PCA-4
  space; Mahalanobis distance). Report the median and the share of municipalities whose first
  neighbour changes. (2) Cluster null: Gaussian copula with the observed rank correlation and
  empirical marginals, 200 draws, seed fixed; silhouette and gap per k. (3) Temporal stability:
  rerun on 2020–2023 and report ARI against 2024 for k = 2 and k = 4. (4) Out-of-model outcomes:
  2022 party shares (already in `mart_municipality_year_cross_subject`) and the 2024 library
  rates. Report the share of variance explained by group with a permutation null over
  municipalities. Use only variables not among the 12 inputs.
- Supported: the 280 × 12 matrix in `similarity/municipalities.json`, `ml/research/regions.py`,
  the panel parquet, the election and library columns of the cross-subject mart.
- Verify: 2018 and 2019 lack employment, so the window is 2020–2024; turnout repeats an
  election year.
- New data: none.
- What cannot be concluded: the groups are constructions of 12 municipal averages. They do
  not describe residents.

### 2.4 D: what changed after 2019, and where

- Question: Is the fall in library visits a slow loss of supply, or a pandemic break that
  has not recovered, and does it differ by municipality type?
- Method: (1) The balanced visits panel (216), with 2014–2019 and 2019–2025 reported apart.
  (2) Recovery ratio per municipality, 2025 visits / 2019 visits, by SKR group, with bootstrap
  intervals for each group's median. (3) A two-way fixed-effects model of log visits on service
  points, with municipality and year effects, as a description of within-municipality covariation.
  Report it with county-clustered standard errors. (4) Missing-data sensitivity: every change
  computed on the balanced panel, on all paired municipalities, and with the 13 repaired zeros
  restored, so the effect of each choice is visible.
- Supported: `belonging/municipalities.json`, SKR groups in `similarity/municipalities.json`.
- Verify: whether door-counter methods changed in 2020–2022 (KB documentation);
  whether staffless (meröppet) hours move visits between categories.
- New data: bibstat opening-hour terms (Open101–106, Open201–206) to add accessibility.
  Same API, small.
- What cannot be concluded: belonging, loneliness or civic participation. Visits are door
  counts, and they include people from other municipalities.

### 2.5 A: classification sensitivity and the "measured elsewhere" check

- Question: How much do domain counts depend on the mapping, and which thin domains are thin
  only in these two catalogues?
- Method: (1) A second, multi-label classification by title keywords, with a seed per domain,
  for every item. Publish the count under both mappings and the share of items that change
  domain. (2) Count measures, not tables, from the SCB metadata already fetched for 1,299
  tables. (3) For each domain, list which other agencies publish municipal statistics on it,
  from catalogue metadata only, as a presence/absence table with its source. (4) Split
  `is_current` into ongoing series and projections (`mart_sweden_measurement_items.sql:50`).
- Supported: `items.json`, the seeds, the SCB metadata on disk.
- Verify: Socialstyrelsen and Folkhälsomyndigheten catalogue licences before ingesting.
- New data: those catalogues, metadata only.
- What cannot be concluded: absence from an indexed catalogue is not absence from society
  or from statistics.

## 3. The three strongest Connections candidates

### 3.1 C×D matched-neighbour comparison

- Question: Among municipalities that C finds socially alike, how much do library supply and
  use differ?
- Why it matters: It answers C's stated link ("access to meeting places within each
  similarity group", `products.ts:92`) without a correlation across very different places.
- Data and keys: `similarity/municipalities.json` neighbours (five per municipality,
  2024 inputs) joined on municipality code to `belonging/municipalities.json`, 2024. 280
  municipalities with neighbours; visits exist for 280 of 290 in 2024.
- Method: For each municipality, the difference between its visits per inhabitant and the
  median of its five neighbours, and the same for service points per 10,000. Report the
  distribution, the share of municipalities more than 50 % above or below their neighbours, and a
  permutation reference that replaces each neighbour set with five random municipalities of the
  same SKR group (999 rounds, seed fixed).
- Confounders: Matching covers the 12 indicators. It does not cover tourism, students,
  commuting into a regional centre, or counting methods.
- Sensitivity: Neighbour sets from the variants in 2.3; 2019 instead of 2024 for the library
  values.
- Alternatives: A municipality far above its neighbours may host a regional library, a
  university or a tourist season.
- Cannot conclude: Whether provision causes use, or anything about residents.
- Classification: Descriptive comparison.
- Status: Supported. No new data.

### 3.2 C panel × D: within-municipality change, 2014–2019 and 2019–2024

- Question: Did library visits fall more where population fell, aged or lost income?
- Why it matters: Change within the same municipality removes every fixed difference between
  places, which is the main confounder of the current cross-section.
- Data and keys: `belonging/municipalities.json` (2014–2025) and the municipal panel
  (`mart_municipality_year_panel`: population, income, unemployment, dependency ratio, yearly
  1998–2025 [wh]) on municipality code and year.
- Method: Log change in visits against log change in population, change in median income
  and change in dependency ratio, as one pre-registered model per period. Report coefficients with
  county-clustered intervals and a permutation of change vectors across municipalities. Three
  coefficients in two periods form one family; correct it with Holm.
- Confounders: Library reorganisation, counting changes, the pandemic (hence the split
  periods), merged service points.
- Sensitivity: Balanced against paired municipalities; with and without the 13 repaired rows;
  Theil–Sen slopes beside least squares.
- Alternatives: Shrinking municipalities may close branches first; reverse ordering cannot be
  excluded.
- Cannot conclude: Causal effects of demographic change on library use.
- Classification: Exploratory statistical relationship. It can become a validated relationship
  only if the specification is committed before the first run and a later year (2026 data)
  confirms it out of sample.
- Status: Supported (both panels exist). Verify that population in D comes from the same
  panel (`belonging/coverage.json` says `gold.mart_municipality_year_panel`).

### 3.3 C×D cross-section, re-specified as one model

- Question: After population size, is there a socioeconomic gradient in library visits?
- Why it matters: It is the current Connections result, and its honest form is one modest
  conditional association, not two uncertain ones.
- Data and keys: As today: `mart_municipality_year_cross_subject`, 2024, n 280.
- Method: One rank regression of visits per inhabitant on log population, post-secondary share,
  income, in-commuting and out-commuting, all in ranks. Report each coefficient and the partial ρ
  with a county-cluster bootstrap interval. Report the result for 2019 and 2024 next to each other,
  and test the missingness: compare the 10 municipalities without visits with the rest on the 12
  C indicators.
- Confounders: Regional centres drawing visitors, students, door-counter quality.
- Sensitivity: Without the 5 % largest municipalities (partial 0.193 and 0.209 today [cx]);
  with visits per active borrower instead of per inhabitant.
- Alternatives: Education and income are one gradient: controlling for either lowers the other to 0.08–0.13 [cx].
- Cannot conclude: That education makes people visit libraries; individual behaviour
  (ecological fallacy); causality in either direction.
- Classification: Exploratory statistical relationship today. With pre-specification and the
  2019 replication it would be the platform's first validated statistical relationship.
- Status: Supported.

### Other candidates, classified

| Pair | Classification | Reason |
|---|---|---|
| D × trust or well-being (Kolada U01413, U01473) | Unsupported before 2022; interpretive hypothesis after | Before 2022 the municipal panel holds 19–23 distinct trust values a year, integers from 14 to 41, for 168–219 municipalities [wh]. That is close to one value per county, so a municipal correlation would count county values many times. 2022 and 2024 have 177 and 143 distinct values for 268 and 237 municipalities [wh]. Survey estimates with small samples and non-random suppression; show side by side, never correlate, until the survey's own margins of error are known. |
| B×E | Unsupported | Two genres, national yearly series, both length-confounded; rejection stands. |
| A×E | Untestable today | No documented mapping between E's nine themes and A's 13 domains. |
| A×D, A×C | Descriptive comparison | Prose only: culture is 6 SCB tables while library statistics come from KB; A's 586 municipal tables are the pool for C's feature variants. |
| Riksdag × DiVA | Descriptive comparison | Direction of lines only, never pooled, as the page does now. |

## 4. Misleading or unsupported claims

| # | Location | Published text | Problem | Suggested wording |
|---|---|---|---|---|
| 1 | `frontend/src/sweden/Connections.tsx:107` | "Each relationship below was defined before it was computed" | No dated specification; code and results share commit `8f7dbcb5`. | "Each relationship below is stated with its geography, year and denominator. The set was chosen by the authors and is not pre-registered." |
| 2 | `Connections.tsx:174-177` | "Population held constant: ρ = 0.20" | Ranks are adjusted linearly, without an interval. | "After removing the linear trend in population rank: ρ = 0.20 [interval]". Publish the partial interval. |
| 3 | `platform/publish/sweden/export_connections.py:165-166` | assessment `uncertain` for both | The rule mixes raw-ρ intervals with partial-ρ points against a fixed 0.1. | Classify on the partial ρ and its interval; state the family and its correction. |
| 4 | `export_connections.py:151-152` | Two questions: "Cultural capital" and "Economic capital" | One gradient counted twice. | Merge into one relationship (3.3). |
| 5 | `frontend/src/sweden/products.ts:38` | "civic life the fewest items across SCB and Kolada; D builds the missing geography of meeting places" | Kolada's trust KPI is classed as health, so the Kolada zero is the mapping; library statistics exist at KB and in 22 Kolada KPIs. | "civil society has few items in SCB and none in Kolada's classification; D maps public libraries from KB's statistics." |
| 6 | `products.ts:156` | X: "Political and academic themes compared over time." | Connections rejects that join; the comparison lives on E's page. | "The Riksdag and thesis abstracts are shown apart on E's page, never joined." |
| 7 | `frontend/src/sweden/Measurement.tsx:228` | "Health looks unmeasured in SCB's catalogue" | 7 tables is few, not none; Kolada's health count includes trust and well-being KPIs. | "SCB's database has 7 health tables and Kolada 932 health key figures, some of them survey measures of trust and well-being." |
| 8 | `Measurement.tsx:577` | Porter verdict `supports` | The check cannot fail. | `undetermined`, with "Consistent with the reading; the catalogue cannot test it." |
| 9 | `frontend/src/sweden/Language.tsx:252-253` | "Per word, some expectations became rarer: …" | True per word; every category rose as a share of ads. | Add: "As a share of ads, every category rose; ads grew from 177 to 445 words." |
| 10 | `Language.tsx:631`, `:645-650` | Human capital verdict `challenges` | Sign depends on the denominator. | `undetermined` unless share, per-word and length-band measures agree. |
| 11 | `Language.tsx:621` | "a change within ±10 % is read as no change" | Arbitrary threshold, unweighted mean of ratios. | Keep as a stated convention, add the leave-one-category-out range. |
| 12 | `frontend/src/sweden/Similarity.tsx:590-592` | Centre and periphery `supports` | Tests spatial clustering, not distance to cities. | Rename the reading "Spatial clustering", or keep the theory and return `undetermined`. |
| 13 | `Similarity.tsx:611-612` | SKR `challenges` at AMI < 0.5 | Arbitrary threshold; resolution mismatch; partly circular. | `undetermined`, with AMI and its permutation reference. |
| 14 | `Similarity.tsx:270`, `groups.json` | "against 0.20 for shuffled data" | Column shuffle is a lenient null. | Cite the Gaussian or copula null (0.24 for k = 4 [cx]) once it is in the export. |
| 15 | `frontend/src/sweden/Belonging.tsx:287` | Service points fell …; "physical visits −25 %" | Juxtaposition suggests a link; most of the fall is after 2019. | Report 2014–2019 and 2019–2025 apart; say that losing a service point did not go with a larger visit decline before 2020. |
| 16 | `Belonging.tsx:699-710` | "Where there are more libraries per inhabitant, more people visit them" | Visits are not people; ρ is population size (partial 0.03). | "…, visits per inhabitant are higher"; add the partial ρ; verdict stays `undetermined`. |
| 17 | `frontend/src/sweden/Futures.tsx:192` | "… faded from the chamber's future talk" | The alternatives lexicon lists 1990s proposals; 9–18 speeches a year at the end. | "Speeches naming these specific proposals (löntagarfonder, sextimmarsdag, medborgarlön …) became rare: 76 in 1994, 18 in 2025." |
| 18 | `Futures.tsx:556-559` | Securitisation `supports` at +1 pp | `security` includes trygghet and stabilitet; no uncertainty. | `undetermined` until the defence/crime sub-terms are reported apart. |
| 19 | `frontend/src/sweden/FuturesExplore.tsx:199-205` | "Most likely single break … X % of the variance" | A straight line gives 75 %. | "Best split into two levels (descriptive; a steady trend gives about 75 %)". |
| 20 | `Futures.tsx:482` | DiVA "shown apart under Explore once every month is harvested" | It is harvested and shown. | "shown apart under Explore". |

## 5. Recommended methods and assumptions

- Effect sizes first: Every published change carries its denominator, both endpoints and n.
  Relative changes of small rates also carry the absolute change.
- Intervals: Percentile bootstrap with a fixed seed for cross-sections; county-cluster
  bootstrap where the predictor is spatially autocorrelated (Moran's I above 0.3); block
  bootstrap of years for yearly series with lag-1 autocorrelation above 0.5.
- Nulls: Permutation over municipalities for spatial claims; Gaussian copula with empirical
  marginals for cluster validity; AR(1) around a fitted trend for breaks in yearly series.
- Families: A family is all relationships or themes that answer one question on one page.
  Record it in the export before computing, correct with Holm, and publish the adjusted values next
  to the raw ones. Do not use a significance threshold as a verdict; classify by interval and
  direction.
- Verdict rule: A reading `supports` only when the result could have come out against it,
  the direction holds across the stated sensitivity variants, and the interval excludes zero.
  Otherwise `undetermined`. Thresholds such as ±10 % stay as stated conventions, never as tests.
- Denominators: Report text measures in three forms (share of texts, per 1,000 words, share
  within fixed length bands). Riksdag, DiVA and any SOU corpus keep their own denominators and are
  never pooled.
- Composition: Shift-share decomposition for B (occupation, employer) and E (party, speaker
  role) before any reading of change.
- Lexicons: Precision from coded samples with Cohen's κ for two readers; recall from a sample
  of non-matching texts; the version of each pattern stored with its counts. Report lexicon vintage:
  the year each term entered the list.
- Ecological inference: Every municipal relationship says "municipalities where", never
  "people who".
- Missingness: Each analysis states its complete-case n, its balanced-panel n and the
  difference in result between them. Compare excluded units with included ones on known variables.

## 6. Data dependencies and estimated compute cost

| Analysis | Inputs and versions | Code | Compute | Status |
|---|---|---|---|---|
| 2.1 E length and breaks | 32 Riksdag session archives (sha256 in `futures/coverage.json`); `seeds/sweden_futures/future_terms.csv` | `futures_language.py`, `mart_sweden_future_trends*.sql`, `export_futures.py` | Recount: stream the archives once, tens of minutes on one core; break nulls under a minute | New data (recount), then supported |
| 2.2 B denominators and composition | 23 JobTech archives (CC0), taxonomy cache, `ad_language_terms.csv` | `ad_language.py`, `mart_sweden_job_language*.sql`, `export_language.py` | Re-stream of about 11.3 M ads, several hours, run through the weekly subject with `--max-new`; decomposition seconds | New data (recount) |
| 2.3 C sensitivity | `similarity/municipalities.json`; run `public-consensus-2026-10-13` sources; panel parquet sha `b4ac1fb7…` | `ml/research/regions.py`, `export_similarity.py` | Under 5 minutes (200 copula draws × k-means on 280 × 4) | Supported |
| 2.4 D change | `belonging/municipalities.json` (bibstat sha256 in `belonging/coverage.json`) | `export_belonging.py` | Seconds | Supported; opening hours new data (small API pull) |
| 2.5 A classification | `measurement/items.json`, seeds, SCB metadata on disk | `mart_sweden_measurement_items.sql`, `export_measurement.py` | Seconds | Supported; other agencies' catalogues new data |
| 3.1 matched neighbours | C neighbours, D 2024 | new function in `export_connections.py` | Seconds (999 permutations) | Supported |
| 3.2 change model | D panel, municipal panel | `export_connections.py` | Seconds | Supported |
| 3.3 one model | cross-subject mart 2019 and 2024 | `export_connections.py` | Seconds (2,000 cluster resamples) | Supported |
| E DiVA jump | `features/sweden/futures_theses/*.parquet` (322 months) | `futures_theses.py` | Re-harvest with per-alternative and institution fields: hours of OAI paging | New data (re-harvest) |

No analysis needs a new dependency. Everything runs on numpy, scipy, scikit-learn and DuckDB,
already installed.

## 7. Prioritised implementation plan

Each step defines its output, its test and its frontend change. Seeds are fixed in the exports and
written into the JSON `method` block.

1. **Copy repairs (claims 1, 2, 5–8, 12, 13, 16, 17, 19, 20).** Existing data. Output: changed
   strings only. Test: update `frontend/tests/sweden.spec.ts` expectations; run the de-ai-writing
   scan on changed copy. Frontend: no new components.
2. **Connections export, re-specified (3.3, claims 3, 4).** Existing data. Output:
   `connections.json` with one socioeconomic relationship, partial-ρ interval (iid and county
   cluster), the family and Holm values, the 2019 replication, and a missingness comparison.
   Remove the trivial pair or move it into the method note. Test: a new
   `platform/tests/python/test_sweden_connections.py` with a fixed 20-row fixture checking ρ,
   partial ρ, the interval's determinism under the seed, and the assessment rule. Frontend: show
   the partial with its interval, and the 2019 value next to 2024.
3. **D after 2019 (2.4, claim 15).** Existing data. Output: period changes and recovery ratios by
   SKR group in `belonging/*.json`. Test: extend `test_belonging_export.py` with a balanced-panel
   fixture. Frontend: the headline split into two periods; a small multiple by SKR group.
4. **C nulls and sensitivity (2.3, claim 14).** Existing data. Output: copula null, neighbour
   Jaccard per variant, temporal ARI, out-of-model outcome R² with permutation reference in
   `similarity/groups.json`. Test: extend `test_sweden_similarity.py` with a determinism check
   for the seed and a contract check (280 rows, 5 neighbours, variants present). Frontend: a
   sensitivity table under Method; the cited null replaced.
5. **Connections 3.1 and 3.2.** Existing data. Write the specification into the export docstring
   and commit it before the first run, so the pre-specification can be checked. Output: two new
   relationships in `connections.json`. Test: fixture tests as in step 2. Frontend: a
   neighbour-difference dot plot for 3.1 (one focal accent for the selected municipality); a
   coefficient table for 3.2.
6. **E recount (2.1, claims 18, 19).** New data (recount). Output: per-1,000-word rates,
   length-band shares, sub-term counts, trend-plus-break with its null in `futures/trends.json`.
   Test: `test_sweden_futures.py` for `count()` on fixed speeches, and the break function on a
   straight line (must not report a break). Frontend: length-band chart beside the share; break
   shown only when it beats the null.
7. **B recount and validation (2.2, claims 9–11).** New data (re-stream) and a manual coding
   sample. Output: three measures per category, sub-lexicons, shift-share components,
   precision and κ in `language/*.json`. Test: dbt tests `texts_matching <= texts` and
   sub-lexicon sums; unit test for the agreement rule in `languageChange.ts`. Frontend: measure
   switch with an agreement badge per category.
8. **A classification sensitivity (2.5).** Existing data first, then catalogue metadata from other
   agencies once licences are read. Output: second mapping and moved-item share in
   `measurement/summary.json`. Test: seed coverage test. Frontend: "counted under the other
   mapping" values next to each domain.
9. **DiVA 2024–2025 jump.** Re-harvest with per-alternative marker counts and institution.
   Output: marker decomposition and institution composition per year. Until then, mark 2024 and
   2025 on E's DiVA chart as "rise not yet explained".

Implementation waits for the owner's approval.
