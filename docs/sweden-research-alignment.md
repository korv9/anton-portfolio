# SWEDEN research alignment

Phase 0, 2026-10-20. This document compares each SWEDEN product with its research question, using
only facts that were checked. Nothing here changes code or data. The roadmap is in
[sweden-research-roadmap.md](sweden-research-roadmap.md), the lineage and coverage in
[sweden-data-inventory.md](sweden-data-inventory.md), and candidate sources in
[sweden-data-source-strategy.md](sweden-data-source-strategy.md).

## Evidence and status levels

Every number carries a source tag.

| Tag | Meaning |
|---|---|
| [AC], [B], [DE] | The three Phase 0 audit reports (projects A and C, B, D and E), 2026-10-20, read-only, code at `6560478a`. They are kept outside the repository with their query scripts (`a_repro*.py`, `c_check.py`, `q1.py`–`q5.py`, `d1.py`–`d4.py`, `e1.py`, `e2.py`). The script named next to a number is the one that produced it. |
| [own] | Checked again for this synthesis, by reading the cited lines or by running Python over the committed files in `frontend/public/data/sweden/`. The command is given. |
| [CI] | GitHub Actions run `39441114070`, "Build, store and publish the warehouse", sha `37167df9`, success, 2026-10-20. |

No local `warehouse/portfolio.duckdb` exists. The audits recomputed the gold marts in memory from
raw or feature files with the repository SQL [AC, B, DE].

Five status levels are kept apart throughout:

1. implemented: the code exists
2. ran: the pipeline has run successfully, locally or in CI
3. data available: the inputs exist and their coverage is known
4. analysis verified: the published numbers reproduce and their interpretation holds
5. published: the result is live on the site

| Project | Implemented | Ran | Data available | Analysis verified | Published |
|---|---|---|---|---|---|
| A Measurement | yes | yes, CI | yes, raw snapshot 2026-10-19 | counts yes; two copy claims and the spirituality zero no | yes |
| B Ideal Human | yes | yes, CI and local | yes, with gaps | partly: 2020 standardised values wrong, lexicon not validated | yes |
| C Invisible Sweden | yes | local only; CI skips | local warehouse only | numbers yes; headline verdict no | yes |
| D Belonging | yes | yes, CI | partial | partly: zeros as missing, partial sums | yes |
| E Lost Futures | yes | yes, CI and local | incomplete: session 1999/2000 missing | marts reproduce; lexicon not validated; DiVA measurement flawed | yes |

## A. Politics of Measurement

**Question.** What does Sweden measure, and what does it overlook?

**Intended reader insight.** Where a domain appears measured depends on which agency holds the
statistics and how the catalogue is classified.

**Verified data.** SCB Statistikdatabasen API v2 lists 4,286 tables, 4,270 public. Kolada has 5,860
distinct KPIs. Published items are 10,130 = 4,270 + 5,860 [AC `a_repro.py`, `a_repro3.py`; CI log
"SWEDEN measurement: 10130 items, 1880 coverage cells"]. `coverage.json` has 1,880 cells summing to
64,009, years 1900–2026, with zero differences on recomputation [AC `a_cov.py`]. Metadata was
fetched only for the 1,299 tables with a variable containing "region" [AC; CI log].

**KPIs and findings.** Counts per domain (`export_measurement.py:55-66`). "Current" means
`last_year >= current_year - 2` for SCB (`mart_sweden_measurement_items.sql:50`) and a non-null
`publ_period` for Kolada, two definitions under one label [AC]. Findings in `Measurement.tsx:159-245`:

- "Health looks unmeasured in SCB's catalogue … one of the most measured in Kolada": SCB 7, Kolada
  932. Correct and well framed [AC `a_repro2.py`].
- "SCB publishes 983 tables on employment and 6 on culture": correct for SCB [AC].
- "No published table or key figure falls under Spirituality": true of the seeds only. No seed row
  maps to `spirituality`, so the zero holds by construction. 18 item titles match
  `trossamfund|religi|kyrk|andlig` [AC `a_kw.py`].
- `frontend/src/sweden/products.ts:35` says "Culture and civic life are the thinnest measured
  domains". By SCB plus Kolada, culture (120) is fifth thinnest after spirituality 0,
  social_relationships 54, wellbeing 78 and leisure 103. It is thinnest only in SCB (6) [AC].
- `products.ts:68` says "Employment is the most densely measured domain in official statistics".
  That holds for SCB (983). With Kolada added, other 2,356, economy 2,121 and education 1,882 come
  first [AC].

**Missing analyses.** A count of measures per table; a multi-label or keyword check of the domain
mapping; a frequency × geography × currency grid per domain.

