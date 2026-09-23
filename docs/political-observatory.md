# Political observatory

Update: the RFC/budget revision separates Allegoria from the political law view and adds corpus/method selection. See [current audit](rfc-and-budget-audit.md). The design below documents the preceding integration pass.

A static research dashboard joining the party-leader analysis and Allegoria. No backend, live parliamentary API, paid model calls or deployment was added. Interface and explanation are English; source quotations stay Swedish.

## Layout sketch and implemented interaction

```text
POLITICAL OBSERVATORY
[Imported speeches] [Issue speeches] [Roll calls] [Provision snapshots]
[Votes & decisions] [Speech archive] [Meaning & law] [Data & methods]

VOTES: session / committee / party for detail
┌ Party position distribution ┐ ┌ Pairwise agreement matrix ┐
└ Yes / no / abstain          ┘ └ Click → paired denominator ┘
┌ Internal cohesion + recorded attendance, all eight parties ┐
└ Searchable decision list ───→ exact proposal and all votes ┘
                               citations / reservations / speech candidates

ARCHIVE: leader or issue debate / session / title
debate list → party speech/reply bars → search full transcript → original source

MEANING: engine scenario → separate direction result
evidence readiness → two unreviewed quoted proposals
law pool / title / provision search → original snapshot + hash
political summary ↔ proposed law excerpts (two documented cases)

Below the observatory: existing UMAP and budget/debate dashboard.
```

## KPIs to prioritise

The strongest portfolio demonstration is the drill-down from a graph to the exact parliamentary proposal, named votes and original source. It shows data modelling and evidence handling as well as visualisation.

| Question | Metric and denominator | Visual | Status |
| --- | --- | --- | --- |
| How did each party vote? | Modal cast position per imported roll call | All-party stacked bars | Implemented |
| Which parties vote together? | Same yes/no position / calls with both yes/no | Interactive 8×8 matrix, numerator and denominator | Implemented |
| How unified are party votes? | Sum of largest cast-vote group per call / all cast party votes | Cohesion bars | Implemented; weighted by cast votes |
| How much recorded participation? | Cast / (cast + recorded absences) | Numeric attendance beside bars | Implemented; pairing not known |
| Who contributes to a debate? | Imported speeches and reply flags by party | Bars + full source passages | Implemented; not speaking time |
| Where do words and budget frames differ? | Lexicon share minus expenditure share | Scatter, divergent bars, heatmap, history | Existing dashboard, budget year corrected |
| What language groups emerge? | Word-weighted topic share; ungrouped share | Existing UMAP + topic bars | Existing model; not ideological distance |
| Does an amendment restrict permitted action? | Separate tightening / loosening / neutral counts from reviewed slot changes | Future actor × legal area small multiples | Engine included; political aggregate withheld |
| How reliable are interpretations? | Reviewed pairs / eligible candidates; reviewer agreement | Future coverage funnel + disagreements | Requires independent annotations |

Do not net tightening and loosening into one score. Do not equate a yes vote with supporting every referenced law: the committee proposal may reject a motion. A semantic passage match is a retrieval candidate, not a contradiction or honesty score. Repeated roll calls are not unique laws.

## Data architecture

- `public/data/politics/parliament/`: every file from the upstream frontend export, preserved verbatim (debates, issue debates, activities, votes, policy documents, laws, budgets, model outputs).
- `public/data/politics/decisions/<session>/index.json`: lightweight roll-call index and party aggregates. Each roll call has a separate detail JSON including members, point text, citations, reservations and retrieval candidates.
- `public/data/politics/laws/`: two independently browsable Allegoria provision pools, sharded by document. v1: 1,952 provisions / 50 documents; v2: 18,836 / 466. Overlap exists; 516 is a snapshot count, not distinct laws. The broader v2 source pool has 496 documents, of which 30 lack parsed provisions.
- `public/data/politics/catalog.json`: source Git revisions, file sizes and SHA-256 checksums. 3,819 indexed files, about 557 MB. Data is fetched per selected view/document rather than loaded as one bundle.
- `data/allegoria/`: source snapshots and draft annotated corpora for offline work. Not served by Vite's public directory.
- `packages/meaningquality/`: actual standalone Python engine, copied from Allegoria, with its specification and documentation. No dependency on a model service. It consumes structured annotations, not arbitrary raw speech.
- `src/politics/`: data loader/types, voting measures, decision explorer, transcript archive, law/engine browser, and legislative excerpt comparisons.

Join votes by `vote_id`, point evidence by `point_id`, and legal provisions by document plus provision identifier and version. Do not join by title similarity. Existing semantic links expose same-member status separately from party-level matches. Law snapshots are not verified historical versions for every speech date.

Pinned code: debate repository `14c58f251a1a619a4c07fe5aebd6042c7eaa0569`; Allegoria `402affd3a6f50d0d090133efc711034ac14e2d73`. Provision pools include local generated exports; row-level source hashes/versions and the generated catalog identify these data snapshots separately from code revisions.

All available frontend exports and the parsed Allegoria corpora are included. This does not mean every upstream embedding cache, database or private run is included. No employer data, environment secrets or paid-run logs were imported.

## Budget correction

Upstream selected the last matching expenditure-frame table, which was a later forecast year for 2022/23–2025/26. `scripts/politics_budget.py` now selects the exact following budget year before using the upstream parser. Example: 2025/26 health/social care GOV = 127,707 million SEK; S = 133,393 (GOV + 5,686). The S share is 8.4934%, not the old 7.8% based on the 2028 table.

Corrected active reports are in `public/data/debates/budgets/`. Originals remain under the Parliament snapshot for audit and must not be used as corrected reports. In particular, any upstream budget execution joins need their own year-alignment review before visualisation. See `year-selection-audit.json`. The 2017/18 and 2018/19 incomplete imports remain excluded from percentage charts; four further attempted sessions have no imported comparison table. Missing separate party frames are never inferred from GOV.

## Remaining evidence gaps

- Votes cover 2024/25 and 2025/26 only: 649 + 787 imported roll calls, not all parliamentary decisions.
- Zero validated vote-to-direction pairs. Need verified before/after enacted provisions, governed actors, annotated slots and independent review before party-level direction charts.
- Two quoted proposal annotations are assistant drafts. Ulf Holm (MP) describes a proposal attributed to S; it is not scored as an MP proposal.
- Two summary-to-proposed-law examples are not enacted-law comparisons. One requires review of interleaved two-column text extraction.
- Conformance tests validate engine behaviour on defined inputs, not interpretation accuracy on real politics.

## Local commands

The committed/static exports are sufficient to run the frontend:

```powershell
npm install
npm run dev
npm run build
npm run test:e2e
```

Offline regeneration needs Python with PyYAML, DuckDB and pandas, plus the local source exports and vote SQLite database:

```powershell
python scripts/build-politics.py --parliament ../partiledardebatt --allegoria .research/allegoria-current --local-corpus ../allegoria
python scripts/validate-politics.py
$env:PYTHONPATH = 'packages'
python -m meaningquality selftest
python -m pytest tests/python -q
```

The 25 Python tests originate from Allegoria's direction and standalone-package tests; only the direction import was adapted to the standalone package. Browser tests exercise all-party votes, session filters, exact decision evidence, both transcript archives, engine examples, law search, mobile layout and WCAG AA automated checks. Human legal review is still required for political direction analysis.
