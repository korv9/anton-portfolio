# Political Observatory v2 audit and implementation record

Audience: readers comparing Swedish political parties, parliamentary records and public finances.
The workspace uses the existing greige tokens and Helvetica. Charts precede methodology;
source documents and uncertainty remain accessible. The homepage is protected.

## Architecture decisions

- Five areas: Overview, Elections & Voters, Parliament & Governments, Economy & Policy,
  Debates & Legislation. One shared party selection and URL-addressed local filters.
- Retain detailed readers, tax tools, seat calculator, model and clustering as secondary views.
- Reuse published Parliament, Gold, debate and budget artifacts. Build compact contextual
  summaries before delivery; never send individual historical voting records to the browser.
- Prime minister ballots need separate official sources: ordinary committee roll calls do
  not contain them. Publish verified ballots from 2014 onward; disclose earlier coverage gaps.
- Separate a party's plurality, internal split, abstention, absence and unavailable data.
  Appointment succeeds with fewer than 175 no votes, regardless of affirmative votes.
- Government-period context uses dates of votes, not the government at a session's start.
  Agreements in the old seed lack precise intervals; do not infer support on individual dates.

## Dataset inventory

| Artifact/model | Grain and coverage | Use and qualification |
| --- | --- | --- |
| `parliament/elections.json`, `fct_election` | Election x party, 1973 onward | Votes, share, allocated seats; NYD vote share unavailable separately in SCB |
| `parliament/polls.json`, `fct_party_poll` | SCB PSU survey month x party, 1972 onward | Survey estimates and supplied margins, distinct from elections |
| `parliament/now.json` | Dated election, government and recent-vote snapshot | Label snapshot dates; never imply a live feed |
| `parliament/sessions.json` | 33 sessions, party records and party pairs from 1993/94 | Historical substantive-vote similarity and activity |
| `parliament/issues.json`, `dim_issue` | 15 explicit committee/issue mappings | Issue joins to votes, expenditure areas and title-matched speech counts |
| `parquet/parliament_roll_calls` | Session x roll-call id | Substantive flag, date, committee and totals; compact export input |
| Gold `fact_party_vote` | Vote x party, delivered recent sessions | Individual party counts for contextual pairs and cohesion; bounded coverage |
| `seeds/parliament/governments.csv` | Government term from 1991 | Date context; seed agreement labels are term metadata, not dated support assertions |
| `gold/marts/budget-report.json` | Session x actor x expenditure area | Government and party proposals, adoption metadata, coverage; not spending outcomes |
| `gold/tables/fact_budget_outturn.json` | Year x expenditure area, 1997 onward | Actual spending; historical area definitions need separate treatment |
| `taxes/countries.json` | Country x year x tax code | OECD tax share of GDP, country groups and historical comparisons |
| `politics/parliament/debate-stats` | Debate and session, 1993/94 onward | Speech/reply counts, committee-document relationships and lexical candidates |
| `parliament/studies.json` | Study, bill and cited studies | Explicit preparation-section citations; document links do not establish causation |
| Political decision shards and Gold evidence marts | Vote/decision point/document | Vote distributions, sources, reservations, bills and speech candidates |
| Political topic/UMAP exports | Speech chunk/model/session | Existing experiments retained with their sample/model metadata |

No local DuckDB warehouse is present. Existing published Parquet and JSON provide a
reproducible offline build input. Source data is retained.

## Visualization decisions

