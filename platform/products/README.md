# Product workspace

`catalog.json` is the shared project registry consumed by the frontend. It contains six projects, their question, maturity, skills, source and report entry points. A project can be a data product or a case study; synthetic previews and private thesis data are not treated as public observations.

| Product | Implementation | Data / report contract |
| --- | --- | --- |
| Swedish Politics | `src/politics/`, `src/BudgetLab.tsx`, `scripts/build-gold.py` | `public/data/gold/`, source archives under `public/data/politics/` |
| Job Market | Job report in `src/App.tsx`, gold build | `public/data/jobs/`, `public/data/gold/marts/jobs.json` |
| DrugComb | `drugcomb/pipeline/` pinned upstream source; `src/products/DrugCombReport.tsx` | All 22 published CSV tables, JSON views and original figures under `public/data/products/drugcomb/` |
| Allegoria / RFC | `packages/meaningquality/`, `src/RfcReport.tsx` | `public/data/gold/marts/rfc-drift.json` and versioned law snapshots |
| Thesis | Approved aggregate case study in `src/App.tsx` | No employer raw data or incident text |
| Homie API | Pinned README and OpenAPI contract under `homie/`; `src/products/HomieProject.tsx` | Engineering case study; analytics remain synthetic stubs |

The portfolio is a static React site. `src/products/DataExplorer.tsx` exposes all gold tables plus the DrugComb result tables with search, facets, pagination and full downloads. Data is loaded one table at a time. The existing gold transformation is Python; this repository does not claim that a dbt migration has been completed.

## Build

`python scripts/build-products.py` transforms the checked-in DrugComb CSV exports and publishes the registry. `python scripts/validate-products.py` checks the public contracts against those exports. No source download, clinical inference, model training or backend service runs during this build.

DrugComb's pinned pipeline can be inspected and run independently using its own README and Python environment. Reproducing its training requires the original source datasets and dependencies. The portfolio integration reuses the saved report, not a fresh experiment.

To update DrugComb, replace its pipeline and report files from one reviewed source revision, update `drugcomb/source.json`, rebuild products and run validation and browser tests. Do not mix tables from different training runs.
