# SWEDEN data source strategy

Phase 0B, 2026-10-20. Candidate sources for the five products, as the three Phase 0 audits found
them, plus one own check (Trafiklab). Each claim carries a source tag:

| Tag | Meaning |
|---|---|
| [AC], [B], [DE] | The three Phase 0 audit reports (projects A and C, B, D and E), 2026-10-20, read-only, code at `6560478a`. They and their query scripts are kept outside the repository. |
| [own] | Checked again by reading the cited lines or running Python over the committed files in `frontend/public/data/sweden/`. |
| [CI] | GitHub Actions run `39441114070`, "Build, store and publish the warehouse", sha `37167df9`, success, 2026-10-20. |

Nothing here is ingested beyond what the table marks as done. No endpoint or licence is added beyond what an audit or the own check
read. "Verified" means the access route was probed or the official page read. "UNVERIFIED" means it
was not, and the cell says which part is missing. A source with a verified endpoint and an
unverified licence is marked UNVERIFIED for the licence.

The Phase 0 repairs of existing data are done (71761a09, 3c185c71). Some questions below can
still be answered with data already on disk; the "existing data first" section lists them.

Two licence findings settled disagreements between the audits:

- Kolada: [AC] read the official terms on kolada.se/om-oss/api. Use is free with the attribution
  "Källa: Kolada", and derived data must not name Kolada as its source.
- Trafiklab GTFS Sverige 2: own check 2026-10-20 of `trafiklab.se/api/gtfs-datasets/gtfs-sverige-2/`
  found CC0 1.0. Static data needs an API key; the Bronze tier allows 50 calls a month.

## Priority classes

Essential: fills a gap that weakens a published claim, at low cost. High value: answers a research
question the product cannot answer today. Optional: useful context, or cost or access is not yet
clear. Reject: closed, personal, not reproducible, or duplicates an existing source.

## Source table

