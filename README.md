# Anton Ernstsson — data portfolio

English-language React/TypeScript portfolio with a static Swedish political observatory, thesis case study and job-market report. No backend or live API is required. Hosted on Cloudflare Pages at https://antonernstsson.com (see [hosting](docs/deploy.md)).

The home page is Anton's profile and project directory. Each main project opens on its own hash-routed page: `/#politics`, `/#job-market`, `/#drugcomb`, `/#rfc-drift`, `/#thesis` and `/#homie`. Within politics, the tabs open decisions, speeches, budget proposals, a provisional language map and technical data. `/#budget-outturn` leads directly to the annual approved-versus-spent view. These routes work on static hosting without server-side rewrites.

See [report findings and coverage](docs/report-findings.md) for the budget, language and annual-account definitions and their limits.

## Run locally

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The political dashboard starts at `/#politics`.

```powershell
npm run build
npm run test:e2e
python platform/legacy/validate_politics.py
python platform/legacy/validate_gold.py
```

The browser tests require Playwright Chromium. `dist/` is the static output. Paths are relative and routing is by hash, so it works at the domain root, on `pages.dev` and in preview deployments.

## Latest report update

Six project products now have a shared directory: politics, job-market analytics, DrugComb, Allegoria RFC drift, the thesis and Homie API. See [product contracts and pipeline locations](platform/products/README.md).

The public entry at `/#data-explorer` is a speech browser: filter by party, parliamentary year and debate type, search speakers/titles/opening excerpts, read full speeches and move through their discussion in parliamentary order. Discovery cards are generated from existing source shards using `platform/legacy/build_speech_browser.py`, split by year to avoid downloading the entire index. Original quotations retain source encoding issues and link to Parliament for verification. Budgets, votes and legal sources have separate navigation; no unsupported speech-to-decision relationship is inferred.

Technical tables are now in a collapsed analyst section at `/#raw-data`, covering 31 gold tables and 22 DrugComb result tables. The DrugComb report at `/#drugcomb` compares published model evaluations across four generalisation splits and shows dataset composition. Its pinned upstream pipeline is included for inspection; raw training data and a newly executed training run are not included. Homie remains explicitly marked as partially implemented.

Use `npm run data:build` to regenerate gold and product exports, then `npm run data:check` to verify both. Politics is still built by the scripts in `platform/legacy/`; the job-market and welfare subjects are dbt models over DuckDB (see [platform/README.md](platform/README.md)).

Allegoria now has a separate compact RFC drift report at `/#rfc-drift`. The law tab contains source material only. Budget comparisons support separate party-leader/issue archives and exact/Swedish-stem matching, with eight-party spending summaries. See [audit, findings and reproduction](docs/rfc-and-budget-audit.md).

## Political observatory

See [architecture, KPI definitions, layout sketch and evidence gaps](docs/political-observatory.md).
The current reporting contract is the [gold semantic model](docs/gold-semantic-model.md), with 31 keyed tables, validated joins, metric definitions and source hashes. Frontend report views read gold marts; original evidence stays in source shards.

- All eight parties in vote distribution, pairwise agreement, cohesion and recorded attendance.
- 1,436 roll calls with exact committee proposals, individual member votes, citations and reservations.
- Full exported party-leader and issue-debate archives with transcript search.
- Searchable statute snapshots; the Allegoria meaningquality engine is demonstrated separately on RFC requirements.
- Existing UMAP and budget dashboard, with corrected exact-year budget table selection.
- Full upstream frontend export preserved alongside curated per-document files. About 557 MB of public political data; documents are loaded on demand.

The engine has no validated vote-to-direction pairs yet. Party-level tightening/loosening charts require versioned legal comparisons and reviewed annotations. Tests of engine rules do not validate political interpretations.

## Welfare: how Sweden is doing