**Scientific weaknesses.** One SCB table is not one indicator, so SCB and Kolada counts are in
different units. Single-label mapping by subject code. Projections ending in 2120 count as current
(141 tables end after 2026). The geography heuristic misses at least 21 tables whose geographic
variable is named `kommun` or `län`. Kolada `institution` strings are not normalised, so "345
institutions" is not meaningful [AC].

**Gap interpretation.** A measurement absent from SCB's database and Kolada may exist at
Socialstyrelsen, Folkhälsomyndigheten, Brå, Kulturanalys or KB. The page must say "absent from these
catalogues", never "unmeasured". Counts show availability, not importance.

**Improvements.** Fix the two `products.ts` claims and note that spirituality has no mapping. Split
`is_current` into ongoing and projection. Detect geography from `kommun`/`län` names and json-stat
roles. Count measures from the metadata already on disk. Then add Socialstyrelsen and
Folkhälsomyndigheten catalogue metadata.

## B. The Ideal Human

**Question.** What kind of person does the Swedish labour market expect workers to be, and how does
what workers should know and do compare with what they should be?

**Intended reader insight.** Job-ad language about personal traits changed in a measurable way, and
the change has limits as evidence about work.

**Verified data.** 23 archives, 11,291,650 ads, 8,736,050 distinct texts, 2,865,052,019 words, years
2006–2026 with 2026 covering Q1–Q3 only [B `q1.py`; own: summing `ads` and `distinct_texts` in
`frontend/public/data/sweden/language/coverage.json` gives 23, 11,291,650 and 8,736,050]. County is
null in every archive 2006–2019. Occupation is missing for 99.99 % of 2006 texts and 86.4 % of 2007
[B `q1.py`]. Ads are CC0 per the source README [B].

**KPIs and findings.** Unit: distinct text per archive (sha1 of normalised headline and
description, `ad_language.py:125-129`). Main measure: matches per 1,000 words with the occupation mix
fixed (`Language.tsx:96-97`). The CONTINUITY changes 2010→2025 reproduce: passion +71.3 %,
creativity +21.3 %, competence −18.7 %, stress −33.9 % [B `q1.py`]. Published `trends.json` equals
the recomputed mart with maximum absolute difference 0 [B].

The page computes changes from `from` = 2008 to `last` = 2026, a partial year
(`Language.tsx:153-160`), while the reading text says "between ${first} and ${last}", which is
2006–2026 (`Language.tsx:599-600`). The Han/Fisher verdict needs a mean personal change above +10 %
and gets +10.1 %. Without passion the other seven personal categories average about −2 % [B].

**Missing analyses.** Lexicon precision and recall; co-occurrence per text; SSYK-4 trends;
employer and staffing-agency controls; uncertainty on breaks.

**Scientific weaknesses.**

- The 2020 standardised values are an artefact. In 2020 old field labels hold 4–12 texts but keep
  full pooled weight (Pedagogik about 11 %). Creativity 2020 is published at 2.024 against 1.559
  harmonised [B `q3.py`, `q4.py`]. Cause: no label crosswalk and no minimum cell size in
  `mart_sweden_job_language_trends.sql:18-33`.
- In a 2025 shard of 18,653 texts, 75 % of passion matches are `engag*`, often employer
  self-description. 55 % of identity matches are "personliga egenskaper" or "personlig lämplighet"
  [B `q5.py`].
- Ads tripled in length, so per-word rates fall for terms used once per ad.
- Dedup is per archive only (`ad_language.py:114`, `:127-129`).

**Gap interpretation.** Ads show how employers write, not working conditions, hiring or lived
experience. A rising term family can be a template or applicant-tracking-system effect.

**Improvements.** Crosswalk the eight non-taxonomy labels and require a minimum of texts per
field-year. Use complete years as endpoints and show baseline sensitivity. Fix the `first`/`from`
copy. Split `engag*` from passion and the recruitment formulas from identity. Draw a manual
validation sample.

## C. The Invisible Sweden

**Question.** How does the statistical definition of similarity change our understanding of
Sweden?

**Intended reader insight.** Municipal similarity is a construction, and the map changes with the
features and the distance chosen.

**Verified data.** 290 municipalities, 280 analysed. Seven lack social assistance and three lack
turnout [AC `c_check.py`]. The run `public-consensus-2026-10-13` sits in the local warehouse only.
In CI the export prints "is not here; committed files kept" (`export_similarity.py:114`; CI log line
4953).

**KPIs and findings.** 208 of 280 municipalities have their nearest social neighbour in another
county; median distance 180 km [AC; own: `summary` in `similarity/municipalities.json`].

