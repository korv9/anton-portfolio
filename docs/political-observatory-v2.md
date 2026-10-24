# Political Observatory v2

Implemented on 16 October 2026. The [audit](political-observatory-v2-audit.md) records the
dataset inventory and keep/improve/consolidate decisions for the previous visualizations.

## Workspace and routes

| Area | Address | Primary comparisons |
| --- | --- | --- |
| Overview | `#politik` | Survey trends, election allocation, appointment ballots, latest-session similarity, budget differences, speech activity |
| Elections & Voters | `#politik-val` | SCB PSU estimates and margins, successive observations, election vote/seat shares, historical seat lines |
| Parliament & Governments | `#politik-riksdag` | Appointment matrix, weighted pair similarity and history, party cohesion/participation, government membership, decision evidence |
| Economy & Policy | `#politik-budget` | Exact-year government/opposition proposals, adopted-frame metadata, actual outturn, existing OECD comparisons |
| Debates & Legislation | `#politik-tal` | Topic shares, directed replies, speech activity, source readers, candidate decision connections, study/bill citations |

`PoliticsProduct.tsx` keeps the existing research views and readers. The former four-tab
composition is no longer rendered. `#politik-kluster` retains the experimental maps;
`#politik-valjarna`, `#politik-roster`, `#politik-budget-detalj`, `#politik-skatter`,
`#politik-partier`, `#politik-mandat`, `#politik-sakdebatter`,
`#politik-partiledardebatter`, `#politik-debatt`, `#politik-utredningar`, `#politik-sok`,
`#politik-nyheter`, `#politik-modell`, `#politik-utforska` and `#politik-kallor` remain
reachable. `#politik-tal-detalj` preserves the older configurable topic view. Existing
aliases still resolve through `router.ts`; the old tax address now opens the complete tax tool.

`frontend/src/politik/workspace/` owns the five pages, decision explorer, filters, contracts,
aggregation helpers and scoped CSS. It reuses `Feature`, `Select`, `RankBars`, `Dumbbell`,
`MultiLineChart`, `SeatLines`, party identity and the existing greige/Helvetica tokens.
The twelve-column grid collapses to a single column on phones. Dense matrices scroll inside
their own containers. Cells expose counts on focus, mouse hover and selection; tables keep
row/column labels. New styles do not target the homepage or other projects.

## Filter contracts

- `partier` follows navigation between areas and retained research views. In ordinary
  decision details it highlights parties without dropping votes whose party records are absent.
- `fran`/`till` identify survey/election calendar years, or parliamentary session **start
  years** on parliamentary pages. Survey dates are not inferred from sessions or governments.
- `riksmote`, `omrade`, `regering` filter compatible parliamentary counts. Government joins
  use `start_date <= vote_date < end_date`. The decision-session choices use actual
  government/issue coverage, including sessions containing a change of government.
- `par` selects a party pair; `rost` selects a decision. `statsrost`, `kandidat`,
  `statsfran`, `statstill` belong to the appointment matrix and have independent period controls.
- Budget `ar`/`aktor`, survey `osakerhet`, debate `ledardebatt`/`amnesgrund`, and experimental
  `experiment` are local. Area navigation drops unrelated local state while retaining context.
- Coverage-series charts explicitly state which filters apply. The reply matrix has its own
  debate selector. Survey and budget observations are never filtered by incompatible vote keys.

## Published data and build

The new contract is `parliament/workspace/index.json`: schema version, export date, input
SHA-256 values, government terms, appointment ballots, contextual pairs, cohesion counts,
decision coverage and per-party/session speech activity. Historical session
and party-pair marts supply pre-aggregated counts for the browser.

`parliament/workspace/decisions/<session>.json` is fetched only for the selected session.
The committed snapshot has 33 shards and 22,680 substantive roll calls; the largest shard is
under 1 MB uncompressed. Totals that do not cover all 349 seats are flagged, not repaired.

```powershell
python platform/ingest/riksdagen/formation_ingest.py
python platform/publish/politics_workspace.py --as-of 2026-10-16
npm run check
npm run build
```

The standalone exporter works offline from existing JSON/Parquet. Its committed contextual
coverage is **2024/25–2025/26**: 840 pair/context groups and 240 party/context groups.
`export_parliament.py` passes its tested warehouse connection to the same exporter after
writing the parliamentary contracts; this uses all available `gold.fct_party_roll_call`
counts. `decision_coverage` comes from dated votes, not session-start government labels.

New dbt models (deleted on 2026-10-23, after the workspace export was removed):

