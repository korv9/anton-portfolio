# SWEDEN data inventory

Phase 0, 2026-10-20. The real path of each product from external source to frontend, with
coverage, freshness, checks and gaps. Source tags ([AC], [B], [DE], [own], [CI]) and the five
status levels are defined in [sweden-research-alignment.md](sweden-research-alignment.md#evidence-and-status-levels).

Line references are to `6560478a`. Where an audit cited a line that has since moved, the line given
here was re-read: `export_belonging.py:110` (partial sum, audit said 104), `:113` (population
fallback, audit said 110) and `mart_sweden_measurement_items.sql:50` (`is_current`, audit said 62).

## Lineage

### Shared delivery

- Subjects in `platform/pipeline.yml`: `sweden` (A, C export, D; `:284-299`), `sweden_language`
  (B; `:303-312`) and `sweden_futures` (E). All run weekly at `13 21 * * 6` and publish to group
  `sweden`. `configs/delivery/sweden.json` includes `sweden/*`.
- R2 pointer `manifests/current.json` names release
  `releases/sweden/5137e080caea9f6021e3798ffca4931800c707897fda4a9fd766593734ee9c65/manifest.json`,
  published 2026-10-20T17:01:59Z from code_sha `37167df9`, run `39441114070` [AC, DE]. Files sit at
  `releases/sweden/<release>/files/sweden/<product>/<file>.json`
  (`platform/publish/release.py:19,326-338`) [DE].
- The live site serves the copies committed under `frontend/public/data/sweden/`.
  `https://antonernstsson.com/data/delivery.json` is schema 1 with base `data/`, so the site does not
  read R2 for SWEDEN. R2 is a mirror that `frontend/src/dataSource.ts:148-165` would use only with
  `VITE_R2_MANIFEST_URL` or a schema-2 `delivery.json` [AC].
- Committed copies are local builds with `run_id: null` and `code_sha: null`. They differ from R2 by
  one CRLF byte per file and by provenance fields; for D also `population_source`, for E
  `dictionary_sha256` [DE].
- No `warehouse/portfolio.duckdb` exists locally. Gold marts are materialised in CI only [AC, DE].
- No SWEDEN product has a silver layer.

### Per product

| Layer | A Measurement | B Ideal Human | C Invisible Sweden | D Belonging | E Lost Futures |
|---|---|---|---|---|---|
| External source | SCB API v2 `/tables`, `/tables/{id}/metadata`; Kolada `api.kolada.se/v3/kpi` | `data.arbetsformedlingen.se/annonser/historiska/{YYYY}.jsonl.zip`, 2026-Q1..Q3; JobTech Taxonomy GraphQL | Kolada KPIs via the welfare pipeline; SCB population; SCB boundaries `shape_svenska_260225.zip` | KB bibstat `bibstat.kb.se/data?term=…`; Biblioteksdatabasen `bibdb.libris.kb.se/api/lib?dump=true` | `data.riksdagen.se/dataset/anforande/anforande-<session>.json.zip`; DiVA OAI-PMH `diva-portal.org/dice/oai`, set `studentThesis` |
| Ingest | `platform/ingest/catalogue/catalogue_ingest.py` (metadata only) | `platform/ingest/jobtech/ad_language.py` (stream, count, delete) | welfare Kolada ingest; `platform/ingest/scb/boundaries.py` | `platform/ingest/kb/libraries.py` | `platform/ingest/riksdagen/futures_language.py`; `platform/ingest/diva/futures_theses.py` |
| Raw or features | `warehouse/raw/catalogue/` 1,306 files, 58.1 MB, fetched 2026-10-19 | `warehouse/features/sweden/ad_language/` 23 archives × 4 files, 851 KB | `warehouse/cluster_lab/public-consensus-2026-10-13/`, local only | `warehouse/raw/kb/` with `_manifest.jsonl` | `features/sweden/futures/` 128 files; `features/sweden/futures_theses/` 321 Parquet + `done.json`. No text stored. |
| Bronze | views in `platform/models/bronze/sweden/` | `sources.yml` only | none for SWEDEN | none | `sources.yml` |
| Gold | `mart_sweden_measurement_items`, `_coverage` | `mart_sweden_job_language`, `_trends` | none for SWEDEN (welfare `mart_municipality_year_panel`) | none; aggregation in Python | `mart_sweden_future_themes`, `_trends`, `_theses` |
| Export | `platform/publish/sweden/export_measurement.py` | `export_language.py` | `export_similarity.py` | `export_belonging.py` | `export_futures.py` |
| Published | `measurement/{summary,coverage,items}.json` | `language/{trends,fields,regions,examples,coverage}.json` | `similarity/{municipalities,groups,geometry}.json` | `belonging/{municipalities,libraries,coverage}.json` | `futures/{trends,parties,examples,coverage}.json` |
| Frontend | `frontend/src/sweden/Measurement.tsx` | `Language.tsx` | `Similarity.tsx`, `map.ts` | `Belonging.tsx` | `Futures.tsx` |

Connections: `platform/publish/sweden/export_connections.py` reads the published SWEDEN files and
writes `connections/connections.json` with three D×C relationships and two rejections [own].

## Coverage

| Product | Records | Period | Geography | Source |
|---|---|---|---|---|
| A | 4,286 SCB tables (4,270 public), 5,860 Kolada KPIs, 10,130 items | catalogue years 1749–2120; coverage view 1900–2026 | national 3,324, county 285, municipality 586, subarea 75 SCB tables | [AC `a_repro.py`, `a_repro3.py`] |
| B | 11,291,650 ads, 8,736,050 distinct texts, 2,865,052,019 words | 2006–2025 and 2026 Q1–Q3 | county 2020–2026 only; no municipality | [B `q1.py`; own: sums over `language/coverage.json`] |
| C | 290 municipalities, 280 analysed | one year, labelled 2024 | municipality | [AC `c_check.py`; own: `similarity/municipalities.json` summary] |
| D | 3,446 municipality-years; 1,219 public libraries, 1,147 with coordinates | 2014–2025 | municipality via the current Biblioteksdatabasen mapping | [DE `d1.py`–`d3.py`; own: `len(rows)`] |
| E Riksdag | 32 sessions, 415,595 speeches, 145,250,807 words | 199394–202526, without 1999/2000 | national | [DE `e1.py`; own: sums over `futures/coverage.json`] |
| E DiVA | 322 months, 431,898 records | publication years 1922–2026; 2001–2026 shown | DiVA member institutions | [DE] |

## Completeness and freshness

| Product | Complete | Incomplete | Unverified |
|---|---|---|---|
| A | catalogue snapshot 2026-10-19; SCB update stamps to 2026-10-16 | metadata for 1,299 tables only; at least 21 geographic tables classed national | discontinued series (no field in SCB v2 listing) |
| B | every publication year 2006–2026 present; `duplicate_ids` 0 | 2026 partial; occupation missing 99.99 % (2006), 86.4 % (2007); no county before 2020 | cross-archive republished texts; count of description-less early ads |
| C | 280 of 290 | 10 dropped (7 social assistance, 3 turnout); turnout is 2022; employment lacks 2018, 2019, 2025 | SCB boundary licence page not opened |
| D | population for all 290, 2013–2025 | no term complete every year; balanced panels 222–272 municipalities; 13 impossible zeros | whether land area includes lakes; 299 registered municipality codes |
| E | 31 complete sessions | 1999/2000 missing (regex); 1999 spring only; 2026 partial kept; DiVA bilingual | duplicates across sessions; institution coverage of DiVA |

Freshness: A, B, D and E refresh weekly in CI. B adds at most three new archives a run
(`pipeline.yml:310`, `--max-new 3`). CONTINUITY says 4; the code says 3. C does not refresh: the CI
export finds no run file and keeps the committed files (`export_similarity.py:114`; CI log line
4953) [AC, own].

## Quality checks

| Product | dbt | pytest | Browser | Gaps in testing |
|---|---|---|---|---|
| A | 16/16 pass in CI: unique, domain not_null and relationships, geo accepted_values, last_year, is_current, coverage | none for ingest or export | `frontend/tests/sweden.spec.ts` | no fixture test of staging SQL |
| B | PASS=8 for `tag:sweden_language` in CI | `platform/tests/python/test_ad_language.py` 3 passed [B, with `--basetemp=tmp/pytest-audit-b`] | same spec | `texts_matching <= texts` described but not tested (0 violations in 34,875 rows by query [B `q3.py`]); no field-label set test |
| C | none | none | same spec | no contract for 290 rows, 280 analysed, 5 neighbours |
| D | none (no model) | none | `sweden.spec.ts:160` (290 paths) | no aggregation test |
| E | `unique_combination` on three marts; share between 0 and 1 | `test_diva.py` 4 passed [DE]; none for `futures_language.py`, `futures_theses.py`, `export_futures.py` | `sweden.spec.ts:183`, titled "reads every session", which is untrue while 1999/2000 is missing | no year-range or not_null tests |

CONTINUITY records `sweden.spec.ts` as 8 passed. No audit re-ran it.

## Published outputs

| File | Bytes (git) | Live | R2 |
|---|---|---|---|
| `measurement/summary.json`, `coverage.json`, `items.json` | 5,662; 62,440; 2,120,560 | 200 | yes; summary 5,709 B with provenance |
| `language/trends.json`, `fields.json`, `regions.json`, `examples.json`, `coverage.json` | 17,802; 209,310; 64,528; 287,898; 8,888 | 200, JSON-equal to git | yes; coverage 8,934 B with provenance |
| `similarity/municipalities.json`, `groups.json`, `geometry.json` | 190,947; 12,197; 134,946 | 200 | yes, same sizes |
| `belonging/municipalities.json`, `libraries.json`, `coverage.json` | 905,061; 95,434; 1,228 | deployed chunk reads them | yes |
| `futures/trends.json`, `parties.json`, `examples.json`, `coverage.json` | 26,033; 64,878; 288,692; 10,733 | deployed chunk reads them | yes; trends JSON-equal |

Sizes from [AC], [B] and [DE]. B examples (940 contexts) had no full privacy review; 7 contain a
URL [B]. E examples include MPs' names in public debate [DE].

## Known gaps

Gap classes follow the brief: data, measurement, method, interpretation, unanswerable.

| Product | Gap | Class |
|---|---|---|
| A | agencies outside SCB's database and Kolada | data |
| A | table is not an indicator; spirituality has no mapping | measurement |
| A | "current" defined two ways; projections count as current | method |
| A | importance against availability | interpretation |
| B | no county 2006–2019, no municipality | data |
| B | lexicon precision unknown; passion and identity mix employer self-description with demands | measurement |
| B | 2020 label switch, partial-year endpoints, per-archive dedup | method |
| B | ads against hiring and working conditions | unanswerable from ads |
| C | 10 municipalities missing an indicator | data |
| C | turnout year and mixed reference periods | measurement |
| C | no geographic null; no CI rebuild | method |
| C | lived similarity and identity | unanswerable |
| D | no opening hours, loans or pre-2014 series | data |
| D | visits include non-residents; borrowers include institutions | measurement |
| D | zeros as values, partial sums, unbalanced panel | method |
| D | belonging and loneliness | unanswerable with these data |
| E | session 1999/2000; no SOU or propositions | data |
| E | marker is not imagination; English text in DiVA | measurement |
| E | length confound, partial 2026, no validation, horizon asymmetry | method |
| E | "faded" and "supports" verdicts | interpretation |

## CONTINUITY claims checked

| CONTINUITY says | Finding | Right |
|---|---|---|
| B: "2,000,000 distinct texts in total" | 8,736,050 over 23 archives | the data; CONTINUITY was written after 5 archives |
| B: `--max-new 4` | `pipeline.yml:310` has `--max-new 3` | the code |
| B: passion +72 %, creativity +21 %, competence −19 %, stress −34 % | +71.3, +21.3, −18.7, −33.9 % | both, after rounding |
| C: 208 of 280, median 180 km; 7 and 3 exclusions | reproduced | CONTINUITY; the interpretation on the page is wrong |
| D: 1,171 → 1,054 service points, 63.6 → 48.7 M visits | unpaired national sums; the page shows paired 1,171 → 1,033 and 62.67 → 46.79 M | both, for different measures |
| E: "17.8 % (1994) to 21.9 %" | single year 1994 against partial 2026 | the data; five-year means give 17.9 → 20.6 % |
| E: "The year 2000 is left out: its archive is thin" | the 1999/2000 archive exists and is skipped by the regex at `futures_language.py:47` | the audit |
| E: DiVA "keeps Swedish abstracts" | keeps records whose first `dc:language` is Swedish and joins both descriptions (`harvest.py:61`) | the audit |

## Audit disagreements resolved

| Point | Reports | Resolution |
|---|---|---|
| Kolada terms | [AC] verified on kolada.se/om-oss/api; [DE] marked them unverified | [AC] is right: it read the official terms. Free use, attribution "Källa: Kolada", derived data must not name Kolada as source. |
| Trafiklab GTFS Sverige 2 licence | [AC] unverified; [DE] CC0 1.0 | [DE] is right. Own check 2026-10-20 of `trafiklab.se/api/gtfs-datasets/gtfs-sverige-2/`: "available under the CC0 1.0 Universal (CC0 1.0) Public Domain Dedication license". Static data needs an API key; Bronze allows 50 calls a month. |
| Line numbers in `export_belonging.py` and `mart_sweden_measurement_items.sql` | audits cite 104, 110, 62 | re-read: 110, 113, 50 |