Five public sources — SCB's labour force survey and population, Försäkringskassan's sick-leave statistics, Folkhälsomyndigheten's public health survey, the European Social Survey and Kolada — in one star schema with shared keys for region, period, sex and age. See [the welfare data model](docs/welfare-data-model.md) and [the analysis guide](docs/analysis-guide.md): which table for which purpose, and how each measure may be aggregated.

The politics hub (`#now`) puts the latest election, the government and its formation, the polls and the Riksdag's latest decisions on one page, with every roll call since 1993/94, every election since 1973 and SCB's party preference survey since 1972, and a page per policy issue that joins decisions, party votes, budget outturn, welfare statistics and debate. See [the parliament data model](docs/parliament-data-model.md).

The job market (`#job-market`) covers every job ad on Arbetsförmedlingen since 2020, not only IT: ads per month and occupation field, every occupation group year by year with the change on the same months a year earlier, counties, and conditions (employment type, working hours, required experience). The IT report on software and data roles is `#job-market-tech`. See [the job market](docs/job-market.md).

Political news from SVT, Sveriges Radio Ekot and the Government Offices (`#now-news`) is collected every three hours, tagged by party and topic, and shown on the government view and each party's page; only headlines, the feeds' summaries and links are kept. See [political news](docs/news.md).

The party page (`#parties`) has a card per party in its colour and logo; each leads to the party's own page (`#parties-s`, `#parties-m`, …) with its elections and polls, the governments it sat in or supported, its voting record and agreement with the other parties, its votes on every tax decision, and its record per issue. Party colours and logos are shared across the site from `frontend/src/parties/identity.tsx`.

The tax page (`#taxes`) shows what Sweden collects per tax type since 1965 against every OECD country, the tax on a salary by country and household, and a calculator for your own tax — salary, pension, benefits, a business, capital, ISK, a house and what the employer pays on top — that matches every row of Skatteverket's tax tables to the krona, for every year since 2016, and back to 2006 against Skatteverket's worked examples. Every tax decision since 2007 is listed with its bill, each party's vote and the studies behind it, and the calculator shows what each decision did to your own tax. See [taxes](docs/taxes.md).

The data model page (`#data-model`) shows every table in the warehouse: its layer, columns, tests, what it reads from and what reads from it, the keys that join them, its SQL and example rows (`platform/publish/export_schema.py`).

```bash
pip install -r platform/requirements.txt
npm run welfare          # fetch all five sources, then dbt build and test
```

## Project structure

- `frontend/src/politics/`: reusable dashboard views, data types and voting measures.
- `frontend/public/data/gold/`: versioned dimensions, facts, metric contract and frontend marts.
- `platform/legacy/build_gold.py` / `platform/legacy/validate_gold.py`: deterministic build and independent data-contract checks.
- `frontend/public/data/politics/`: public snapshots, document shards, provenance catalog.
- `platform/packages/meaningquality/`: standalone upstream Python engine.
- `platform/sources/allegoria/`: offline source snapshots and annotated corpora.
- `platform/legacy/build_politics.py`: reproducible integration from local upstream exports.
- `platform/legacy/validate_politics.py`: checksums, member totals and budget regression checks.
- `frontend/tests/`: desktop/mobile browser checks. `platform/tests/`: ingestion and engine tests.
- `platform/`: everything that produces data — ingestion, dbt models, publishing. See [platform/README.md](platform/README.md).
- `ml/`: the NLP/ML layer with its own environment and model cards.

CV, contact links and thesis summary are already populated from the supplied material. Internal incident text and employer raw data are not included. Original parliamentary and statute quotations remain Swedish.

After changing a source export, run `python platform/legacy/build_gold.py` and `python platform/legacy/validate_gold.py` before the website build. The checked-in gold JSON means ordinary local development and static deployment need only Node/npm.

## Review status

The source repository is https://github.com/korv9/anton-portfolio. Cloudflare Pages builds and publishes it from `main` (see [hosting](docs/deploy.md)). Earlier `docs/review.md` and `docs/sources.md` describe previous portfolio passes; `docs/political-observatory.md` is the current political integration record.