| Project | Existing data | Missing evidence | Candidate source | Research value | Access/licence | Complexity | Priority |
|---|---|---|---|---|---|---|---|
| A | SCB API v2 and Kolada catalogues | health statistics held outside SCB's database | Socialstyrelsen Statistikdatabas (endpoint Verified; licence UNVERIFIED) | Tests "health is measured elsewhere" directly | `sdb.socialstyrelsen.se/api/v1/sv/` returns 15 subject databases [AC]. CC0 only via a secondary search summary; page not opened | low, metadata only | Essential |
| A, D | same | wellbeing and social relations are near-empty in A | Folkhälsomyndigheten Folkhälsodata PxWeb (endpoint Verified; licence UNVERIFIED) | A: catalogue of wellbeing measures. D: county-level belonging-adjacent outcomes (low social participation, missing emotional support, low trust) | `fohm-app.folkhalsomyndigheten.se/Folkhalsodata/api/v1/sv/A_Folkhalsodata`, incl. `B_HLV/eSocialarel/aSocialarel/hlv1socxreg.px` [AC, DE]. HLV is 21 counties plus national, pooled 4-year windows 2004–2007 … 2019–2022 | low | High value; for D county level only, never joined to municipalities |
| A | same | one catalogue across all agencies | Sveriges dataportal, dataportal.se (UNVERIFIED) | Broadest list of what Swedish agencies publish | API endpoint not found; a search call returned 400 [AC] | medium | High value, after the endpoint is verified |
| A | Kolada carries 2 Brå KPIs plus NTU via Kolada | crime statistics | Brå (UNVERIFIED) | Safety domain | web query tool only, no public API per Polisen's open-data page [AC]; licence unverified | high, scraping | Reject direct scraping; use Kolada |
| A | none | culture statistics | Myndigheten för kulturanalys (UNVERIFIED) | Culture domain (6 SCB tables) | no API or download found [AC]; KU0501 Excel tables exist per a search result [DE] | medium | Optional |
| A | KB bibstat already ingested for D | culture measured elsewhere | KB bibstat as a catalogue entry (Verified, reuse) | Shows library statistics outside SCB's database | already fetched; CC0 stated in repo, KB says "free to use", explicit CC0 not re-verified [DE] | very low | High value, reuse |
| B | JobTech Taxonomy cached for legacy ids | harmonised field labels; SSYK-4; generic skills vocabulary | JobTech Taxonomy GraphQL (Verified API; licence UNVERIFIED) | Repaired the 2020 label artefact (done: `platform/seeds/sweden_language/occupation_field_crosswalk.csv`) | `taxonomy.api.jobtechdev.se/v1/taxonomy/graphql`, 31 versions 2021-03-05 to 2026-08-12 [B]. CC0 per repo comment; jobtechdev.se unreachable in the audit | trivial | Done |
| B | 23 regex-counted archives | an independent extraction of traits and skills | JobTech enriched historical ads `berikade/{kompletta,metadata,exempel}` (Verified listing; contents UNVERIFIED) | NLP validation; skills against traits | listing and sizes read: 2016 full 771.8 MB, metadata 151.2 MB, 1 % sample 8.1 MB [B]. CC0 per README. Trait fields not inspected | medium, about 150 MB a year streamed | High value; inspect the 1 % sample first |
| B | same | second rater for the lexicon | JobAd Enrichments API (Verified endpoints; licence UNVERIFIED) | Cross-validation on a sample | swagger v1.5.7 at `jobad-enrichments-api.jobtechdev.se`: `/enrichtextdocuments`, output `competencies`, `traits` [B]. Not independent of JobTech's model | low, sample only | High value, validation sample only |
| B | none | real occupation mix to weight ads | SCB Yrkesregistret AM0208 (Verified) | Occupation-adjusted trends against employment | PxWeb tables `YREG60BAS` 2020–2024, `YREG60N`, `YREG60`, `YREG37` (SSYK96, 2005–2013) [B]. CC0 | low; SSYK96 break in 2014 | High value |
| B | none | working conditions against what ads demand | Arbetsmiljöundersökningen (Verified) | Makes the ads/reality gap visible, descriptive only | PxWeb `AM0501A/ArbmiljoSSYK` (2024), `AM0501B/ArbmiljoYrk3` (2017, 2019, 2021) [B]. CC0 database; cite Arbetsmiljöverket | low; series break 2024 | High value |
| B | none | share of all vacancies that Platsbanken carries | SCB Lediga jobb (Verified) | Denominator context | TAB5531, TAB6400/TAB6606, TAB4299–4301 [B]. CC0. No occupation | low; break 2024 | Optional |
| B | none | pay context | SCB Lönestrukturstatistik (Verified) | Bourdieu reading | TAB5932, TAB4265, TAB5696, 2014–2025 [B]. CC0 | low | Optional |
| B | none | shortage context | Arbetsförmedlingen Yrkesbarometer (UNVERIFIED) | context | taxonomy types exist; data endpoint not found [B] | unknown | Optional, verify first |
| B | none | shortage context | SCB TAB6545 (Verified) | context | two years only [B] | low | Reject for now |
| B | none | ads beyond Platsbanken | private boards (LinkedIn, Indeed) | coverage | restrictive terms [B] | high | Reject |
| B | none | who is hired | register microdata (MONA) | hiring outcomes | restricted personal data [B] | high | Reject |
| C | 12 Kolada and SCB indicators for one year | alternative feature sets; independent outcomes; within-municipality variation | SCB regional tables incl. DeSO/RegSO (Verified) | Turns one map into a family of maps | API v2 `?query=DeSO` returns TAB6638 [AC]; CC0 from `/api/v2/config`; 30 calls per 10 s | low to medium | Essential |
| C, D | Kolada via the welfare ingest | outcomes not used in clustering; typologies; library and participation KPIs | Kolada additional KPIs and `/v3/municipality_groups` (Verified) | Independent outcomes for C; second participation indicator for D (N09807, N09806, N09808, N09812, N09817, N09026, N09701, U09800) | `api.kolada.se/v3/kpi`, `/v3/data/kpi/{id}/municipality/{code}` [AC, DE]. Terms verified by [AC]: free, cite "Källa: Kolada", derived data must not name Kolada as source | very low | Essential for C; High value for D |
| C | Kolada turnout carried forward from 2022 | correct-year turnout | Valmyndigheten election results (endpoint Verified; files and licence UNVERIFIED) | Replaces the carried-forward value; 2026 election | `data.val.se` redirects to `data.val.se/val2026`, a JS app; file list not readable [AC] | low | High value |
| C | none | segregation indicators | Segregationsbarometern, Boverket (UNVERIFIED) | independent outcomes | run by Boverket since 6 May 2025; no download or API found [AC] | unknown | High value pending access; prefer SCB RegSO/DeSO directly |
| C | counties as the only regional grouping | commuting-based regions for the null model | SCB FA-regions (partly Verified) | Better "across region" baseline | appear as a region variable in AM9906 tables; correspondence file UNVERIFIED [AC] | very low | High value |
| C, D | crow-flies centroid distance; km² per service point | travel time | Trafiklab GTFS Sverige 2 (Verified) | Real travel time | own check 2026-10-20: CC0 1.0; static data needs an API key; Bronze 50 calls a month | high: routing engine, compute, maintenance | Optional; after the population grid |
| D | km² per service point | population-weighted distance to the nearest library | SCB population on 1 km grid, Statistik på rutor (partly Verified) | Access measure better than density | SCB open geodata page; download URL not fetched; CC0 via a search snippet [DE] | medium, geometry | High value |
| D | four bibstat terms | opening hours and staffless hours | KB bibstat `Open101–106`, `Open201–206` incl. `Open105`/`Open205` meröppet (Verified definitions) | Separates fewer buildings from fewer open hours | same API, `bibstat.kb.se/data?term=Open104&limit=20000`; 793 term definitions read [DE]; values not fetched | trivial | Essential |
| D | none | study circles as community spaces | Folkbildningsrådet (UNVERIFIED) | community spaces | no municipal open dataset found [DE] | unknown | Optional; Kolada N09701 covers it |
| D | none | trust and participation attitudes | SOM-institutet via SND | attitudes | restricted research access, microdata [DE] | high | Reject |
| D | none | youth participation | MUCF Lupp (UNVERIFIED) | youth | not checked; opt-in coverage [DE] | unknown | Optional |
| D | none | service-access analysis | Tillväxtverket Pipos (UNVERIFIED) | access | no official page found [DE] | unknown | Do not plan on it |
| E | speeches only | designed futures: problem, solution, alternatives | Riksdagen SOU and propositions (Verified) | Third corpus with its own denominator | `data.riksdagen.se/dokumentlista/?doktyp=sou&utformat=json` (4,958 SOU, 31,823 prop); bulk `sou-1990-1999.json.zip` 130 MB … [DE]. SOU from 1990 only | medium to high, about 1 GB streamed | High value, SOU first |
| E | speeches from 1993 | pre-1993 baseline | Swerik / Swedish Parliament Corpus (UNVERIFIED licence) | Speeches 1867 onward | GitHub release v2025.12.19; no licence file, API `license: null` [DE]; `riksdagen-records` about 8.4 GB | high | High value once the licence is confirmed; separate corpus |
| E | DiVA student theses | national academic coverage | SwePub (UNVERIFIED licence) | Fixes DiVA's institution bias | dumps, OAI-PMH, SRU, JSON API per KB page; no licence named [DE]; abstracts not confirmed | medium | High value after licence check |
| E | DiVA `studentThesis` | research publications | DiVA other OAI sets (UNVERIFIED) | academic futures beyond theses | sets not enumerated [DE] | medium | Optional |
| E | none | pre-1999 SOU | KB digitised SOU 1922–1999 (UNVERIFIED) | long-run policy design | no bulk endpoint verified [DE] | high, OCR | Optional; ask KB first |
| E | none | wider public discourse | Språkbanken Korp (UNVERIFIED) | newspapers, other corpora | corpus-specific licences [DE] | medium | Optional |
| E | none | party futures | Manifesto Project (UNVERIFIED) | party programmes | not checked [DE] | unknown | Optional |
| E | Riksdagen API | SOU from 2000 | Regeringen.se | duplicate | duplicates Riksdagen's API [DE] | – | Reject |

