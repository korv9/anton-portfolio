# SWEDEN research roadmap

Phase 0, 2026-10-20. Proposed order of work, for approval. Nothing here is implemented. Evidence
for each item is in [sweden-research-alignment.md](sweden-research-alignment.md),
[sweden-data-inventory.md](sweden-data-inventory.md) and
[sweden-data-source-strategy.md](sweden-data-source-strategy.md).

Each item is marked **existing** (data already on disk or in R2) or **new ingestion** (a source
not fetched today). Sections 1 and 3 to 6 need existing data only, with three exceptions marked
in place. Verified outputs that are not named in a repair stay as they are.

## 1. Repairs

These come first because a published claim is wrong or a number is computed on a flawed input. All
use existing data.

| # | Product | Repair | Where | Needs |
|---|---|---|---|---|
| 1.1 | C | The "Centre and periphery" verdict is `challenges` when more than 0.5 of nearest neighbours lie in another county. Use a random-partner baseline (92.7 % expected, 74.3 % observed, same-county 3.5 times chance) and a permutation of profiles over municipalities. Rewrite the finding and verdict: social similarity is clustered in space. | `frontend/src/sweden/Similarity.tsx:500-503`; baseline added to `platform/publish/sweden/export_similarity.py` | existing |
| 1.2 | C | Turnout labelled 2024 is the 2022 election carried forward by Kolada. State each feature's reference year in the method copy, or drop turnout until correct-year results are ingested. | `Similarity.tsx:390`, `:444` | existing |
| 1.3 | C | The source line credits Kolada for derived data, which Kolada's terms forbid. Reword as own processing of data from Kolada and SCB. | `Similarity.tsx:194-195` | existing |
| 1.4 | A | "Culture and civic life are the thinnest measured domains" holds only for SCB tables. Restrict it to SCB or name the SCB plus Kolada order. | `frontend/src/sweden/products.ts:35` | existing |
| 1.5 | A | "Employment is the most densely measured domain in official statistics" holds only in SCB's database. | `products.ts:68` | existing |
| 1.6 | A | State that spirituality has no subject mapping, so its zero is structural. | `Measurement.tsx:159-245`; seeds `platform/seeds/sweden/` | existing |
| 1.7 | B | The reading text says "between ${first} and ${last}" (2006–2026) while `change()` runs from `from` (2008). The header comment calls the main measure a share while `MAIN` is the per-1,000-word rate. The examples note says the lowest hash of the ad id, while the code hashes the text. | `Language.tsx:599-600` against `:153-160`; `Language.tsx:4-5` against `:97`; `platform/ingest/jobtech/ad_language.py:126,132` | existing |
| 1.8 | B | Add a crosswalk seed from the eight non-taxonomy labels of 2020–2023 to the 21 taxonomy fields, and a minimum of 30 texts per field-year in standardisation. Repairs 2020 values that are off by up to 30 %. | `platform/models/gold/sweden_language/mart_sweden_job_language_trends.sql:18-33`; new seed in `platform/seeds/sweden_language/` | existing (taxonomy already cached) |
| 1.9 | B | Use complete years as endpoints (2008 or 2010 to 2025), show baseline sensitivity, and base reading verdicts on a range. The Han/Fisher verdict sits at +10.1 % against a +10 % threshold. | `Language.tsx:153-160` and readings near `:596-602` | existing |
| 1.10 | E | The session regex accepts six digits only, so `anforande-19992000.json.zip` is never counted. Accept the eight-digit code and recount one 21 MB archive. Rename the e2e test or keep its claim true. | `platform/ingest/riksdagen/futures_language.py:47`; `frontend/tests/sweden.spec.ts:183` | existing source; one archive download |
| 1.11 | E | Exclude the running year 2026 from five-year means and breaks, or mark it provisional, for Riksdag and DiVA. | `platform/publish/sweden/export_futures.py:35-60`; `Futures.tsx` findings | existing |
| 1.12 | E | Store the marker match count, so a marker rate per 1,000 words exists, and publish speech length next to the share (ρ = 0.84 with words per speech). | `futures_language.py`; `mart_sweden_future_trends.sql` | existing source; recount of 32 sessions |
| 1.13 | E | Fix copy that says DiVA is "not yet counted". | `Futures.tsx:7`, `:485`; `export_futures.py:15`; `export_connections.py:131` | existing |
| 1.14 | D | Treat 0 visits with at least one staffed service point (12 rows) and 0 service points with visits (1498/2022) as missing, and count them in `coverage.json`. | `platform/publish/sweden/export_belonging.py:110` | existing |
| 1.15 | D | A municipality-year where any organisation omits a term is a partial sum today. Null or flag it. Implement or remove the promised "share of years reported". | `export_belonging.py:110`, docstring `:13-14` | existing |
| 1.16 | D | Remove the Putnam/Habermas "supports" verdict, or say "consistent with, untested". | `Belonging.tsx` readings | existing |
| 1.17 | C | Make C reproducible in CI. The export finds no run file and keeps committed data. Store the run JSON and its hash-pinned sources in the warehouse store, or run `ml/research/regions.py` in the subject, and add a contract test: 290 rows, 280 analysed, 5 neighbours each. | `export_similarity.py:114`; `platform/pipeline.yml:284-299` | existing |
| 1.18 | E | DiVA joins Swedish and English descriptions and will double-count changed records in weekly increments. Keep the Swedish abstract and store record ids before more increments run. | `platform/ingest/diva/harvest.py:61`; `futures_theses.py` | existing source; re-harvest |
| 1.19 | Connections | The B×E rejection says it "waits for the full job-ad backfill", which is complete. Restate the real reason (two genres, shared trend, length confound). | `export_connections.py:123-127` | existing |

