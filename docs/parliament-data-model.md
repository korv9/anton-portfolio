# Parliament: elections, government and the Riksdag's decisions

The politics hub on the site (`#now`, `#issue-<key>`) is built from this model. It covers the
same period evenly for every part:

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

The site shows the latest studies and what they led to on `#now-studies`, and the studies
behind every decision it lists. Budget and spring bills are left out of that per-decision
link, since they name hundreds.

## Parties: colours, logos and the party page

`frontend/src/parties/identity.tsx` holds each party's identity, used everywhere a party is
shown (seat bar, party pickers and charts, vote lists, tables, BudgetLab):

- `color`: the party colour as Swedish media and Wikipedia draw it (S #E8112D, M #52BDEC,
  SD #DDDD00, V #DA291C, C #009933, KD #000077, MP #83CF39, L #006AB3), for filled areas;
- `line`: the same hue darkened to at least 3:1 against the page, for lines, text and small
  marks (V darker still, so it does not read as S);
- `ink`: the text colour on `color`;
- `logo`: the party's current mark as Riksdagen shows it on *Ledamöter och partier*
  (media.riksdagen.se, 240 px WebP), in `frontend/public/logos/parties/`.

Because every party has its own colour, charts of parties are no longer limited to five
series.

`#parties` shows a card per party, sorted by the latest election. `#parties-<code>` gathers
what the other pages have on one party, from the same files: `now.json` (result, poll, role),
`elections.json` and `polls.json` (support over time), `sessions.json` (governments it sat
in or supported, voting record, agreement with each other party in the latest session),
`issues.json` (record per issue, speeches) and `taxes/decisions.json` (its vote on each tax
decision).