## The ten questions for Essential sources

| Question | Socialstyrelsen (A) | JobTech Taxonomy (B) | SCB regional (C) | Kolada extra KPIs (C, D) | bibstat opening hours (D) |
|---|---|---|---|---|---|
| 1 Research question | what Sweden measures, by agency | occupation key for standardisation | how the definition of similarity changes the map | independent outcomes; participation beyond libraries | does fewer service points mean less availability |
| 2 Missing evidence | health statistics outside SCB | harmonised fields 2020–2023 | alternative features | outcomes not in the 12 inputs | open and staffless hours |
| 3 Complements | yes, disjoint from SCB's database | required repair | yes | yes | directly |
| 4 Public access | API probed | API verified | API verified | API verified | API verified |
| 5 Licence | CC0 via secondary summary, UNVERIFIED | CC0 per repo, UNVERIFIED | CC0, verified | Kolada terms, verified | "free to use", CC0 not re-verified |
| 6 Coverage | per database, not verified per table | versioned since 2021 | 290 municipalities, annual; DeSO/RegSO revised 2025 | annual, municipal | 2014–2025 per organisation |
| 7 Join key | domain seed by subject | concept id, legacy AMS id, SSYK | 4-digit municipality code | SCB municipality code | sigel to municipality |
| 8 Bias | each agency structures its catalogue differently | 2020–2023 labels sit outside it | survey noise in small municipalities | Kolada recomputes and carries values forward | self-reported |
| 9 Cost | metadata only | trivial | small JSON | very low | near zero |
| 10 Gap understanding | turns "unmeasured in SCB" into "measured by agency X" | indirect | shows similarity depends on definition | widens "infrastructure" beyond one institution | splits buildings from hours |

## Existing data first

These questions need no new source:

- A: measures per table from the 1,299 metadata files; keyword validation of domains from titles.
- B: co-occurrence, SSYK-4 and employer controls on the 2023–2026 corpus already in
  `warehouse/raw/jobtech/cluster-corpus/`.
- E: validation sample, relative horizon, party harmonisation.

Done since 2026-10-20 (71761a09, 3c185c71): B's label crosswalk and complete-year endpoints,
C's geographic null and sensitivity checks, D's zero and partial-sum handling and balanced
panels, E's per-word marker rate and Swedish-only DiVA abstracts.

## Cost and maintenance

Repairs are dbt and export changes measured in minutes. B's sub-lexicon recount re-streams 23
archives over several weekly runs with `--max-new 3`, about 2–3 hours of CI in total, without
storage growth [B]. Enriched JobTech metadata adds about 1.5 GB of transient download per full pass.
SCB, Arbetsmiljöverket, Kolada and bibstat additions are kilobytes to low megabytes. SOU and
propositions mean about 1 GB streamed. Swerik (about 8.4 GB) and GTFS routing are the only sources
with high storage or compute cost, and both wait on a prerequisite.