## 2. High-value sources

All new ingestion. Order follows research value against cost.

1. KB bibstat opening hours `Open101–106`, `Open201–206` for D. Verified definitions, same API, near
   zero cost. Essential.
2. JobTech Taxonomy for B. Already cached; the crosswalk in 1.8 uses it. Essential.
3. Kolada additional KPIs for C and D (outcomes, library and participation KPIs). Terms verified.
   Essential for C.
4. SCB regional tables including DeSO/RegSO for C. CC0, verified. Essential.
5. Socialstyrelsen catalogue metadata for A. Endpoint verified, licence UNVERIFIED; read the licence
   page before ingesting.
6. Riksdagen SOU, then propositions, for E as a third corpus. Verified, about 1 GB streamed.
7. Arbetsmiljöundersökningen and Yrkesregistret AM0208 for B. Verified, small.
8. SCB population grid for D. Partly verified.
9. Folkhälsodata HLV for A and D. Licence UNVERIFIED; county level only.

Wait for a licence or endpoint check: dataportal.se, Valmyndigheten files, Segregationsbarometern,
Swerik, SwePub, JobTech enriched ads trait fields. Defer GTFS routing until the grid distance exists.

## 3. Methods

All existing data.

- A: count measures per table from metadata; detect geography from `kommun`/`län` and json-stat
  roles; split `is_current` into ongoing and projection (`mart_sweden_measurement_items.sql:50`);
  normalise or drop Kolada `institution`.
- B: sub-lexicons (passion into `engag*` and passion/brinner; identity into recruitment formulas and
  career); co-occurrence per text; SSYK-4 standardisation; staffing-agency share on 2023+;
  cross-archive text dedup; segmented regression or bootstrap for breaks.
- C: sensitivity without log population and commuting, on PCA-4 space, with Mahalanobis distance;
  Jaccard overlap of neighbour sets; stability over 2020–2023; neighbours on 11 indicators for the
  10 excluded municipalities, flagged.
- D: balanced or paired sets for every change; 2019 next to 2014 as a pre-COVID baseline.
- E: relative horizon marker (year above speech year plus N); report `långsiktig` separately;
  harmonise KDS with KD and separate presiding officers and the King; bootstrap for five-year means
  and a permutation null for breaks.

## 4. Missing KPIs

| Product | KPI | Needs |
|---|---|---|
| A | measures per domain; frequency × geography × currency grid | existing |
| B | co-occurrence matrix per year; precision per category | existing (recount) |
| C | same-county share against its null; neighbour stability | existing |
| D | open hours per 1,000 inhabitants; share of staffless hours | new ingestion (bibstat terms) |
| D | population-weighted distance to the nearest library | new ingestion (grid) |
| D | share of years reported | existing |
| E | marker rate per 1,000 words; length-band shares | existing (recount) |
| E | DiVA institution composition per year | existing (re-harvest with ids) |

## 5. Validation and reproducibility

- B and E lexicons: stratified manual samples, about 50 matches per category and period for B and
  about 200 hits plus 200 non-hits for E, coded for what the match means. Publish precision and
  recall with intervals. Existing data; older B periods need a re-stream.
- C clustering: report the null and permutation results with the groups; re-run in CI (1.17).
- Tests to add: pytest for `catalogue_ingest.py` staging, `export_belonging.py` aggregation,
  `futures_language.py` and `futures_theses.py` `count()`; dbt tests `texts_matching <= texts`,
  field labels within taxonomy plus crosswalk, year range and not_null on E marts.
- Provenance: the site serves committed files with `run_id: null`. Record which release the
  committed copy matches.

## 6. Gap presentation

Findings come before KPI cards. On each page, say what the data cannot show, once and concretely:

- A: absent from SCB's database and Kolada, not unmeasured.
- B: ads describe how employers write; they do not measure hiring or conditions. Show
  Arbetsmiljöundersökningen beside the ads once ingested, as a descriptive comparison.
- C: groups are constructed; the map changes with the definition.
- D: library supply and self-reported belonging sit on different geographies and periods, so they
  are shown side by side, never correlated across municipalities.
- E: frequency is not imagination; Riksdag and DiVA are separate corpora.

## 7. Connections

| Pair | Next step | Needs |
|---|---|---|
| C×D | Recompute after D repair 1.14; keep it exploratory | existing |
| A×D | Prose comparison: culture is 6 SCB tables, while library statistics come from KB | existing |
| A×C | List A's 586 municipal tables as the pool for C's alternative feature sets | existing |
| B×E | Keep rejected; show side by side; fix the reason (1.19) | existing |
| A×E | Write a theme-to-domain mapping before any comparison | existing |

## 8. Frontend

Copy fixes are in section 1. Other frontend work waits for the repairs: provisional markers for
partial years, reference years per feature in C, a gap panel per product, and the null baseline in
C's finding. No architecture change is proposed.
