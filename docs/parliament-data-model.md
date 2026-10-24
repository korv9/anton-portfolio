# Parliament: elections, government and the Riksdag's decisions

The parliament exports (`frontend/public/data/parliament/*.json`) are built from this model.
The Political Observatory pages that showed them were withdrawn on 2026-10-21; the chart feed
reads some of the files. The model covers the following source periods, with further coverage
limits documented below:

| Part | Source | Period |
|---|---|---|
| Roll calls, every member's vote | Riksdagen, `votering-<rm>.csv.zip` | 1993/94 to now, 33 sessions, 22,900 roll calls, 8 million votes |
| Committee reports (title, committee, decision date) | Riksdagen, `dokumentlista` | 1993/94 to now |
| Election results and seats | SCB (ME0104), Valmyndigheten for elections SCB has not yet published | 1973 to 2026 |
| Party preference survey (PSU) | SCB (ME0201, Vid10) | 1972 to the latest May or November survey |
| Governments and their agreements | `seeds/parliament/governments.csv`, a source per row | 1991 to now |
| Government-formation news | Riksdagen's own news items | since the latest election |
| Speeches | Riksdagen, the site's speech index | 1993/94 to now |
| Budget outturn per expenditure area | Statskontoret | 1997 to 2025 |

Not yet even: the government and party **budget frames** (FiU1) are machine-readable for
2007/08, 2009/10, 2012/13–2013/14, 2016/17–2019/20 and 2022/23–2025/26. For 2020–2022 the
Riksdag's HTML carries no tables, and before 2007 the comparison tables have other headings.

## Layers

```
ingest/riksdagen/history_ingest.py   votes/<rm>.csv.gz, reports/<rm>-<page>.json
ingest/elections/elections_ingest.py scb/election_*, scb/psu, val/<val>/RD_S.json, riksdagen/formation/
models/bronze/parliament/stg_*       one row per source row; the roll-call layouts of different years unified
models/silver/parliament/int_*       roll calls and each party's position on them
models/gold/parliament/              dims, facts and marts below
publish/export_parliament.py         parliament/*.json and parquet/parliament_roll_calls/
```

## Tables

| Table | Grain | What |
|---|---|---|
| `dim_government` | government | prime minister, parties, dates, agreement, status |
| `dim_parliament_session` | riksmöte | dates, the election it followed, the government at its start |
| `dim_committee` | committee | current and former committees, each assigned to an issue |
| `dim_issue` | policy issue | committees, expenditure areas, welfare indicators |
| `fct_roll_call` | session × `roll_call_id` | report, committee, issue, yes/no/abstain/absent, outcome, the government's position and whether it won |
| `fct_party_roll_call` | session × `roll_call_id` × party | the party's votes, position, unity, role that day |
| `mart_party_session_record` | session × party | attendance, unity, winning side, voting with the government |
| `mart_party_pair_session` | session × party pair | share of decisions with the same position |
| `fct_election` | election × party | votes, share, seats, source |
| `fct_election_municipality` | municipality × election × party | votes, share |
| `fct_party_poll` | survey month × party | share, margin of error, changes |

Keys shared with the rest of the platform: `party` (one spelling: FP is L, KDS is KD),
`session` ('1999/2000' written in full), `issue_key`, and `indicator_key` into the welfare
model.

## Definitions

- **Roll call.** One vote id can carry two roll calls: on the matter (sakfrågan) and on the
  reasons given for the decision (motivfrågan). `roll_call_id` is the vote id plus `:motiv`
  for the latter; `is_substantive` marks decisions. The marts count decisions only.
- **A party's position** is what most of its present members voted; an even split is `split`.
- **The government's position** is that of the prime minister's party that day.
- **Role**: `government`, `agreement` (a written agreement with the government, such as the
  Januari- and Tidö agreements) or `opposition`, on the date of the roll call.

## Tested against

- The party vote counts of 2024/25–2025/26, built independently for the evidence layer:
  11,488 of 11,488 party results identical.
- Valmyndigheten against SCB for 2022: the same votes and seats for all eight parties.
- Every election fills 349 seats (350 in 1973) and shares add to 100.
- Every roll call lists 349 members; three in the source do not and are flagged.
- Each PSU survey adds to 100.

## Caveats

- Linking speeches to issues uses the debate title, which equals the committee report's title
  for about 45 % of issue-debate speeches; the rest are not counted per issue.
- The welfare indicators shown on an issue page describe the area. They are not effects of
  the decisions beside them.
- SCB counts Ny demokrati's votes (1991, 1994) among other parties; its seats are shown.
- PSU is a sample survey with a margin of error of about ±1 point for the largest parties.

## Running

```bash
npm run parliament          # fetch, dbt build (tag:parliament), export
npm run parliament:build    # build from the files already fetched
```

## Government studies

`platform/ingest/riksdagen/studies_ingest.py` fetches the SOU and Ds series (from 1995) and
Riksrevisionen's audit reports, and reads every government bill since 2006/07: its committee
reports and the studies its section "Ärendet och dess beredning" names (in a budget bill, per
proposal). Each link keeps the sentence that makes it.

| Table | Grain |
|---|---|
| `dim_study` | a study: SOU, Ds, RiR, or a ministry memorandum a bill names |
| `fct_bill` | a government bill |
| `fct_bill_report` | a bill and a committee report it was dealt with in |
| `fct_bill_study` | a bill and a study it names as preparation, with the sentence |

`studies.json` holds the latest studies and what they led to, and the studies behind every
decision it lists. Budget and spring bills are left out of that per-decision link, since they
name hundreds.

### What counts as a complete session