| Model | Grain |
| --- | --- |
| `fct_prime_minister_ballot` | Official ballot date/key |
| `fct_prime_minister_party_vote` | Ballot × party, with original source label |
| `mart_party_pair_context` | Session × vote-date government × issue × unordered party pair |
| `mart_party_cohesion_context` | Session × vote-date government × issue × party |

The parliamentary pipeline verifies the curated sources before dbt. Seed keys, relationships,
categories, counts and the rejection rule have dbt tests. Context SQL and offline aggregation
are checked with hand-worked fixtures. Delivery ownership is `public-data`; the baseline
spec excludes `parliament/workspace/*`. New artifacts must enter an approved release before
production use. The frontend retains the existing manifest pinning and integrity checks.
No release was published or deployed during this task.

## Appointment coverage and provenance

The matrix contains ten reviewed records from **2 October 2014 to 15 October 2026**, including
the 2018 incumbent check. It excludes no-confidence motions. Earlier ballots are absent and
coverage after 2022 is not claimed exhaustive. The
[Riksdag archive](https://www.riksdagen.se/sv/sa-fungerar-riksdagen/demokrati/sa-bildas-regeringen/tidigare-regeringsbildningar-och-statsministrar/)
and official protocols/news provide the sources. Each CSV record carries a URL, SHA-256,
extraction method and qualification. The verifier downloads/cache-checks official documents
and compares text-PDF tables with reviewed seeds. Scanned 2022 and HTML records are manually
curated against their linked sources; source changes require a documented review.

Rejection requires **at least 175 no votes**, not 175 affirmative votes. Approval and subsequent
installation are separate: the 24 November 2021 proposal was approved but the proposed S+MP
government did not take office. Recorded historical mistakes in a member's vote are not corrected
to presumed intentions. FP is canonical L, with its original label retained; independents remain
separate in detailed counts.

Matrix cells distinguish yes, no, abstain, all-absent, mixed present positions, explicit
non-representation and unavailable records. Missing rows are never interpreted as abstention
or proof that a party was unrepresented. A party with both present and absent members retains
its present vote category; the exact absent count remains available in the drill-down.

## Measures and relationships

- Similarity: same unique plurality position / comparable substantive roll calls. Yes, no
  and abstain are distinct comparable positions. Ties, all-absent and missing party records
  are excluded pairwise. Counts pool across contexts before division; percentages are not
  averaged. The heatmap and pair trend use a 0–100% scale. Similarity is not ideological distance.
- Cohesion: plurality-aligned cast member-votes / cast member-votes on roll calls with a
  unique plurality. **Participation:** present / eligible member-votes, with abstention counted
  as present. Mixed roll calls are counted separately, including tied splits.
- PM-party alignment: equal yes/no pluralities / comparable yes/no roll calls, matching the
  PM's historical party. This is a recorded party position, not an independently measured
  official government preference. Abstention is excluded from this measure.
- Budget difference: party proposal minus government proposal for the same budget year
  and expenditure area, displayed in SEK billion. Actual outturn is separate, nominal and
  not inflation-adjusted. Missing proposals are absent, not zero.
- Debate topics: selected-party utterances weighted equally across each debate's assigned
  issues / all selected utterances in the session. Unassigned/excluded utterances stay in the
  denominator. The default uses committee/report-title matches; lexical candidates require
  an explicit toggle. Neither is a confirmed procedural or causal link.
- Decision evidence: exact session/vote key → unique decision point → explicitly cited
  bill; bills' preparation citations → studies where the delivered recent-bill register has
  coverage. Ambiguous multiple-point vote links are not expanded into inflated counts.
  Semantic speech candidates retain their experimental label and similarity value.
- Policy navigation: `dim_issue` maps committees to issues and expenditure areas. It makes
  related votes, budgets and debates reachable without asserting equivalence between their measures.

## Limits and verification

The government seed starts in 1991. Its agreement names describe term metadata, sometimes
only part of a term; the workspace does not infer dated support or opposition from them.
Election allocation is labelled separately from subsequent membership changes. The government
snapshot is dated 28 September 2026 and retains its recorded caretaker status; it is not a live feed.
Budget years and expenditure classifications have documented gaps. Semantic speech retrieval
and bill/study evidence cover only their existing delivered subsets.

Existing debate embeddings/maps remain optional experiments. No additional eight-party UMAP,
forecast, semantic join presented as fact, or paid infrastructure was added.

Verification results and file protection checks are recorded in the audit's implementation
section. Visual evidence is under `artifacts/politics-v2/`; it includes the five desktop/mobile
pages and the official scanned 2022 ballot table. Full historical warehouse ingestion was not
rerun: the local checkout had no full warehouse. The targeted formation dbt build and real
context SQL on fixtures were run, alongside the existing data and frontend suites.