The verdict for "Centre and periphery" is `challenges` whenever the share exceeds 0.5
(`Similarity.tsx:500-503`). 0.5 is the wrong reference. With 21 counties of unequal size, a random
partner lies in another county 92.7 % of the time. Observed: 74.3 %. Own check: Python over
`similarity/municipalities.json`, expected share = Σ k(n−k) / n(n−1) over county sizes k,
n = 280; observed = first neighbour's county differs. Same-county pairs occur at 25.7 %, about
3.5 times the 7.3 % chance level. The random-pair median distance is 302 km against 180 km for social
neighbours [AC]. The data therefore show social similarity clustered in space, the opposite of the
verdict.

Clustering: k=2 silhouette 0.352, bootstrap ARI 0.751; k=4 silhouette 0.274, AMI against SKR 0.319;
shuffled 95th percentile about 0.20 [AC, as recorded; the model was not re-run].

**Missing analyses.** Geographic null and permutation test; sensitivity to feature set and distance;
temporal stability over 2020–2024; comparison with outcomes not used in clustering.

**Scientific weaknesses.** Turnout labelled 2024 is the 2022 election value carried forward by
Kolada: panel median 88.0 for 2018–2021 and 86.0 for 2022–2025 [AC `c_check.py`]. The method copy
says "Standardise the 12 indicators for 2024" (`Similarity.tsx:390`). Employment has no 2018, 2019
or 2025 values. Neighbours use 12-D z-space while clusters use 4 PCs. k=2 ARI barely clears 0.75.
Listwise deletion leaves a hole in the far north [AC].

The source line "Kolada and SCB, ${data.year}" (`Similarity.tsx:194`) credits Kolada for derived
data. Kolada's terms say "Gör du egna bearbetningar på vår data, får inte Kolada anges som källa"
[AC, official page].

**Gap interpretation.** Clusters are constructed. SKR comparison is partly circular because
population and commuting are inputs to both. Crow-flies distance is not travel.

**Improvements.** Add the nulls and rewrite the verdict. Disclose each feature's reference year.
Reword the source line as own processing of Kolada and SCB data. Make C build in CI with a contract
test. Then run sensitivity and stability checks on the panel already on disk.

## D. Infrastructure of Belonging

**Question.** Can access to community and public participation be measured, starting with
libraries?

**Intended reader insight.** Availability, use and belonging are different things, and library
statistics measure only the first two.

**Verified data.** KB bibstat terms `BemanService01`, `Besok01`, `Publ199`, `Aktiv99`, 2014–2025;
Biblioteksdatabasen 4,330 records, 1,223 public, 1,147 with coordinates [DE `d1.py`, `d2.py`].
Published `municipalities.json` has 3,446 municipality-years [DE `d3.py`; own: `len(rows)`]. No
term is complete for every municipality and year. Balanced 2014–2025 panels: service points 272
municipalities, visits 222 [DE].

**KPIs and findings.** Rates per 10,000, per inhabitant, per 1,000 and per 100
(`export_belonging.py:116-118`); km² per staffed service point. The paired decline 2014→2025 is
1,171 → 1,033 service points (−12 %, n = 285) and 62.67 M → 46.79 M visits (−25 %, n = 271)
[DE `d4.py`]. CONTINUITY's "1,171 to 1,054" and "63.6 to 48.7 million" are unpaired national sums.
Both are correct measures of different things; the page shows the paired one. Spearman ρ between
service points per 10,000 and visits per inhabitant, 2025: 0.144, n = 282 [DE].

**Missing analyses.** Opening hours, including staffless hours; a pre-COVID 2019 baseline;
intervals on medians and ρ; population-weighted distance.

**Scientific weaknesses.** 12 municipality-years have 0 visits with at least one staffed service
point, and one row (1498/2022) has 0 service points with 64,110 visits [DE; own: Python over
`belonging/municipalities.json` `rows` lists the same 12 and 1]. They are published as real zeros.
`export_belonging.py:110` adds each organisation's value to a cell that starts at 0, so a missing
organisation gives an undercount. The docstring promises "the share of years reported"
(`export_belonging.py:13-14`), which the output lacks. The Putnam/Habermas reading says "supports"
whenever service points fell [DE].

**Gap interpretation.** Visits include commuters and visitors; borrowers include institutions;
nothing here measures loneliness or belonging. Fewer service points may mean merged branches or
staffless opening.

**Improvements.** Treat the 13 impossible zeros as missing. Null or flag municipality-years with a
non-reporting organisation. Use paired or balanced sets for every change. Remove the "supports"
verdict. Add opening-hour terms from bibstat.

## E. The Lost Futures

**Question.** Are we imagining different futures, or projecting the present forward?

**Intended reader insight.** Which themes accompany future talk in the Riksdag, and in student
theses, and how that changed. The page must not assume a decline.