| Existing visualization/component | Decision | Reason |
| --- | --- | --- |
| `SeatHistory` / `SeatLines` | Keep and integrate | Valuable historical representation, table and keyboard support |
| `PollTrend` | Replace on main paths | Reuse shared time-series chart with URL range and supplied uncertainty; avoid mouse-only readout |
| `ValjarnaTheme` configurable bars/columns/lines | Consolidate | One election/survey workspace with explicit measure and comparison dates |
| `VoteShares` | Retain secondary | Useful vote-kind distribution, distinct from cohesion and attendance |
| `VoteAlike` heatmap | Improve | Fixed 0-100 scale, sample counts, selected pair trend and contextual filters |
| `RosterTheme` rank comparison and record series | Consolidate | Similarity, cohesion and participation in one parliamentary workspace |
| `BudgetDifference`, `BudgetBoard`, budget detail | Keep and improve access | Correct proposal basis, source documents and expenditure comparisons |
| `SkatterTheme` | Keep inside Economy | Existing OECD groups, tax types, year and historical comparisons |
| `IssueAreas`, `FocusLines`, `TalTheme` | Consolidate | Debate distribution and session activity share an issue/session context |
| `Partiledardebatter` reply matrix | Keep | Real directed reply counts, source readers |
| `Sakdebatter`, `DebateView`, `DebateChat`, `SpeechBrowser` | Keep | Preserve primary text, speeches and per-point evidence |
| `TopicMatrix`, lexical comparisons | Keep secondary | Distinguish keyword matching from documented issue assignments |
| `StudiesPerYear`, `UtredningarTheme` | Improve access | Surface explicit study/bill/report/vote relationships alongside activity |
| `Partier`, party profiles | Keep secondary | Cross-dataset party research entry point |
| `SeatBar` calculator | Keep secondary | Existing interactive functionality, not a historical fact |
| `ModellTheme` prediction diagnostics | Keep secondary experiment | Do not mix prediction and descriptive dashboard facts |
| `NyheterTheme` | Keep secondary | Source dates and model-written summaries need their existing qualifications |
| `UtforskaTheme`, `KallorTheme` | Keep secondary | Download and methodology access |
| Old four-tab `Report` composition | Replace | Five analytical areas remove report-style sequencing and duplicate introductions |
| New prime minister voting matrix | Add | Official ballot counts with appointment rule, mixed positions and drill-down |
| Government membership matrix | Add | Dated terms; independent of abstention or voting similarity |
| Contextual party-pair trend and cohesion | Add | Explicit vote denominator and government/issue/session relationships |

## Implementation and validation

The five-area workspace is implemented. The retired four-tab `report/Report.tsx`, its unused
chart composition and CSS were removed; underlying data and detailed research views remain.
The shared time-series chart gained optional line breaks and a fixed upper bound. Isolated
survey intervals use whiskers. The homepage does not import this chart.

New source-backed seeds hold ten ballots and 83 party records. New Gold models cover ballot
facts, contextual party pairs and contextual cohesion. The offline export contains 22,680
substantive roll calls in 33 session shards, 840 pair/context groups, 240 cohesion/context
groups, 537 decision-coverage groups, 246 party/session speech summaries and nine government
terms. Full warehouse export uses tested historical party facts; offline detailed context
is explicitly limited to 2024/25?2025/26.

[Political Observatory v2](political-observatory-v2.md) specifies the routes, source coverage,
measure denominators, evidence boundaries, release ownership and reproduction commands.

Checks performed:

- TypeScript and the production build pass. Prettier passes. This repository has no ESLint
  dependency or configured lint command; no ESLint run is claimed.
- JavaScript unit suite: 104 passed, including weighted similarity, distinct cohesion
  denominators, context URLs, null contexts and missing-observation line segments.
- Python suite: 461 passed, two skipped. New tests exercise the real context SQL and the
  offline calculation on hand-worked votes, government-date boundaries, join uniqueness,
  missing/tied/all-absent positions and the committed contract.
- Formation dbt build: two seeds, two models and eight tests passed. The official-source
  verifier validated all ten documents. Existing unrelated dbt deprecation warnings remain.
- Initial full browser regression: 140 passed, two opt-in live tests skipped; one route test
  needed its obsolete report-class selector updated. The affected 22-test rerun passed,
  including the complete internal-link traversal, five-area desktop/mobile axe scans,
  readers, filters, decision links, historical government context and provenance download.
- Five desktop and mobile pages were opened and captured with Chromium. Mobile comparison
  labels and bars were inspected and corrected. Dense matrices scroll locally; no page
  overflow was observed. Final complete browser regression: **142 passed, two opt-in live tests skipped**.
  The complete Python rerun passed **461 tests, with two skipped**. Build, TypeScript,
  Prettier and all 104 JavaScript unit tests passed. Logs: `artifacts/politics-v2/final-*.log`.
- All 15 protected source hashes match the task-start baseline: homepage files, App,
  shared header, tokens and editorial styles are byte-identical. Existing changes from
  the earlier design-system task were preserved.

Known limits: pre-2014 appointment ballots are not digitized here; later selected ballots
are not claimed exhaustive. Detailed offline party context spans two sessions. Agreement
labels lack complete dated support intervals. Legacy semantic speech candidates and
bill/study links have bounded source coverage. No complete historical warehouse rebuild,
live R2 publication or production deployment was performed. Existing experimental debate
maps are retained; no additional small-sample party embedding was introduced.
