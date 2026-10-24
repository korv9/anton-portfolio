# Product workspace

Pinned material for the products that are not built by dbt, and the registry that describes
them.

| Path | What it is |
| --- | --- |
| `catalog.json` | Eight product entries: question, maturity, skills, source and report entry points. `platform/legacy/build_products.py` publishes it to `frontend/public/data/products/catalog.json` and `validate_products.py` checks it. The site's menu and project pages come from `frontend/src/projects/projectRegistry.ts`. |
| `drugcomb/pipeline/` | The pinned upstream DrugComb pipeline, with its own [README](drugcomb/pipeline/README.md) and Python environment. `drugcomb/source.json` records the source revision. |
| `homie/` | The Homie API's pinned [README](homie/README.md) and OpenAPI contract. An engineering case study; its analytics are synthetic stubs. |
| `thesis/private/` | The degree project's source material. Ignored by Git and never published. The site shows approved aggregates only: no employer raw data and no incident text (`frontend/src/products/CaseStudies.tsx`). |

Synthetic previews and private thesis data are not treated as public observations.

## Build

```sh
python platform/legacy/build_products.py      # part of npm run data:build
python platform/legacy/validate_products.py   # part of npm run data:check
```

`build_products.py` transforms the checked-in DrugComb CSV exports and publishes the registry.
The site reads all 22 published DrugComb tables, the JSON views and the original figures from
`frontend/public/data/products/drugcomb/` (`frontend/src/products/DrugCombReport.tsx`). No
source download, clinical inference, model training or backend service runs during this build.

Reproducing DrugComb's training needs the original source datasets and the pipeline's own
dependencies. The portfolio reuses the saved report, not a fresh experiment.

To update DrugComb, replace its pipeline and report files from one reviewed source revision,
update `drugcomb/source.json`, rebuild products and run validation and the browser tests. Do
not mix tables from different training runs.