**Verified data.** 32 Riksdag sessions, 199394–202526, 415,595 speeches [DE `e1.py`; own: summing
`speeches` in `futures/coverage.json` gives 32 sessions and 415,595]. DiVA: 322 months, 431,898
Swedish-language records with an abstract, years with at least 1,000 records published (2001–2026)
[DE].

**KPIs and findings.** Future share: speeches where the marker matches / all speeches. Theme share:
future speeches with a theme anywhere / future speeches. Recomputed marts match `trends.json` within
4.99e-5 [DE]. Five-year means 1994–1998 against 2022–2026: future share 17.9 % → 20.6 %;
alternatives 2.9 % → 0.6 %; security 27.5 % → 39.1 %, or 35.8 % for the tail without 2026 [DE].

**Missing analyses.** Length-normalised marker; validation sample with precision and recall;
uncertainty for five-year means and breaks; party harmonisation.

**Scientific weaknesses.**

- Session 1999/2000 is never counted. The regex `anforande-(\d{6})\.json\.zip`
  (`platform/ingest/riksdagen/futures_language.py:47`) does not match `anforande-19992000.json.zip`,
  which Riksdagen lists (HEAD 200, 20,939,449 bytes) [DE]. Own check: `futures/coverage.json` jumps
  from session `199899` to `200001`. 1999 is published with the spring sitting only (8,542
  speeches). 2000 has 4,844 speeches and is dropped by the half-median rule
  (`export_futures.py:35-60`).
- 2026 is a running year and is kept, because 10,279 speeches pass the threshold of about 6,350
  [DE].
- Future share tracks mean words per speech: Spearman ρ = 0.84, p = 1.3e-9, 1994–2026 without 2000;
  ρ = 0.86 for DiVA [DE].
- The horizon pattern `(år|till|fram till|inför) 20[2-9]0` is time-asymmetric [DE].
- DiVA joins Swedish and English descriptions (`harvest.py:61`), and weekly increments will count
  changed records twice [DE].
- Copy says DiVA is "not yet counted" (`Futures.tsx:7`, `Futures.tsx:485`,
  `export_futures.py:15`, `export_connections.py:131`), but the page shows the DiVA series.

**Gap interpretation.** Word frequency does not measure imagination or opinion. Riksdagen and DiVA
are separate corpora with their own denominators. Speeches are debate; the designed futures sit in
SOU and propositions, which are not ingested.

**Improvements.** Fix the regex and recount one 21 MB archive. Exclude or mark 2026. Store the
marker count to get a per-word rate. Validate the lexicon. Harmonise KDS with KD. Keep only the
Swedish DiVA abstract and store record IDs. Fix the stale copy.

## Connections

Connections is the analytical layer across A–E. `export_connections.py` computes three D×C
relationships and records two rejections [own: keys of `connections/connections.json`].

| Pair | Kind | Time | Geography | Method | Assessment |
|---|---|---|---|---|---|
| A×D | Descriptive comparison of measurement coverage | A: catalogue years 1900–2026; D: 2014–2025 | A has no municipal join; D is municipal | Catalogue items against municipal statistics | Compatible only as prose: A counts 6 SCB culture tables, while D's library statistics come from KB, outside SCB's database. This is the "measured elsewhere" case. No correlation is possible. |
| A×C | Conceptual and methodological link | A lists tables; C uses 2024 | A shows 586 SCB tables at municipal resolution and 75 at subarea | A is a pool of candidate features for C | Compatible as a source list for alternative feature sets. No statistic. |
| C×D | Statistical relationship, exploratory | Both 2024; turnout is 2022 but is not in these pairs | Municipality code, 280–282 municipalities | Spearman ρ with bootstrap CI and partial ρ on log population | Compatible in time and geography. Visits vs post-secondary education ρ −0.004, CI [−0.125, 0.118], partial 0.192, n = 281 [DE, from `connections.json`]. The 12 zero-visit rows enter n, so the D repair comes first. Descriptive only, several tests, no significance claim. |
| B×E | Untested hypothesis | 19 shared years 2008–2026, 2026 partial in both | National only | Two lexicons, two genres, both length-confounded | Rejected correctly. The recorded reason "waits for the full job-ad backfill" is stale: all 23 archives are counted. A correlation of two trending national series would reflect shared trend and text length. Keep it as a side-by-side description. |
| A×E | Conceptual link, untested hypothesis | A 1900–2026 catalogue years; E 1994–2026 speeches | National | No crosswalk between A's 13 domains and E's nine themes | Not compatible in method. "Do the futures politicians talk about match what agencies measure?" needs a documented theme-to-domain mapping first. |

Combine datasets only after time, geography and method are shown to match. No Connections claim is
causal.