`platform/ingest/riksdagen/studies_ingest.py` reads every document in Riksdagen's bill list and
writes a coverage report per session, `studies/coverage/<session>.json`: each listed document
with its status, source URL and, on failure, the error. A session gets a completion record only
when the report, the preparation rows and the complete list files all match their hashes.
Missing and failed bills are kept as `pending_bills`; an attempt that leaves any ends in an
error and stops dbt and publication for the subject. Progress is saved every 25 documents, so a
restart reuses what was already read.

Two cases are handled without failing the session:

- Annexes with no status page. A 404 from `dokumentstatus` is recorded as
  `unavailable_attachment` only when the list's own metadata shows an annex: a `d` suffix with
  a number, a related main document in the same list, the same session and designation, and
  the annex marker. The main document must have valid preparation in the same attempt. The
  case that prompted the rule is 2010/11: eight listed parts, GY03101d2 to GY03101d9, of
  *Årsredovisning för staten 2010* (GY03101), all 404 while the main document answers 200. The
  annexes get no preparation row of their own and are tried again at the next historical
  revision. Any other 404, a 503, a timeout, broken JSON, a wrong document identity or empty
  text is still an error.
- Documents with no embedded HTML. Sixteen documents from 2014/15 came back with identity
  and committee links but no text. The ingest then reads the main PDF from Riksdagen's file
  host, and requires a matching document identity and title and exactly one main PDF. Empty or
  invalid PDF text is an error. The bytes, URL and hash are stored like any other raw file
  (`pypdf` is pinned in `platform/requirements.txt`).

## Parties: colours, logos and the party page

`frontend/src/parties/identity.tsx` holds each party's identity, used everywhere a party is
shown in charts (`frontend/src/charts/`, `frontend/src/report/board/`):

- `color`: the party colour as Swedish media and Wikipedia draw it (S #E8112D, M #52BDEC,
  SD #DDDD00, V #DA291C, C #009933, KD #000077, MP #83CF39, L #006AB3), for filled areas;
- `line`: the same hue darkened to at least 3:1 against the page, for lines, text and small
  marks (V darker still, so it does not read as S);
- `ink`: the text colour on `color`;
- `logo`: the party's current mark as Riksdagen shows it on *Ledamöter och partier*
  (media.riksdagen.se, 240 px WebP), in `frontend/public/logos/parties/`.

Because every party has its own colour, charts of parties are no longer limited to five
series.

The party pages were withdrawn with the observatory. What a party page gathered is in these
files: `now.json` (result, poll, role),
`elections.json` and `polls.json` (support over time), `sessions.json` (governments it sat
in or supported, voting record, agreement with each other party in the latest session),
`issues.json` (record per issue, speeches) and `taxes/decisions.json` (its vote on each tax
decision).

## Prime-minister ballots and party context

Four Gold models add source-backed appointment ballots and contextual party comparisons:
`fct_prime_minister_ballot`, `fct_prime_minister_party_vote`, `mart_party_pair_context`,
and `mart_party_cohesion_context`. Their workspace export was removed on 2026-10-22; the
models remain with their tests. The offline committed snapshot limits detailed party
context to 2024/25–2025/26, while the
existing session-pair mart still covers 1993/94 onward. Ten reviewed appointment/incumbent
ballots cover selected dates in 2014–2026, with earlier gaps retained. Agreement metadata
in the existing seed is not evidence of support on every date; the models keep it
separate and join government membership by exact vote date.

The tests cover appointment totals and the rule that a candidate is rejected by 175 no votes,
pairwise denominator pooling, missing, tied and all-absent positions, half-open government
dates and unique joins. Participation, cohesion and PM-party alignment use separate
denominators. Similarity is not read as ideology or cooperation, and historical snapshots and
candidate document relationships stay labelled.

## Politics metrics

The withdrawn Political Observatory computed these metrics; the definitions apply to the
parliament exports and to any page that reads them again.

| Metric                   | Definition                                                                                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Party position           | The vote most of the party's members cast in a roll call, as Riksdagen reports it.                                                                                                  |
| Party cohesion           | Cast votes (yes, no, abstain) by the party's members that match the party position, of all their cast votes.                                                                        |
| Party similarity         | Of the roll calls where both parties had a position, the share where it was the same.                                                                                               |
| Polarisation (roll call) | 1 − (members in the largest group of parties with the same position) / (members of all parties with a position). 0 when all parties agree, about 0.5 at an even split.              |
| Polarisation (area)      | The mean polarisation of the roll calls prepared by that committee.                                                                                                                 |
| Close vote               | A roll call where \|yes − no\| / (yes + no) < 10 %.                                                                                                                                 |
| Topic share              | The learned issue lexicon (log-odds with an informative Dirichlet prior, about two thirds right on held-out speeches) applied to the words; each topic's share of the scored words. |
| Distinctive words        | tf-idf per party and party-leader debate: term frequency per 10,000 words × log(documents / documents with the term); names left out.                                               |
| Term growth              | Per 10,000 words in the issue debates, the latest riksmöte against the three before; ratio smoothed by +0.5 per 10,000 words; stems in at least 25 speeches.                        |
| Member deviation         | Cast votes that differ from the party position, of the cast votes where the party had one. Absence and deviation are not opposition by themselves.                                  |
| Voting map               | PCA of the parties' positions over the roll calls (yes 1, no −1, abstain 0), centred per roll call.                                                                                 |

### Data quality

Before any metric, the observatory's `cleanVotes` (removed with the page in 35b90a67) dropped
duplicate decision points, roll calls where no party had a position, and roll calls with fewer
than 100 cast votes, and the page reported how many of each it found. Members who changed party
are compared with the party they belonged to at each vote.

### Design decisions

Heavy text processing runs once in Python and ships as compact JSON. The observatory computed
the vote metrics in the browser from the per-session indexes, so they stayed transparent and
testable. Party colours and logos come from one config (`frontend/src/parties/identity.tsx`).
