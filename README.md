# Anton Ernstsson · data portfolio

A portfolio site with analytical products built on Swedish and EU public data, and the data
platform that produces them. Live at https://antonernstsson.com, hosted on Cloudflare
(Workers static assets; see [hosting](docs/deploy.md)). Swedish is the default language,
English one click away.

## What is on the site

The start page is the profile: who, experience with the core stack, selected work, about.
Each project opens on its own page with one first screen (name, question, finding), then the
main evidence, explore and method. See [site structure](docs/site-structure.md) and the
[design system](docs/design-system.md).

| Project | Address | Documentation |
|---|---|---|
| Swedish politics in numbers | `#politik` | [parliament data model](docs/parliament-data-model.md), [news](docs/news.md), [taxes](docs/taxes.md) |
| EU AI Act Observatory | `#ai-act` | [AI Act](docs/ai-act.md), [the Riksdag and AI](docs/ai-politics.md), [AI in job ads](docs/ai-jobs.md) |
| The job market in job ads | `#jobb` | [job market](docs/job-market.md), [job-ad clustering](docs/job-market-clustering.md) |
| Symbolic Atlas | `#symbolic-atlas` | [Symbolic Atlas](docs/symbolic-atlas.md) |
| How is Sweden doing? | `#sweden` | [welfare data model](docs/welfare-data-model.md), [analysis guide](docs/analysis-guide.md) |
| Concept Constellation and Journey | `#concept-journey` | [concept layer](docs/concept-layer.md), [constellation](docs/concept-constellation.md), [journey](docs/concept-journey.md) |
| Philosophy Atlas | `#philosophy-atlas` | [Philosophy Atlas](docs/philosophy-atlas.md) |
| Under the hood | `#data-constellation`, `#quality`, `#data-model`, `#er` | [Data Constellation](docs/data-constellation.md), [quality and validity](docs/quality-and-validity.md), [gold semantic model](docs/gold-semantic-model.md) |

Other work (DrugComb, Allegoria, the thesis, Homie, DiVA) has its own pages; see
`platform/products/`.

## How the data flows

Public sources → Python ingestion (raw files kept with provenance) → dbt on DuckDB (bronze,
silver, gold) → JSON and Parquet in Cloudflare R2 → React. Heavy text and ML work runs once in
Python and ships as compact files; the browser computes only cheap, testable metrics. See
[platform/README.md](platform/README.md), [storage and serving](docs/storage-and-serving.md)
and the [data dictionary](docs/data-dictionary.md). Scheduled GitHub Actions refresh jobs,
news, welfare and DiVA, build the warehouse and publish to R2.

### Politics metrics

**Definitions.**

| Metric | Definition |
|---|---|
| Party position | The vote most of the party's members cast in a roll call, as Riksdagen reports it. |
| Party cohesion | Cast votes (yes, no, abstain) by the party's members that match the party position, of all their cast votes. |
| Party similarity | Of the roll calls where both parties had a position, the share where it was the same. |
| Polarisation (roll call) | 1 − (members in the largest group of parties with the same position) / (members of all parties with a position). 0 when all parties agree, about 0.5 at an even split. |
| Polarisation (area) | The mean polarisation of the roll calls prepared by that committee. |
| Close vote | A roll call where \|yes − no\| / (yes + no) < 10 %. |
| Topic share | The learned issue lexicon (log-odds with an informative Dirichlet prior, about two thirds right on held-out speeches) applied to the words; each topic's share of the scored words. |
| Distinctive words | tf-idf per party and party-leader debate: term frequency per 10,000 words × log(documents / documents with the term); names left out. |
| Term growth | Per 10,000 words in the issue debates, the latest riksmöte against the three before; ratio smoothed by +0.5 per 10,000 words; stems in at least 25 speeches. |
| Member deviation | Cast votes that differ from the party position, of the cast votes where the party had one. Absence and deviation are not opposition by themselves. |
| Voting map | PCA of the parties' positions over the roll calls (yes 1, no −1, abstain 0), centred per roll call. |

**Data quality.** Before any metric, `cleanVotes` drops duplicate decision points, roll calls
where no party had a position, and roll calls with fewer than 100 cast votes, and the page
reports how many of each it found. Members who changed party are compared with the party they
belonged to at each vote.

**Design decisions.** Heavy text processing runs once in Python and ships as compact JSON;
vote metrics are cheap enough to compute in the browser from the per-session indexes, so they
stay transparent and testable. Party colours and logos come from one config
(`parties/identity.tsx`). Every chart has a text alternative, a table or labelled values, and
never relies on colour alone. The party, debate and member chosen are kept in the address.

## Run locally

```bash
npm ci
npm run dev        # http://127.0.0.1:5173
```

Before a push:

```bash
npm run check
npm run format:check
npm run test:unit
python -m pytest platform/tests -q
npm run test:e2e   # needs Playwright Chromium
```

Data is checked in, so the site builds with Node alone. To rebuild a subject, install
`platform/requirements.txt` and run its script, for example `npm run welfare`,
`npm run parliament`, `npm run ai-act` or `npm run symbolic:build`. `npm run data:build` and
`npm run data:check` rebuild and verify the gold and product exports.

## Repository

- `frontend/`: the React/TypeScript site (`src/`), its published data (`public/data/`) and
  tests (`tests/`).
- `platform/`: ingestion, dbt models, publishing, quality checks and their tests.
- `ml/`: the NLP/ML layer with its own environment and model cards.
- `docs/`: one document per product, plus design, structure and hosting.
