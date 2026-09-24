# Anton Ernstsson — data portfolio

English-language React/TypeScript portfolio with a static Swedish political observatory, thesis case study and job-market report. No backend or live API is required. Nothing has been published.

## Run locally

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The political dashboard starts at `/#politics`.

```powershell
npm run build
npm run test:e2e
python scripts/validate-politics.py
python scripts/validate-gold.py
```

The browser tests require Playwright Chromium. `dist/` is the static output. Data paths currently assume hosting at the domain root; configure a base-path strategy before subdirectory deployment.

## Latest report update

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

## Project structure

- `src/politics/`: reusable dashboard views, data types and voting measures.
- `public/data/gold/`: versioned dimensions, facts, metric contract and frontend marts.
- `scripts/build-gold.py` / `scripts/validate-gold.py`: deterministic build and independent data-contract checks.
- `public/data/politics/`: public snapshots, document shards, provenance catalog.
- `packages/meaningquality/`: standalone upstream Python engine.
- `data/allegoria/`: offline source snapshots and annotated corpora.
- `scripts/build-politics.py`: reproducible integration from local upstream exports.
- `scripts/validate-politics.py`: checksums, member totals and budget regression checks.
- `tests/`: desktop/mobile browser checks and upstream Python engine tests.

CV, contact links and thesis summary are already populated from the supplied material. Internal incident text and employer raw data are not included. Original parliamentary and statute quotations remain Swedish.

After changing a source export, run `python scripts/build-gold.py` and `python scripts/validate-gold.py` before the website build. The checked-in gold JSON means ordinary local development and static deployment need only Node/npm.

## Review status

The source repository is https://github.com/korv9/anton-portfolio. No website deployment is configured or performed. Earlier `docs/review.md` and `docs/sources.md` describe previous portfolio passes; `docs/political-observatory.md` is the current political integration record.
