# Platform

Everything that produces data. The site consumes it and lives in `frontend/`.

## Layers

```
source → warehouse/raw (bronze) → silver → gold → delivery
```

Bronze is files on disk, exactly as fetched, never edited. Silver and gold are **schemas in
DuckDB**, not directories of JSON — that is what makes them queryable, testable and typed.
Delivery is the last step and a separate concern: sizing files for first paint, choosing
JSON or Parquet or a shard, hashing and uploading.

`frontend/public/data/gold/` is a delivery artefact, not the gold layer. The gold layer is
in the warehouse.

## Directories

| | |
|---|---|
| `ingest/` | Fetch to `warehouse/raw/`. One package per source, plus provenance. `run_welfare.py` runs the five welfare sources and their build |
| `models/` | dbt: `bronze/`, `silver/`, `gold/`, each namespaced per subject area |
| `publish/` | Delivery: catalogue, Parquet export, upload to object storage |
| `lib/` | Shared paths, JSON, hashing, delivered-file resolution; `rawstore` (fetch with provenance) and `pxweb` (SCB and Folkhälsomyndigheten tables) |
| `legacy/` | Build and validate scripts not yet migrated into `models/` and `tests/` |
| `sources/` | Pinned upstream snapshots that cannot be re-fetched |
| `packages/` | The Allegoria meaningquality engine, vendored |
| `tests/` | Ingestion and engine tests |

`legacy/` is named for what it is. Those scripts do the work that `models/` and
`dbt test` will do; keeping them in a directory that says so means the remaining migration
is visible instead of looking like architecture.

## Running it

```powershell
npm run data:build     # legacy builders, then the catalogue
npm run data:check     # the four validators
npm run data:parquet   # Parquet marts
npm run data:upload    # push shards and Parquet to object storage

dbt build --project-dir platform --profiles-dir platform
python -m pytest platform/tests -q
```

The warehouse lives in `warehouse/` and is gitignored: `raw/` for bronze,
`portfolio.duckdb` for silver and gold.

## Moving a subject out of legacy/

One subject at a time, never a rewrite: bronze reads what the legacy script read, gold
reproduces its output in SQL, `publish/export_politics.py` serialises it, and `--check`
must find the result byte-identical to the delivered file before the script is deleted.
CI keeps running that check afterwards (`npm run politics:check`). Budget context was
first; decision votes, speeches and the language map follow.

## Subjects

| Subject | Sources | Models | Documentation |
|---|---|---|---|
| Jobs | JobTech | `models/*/jobs` | `ingest/jobtech/` |
| Welfare | SCB (AKU, population), Försäkringskassan, Folkhälsomyndigheten, ESS, Kolada | `models/*/welfare`, `models/gold/shared` | [docs/welfare-data-model.md](../docs/welfare-data-model.md) |
| Politics | Riksdagen, Statskontoret | Budget context in `models/*/politics`; votes, speeches and language still in `legacy/` | [docs/political-observatory.md](../docs/political-observatory.md) |

## Adding a source

SOU is the next one. The shape is the same for any source:

1. **Ingest.** `ingest/<source>/` fetches to `warehouse/raw/<source>/` and records, per
   file, the URL, the fetch date and a SHA-256. Nothing downstream may read anything that
   is not recorded there.
2. **Bronze.** A `sources.yml` and a `stg_<source>.sql` under `models/bronze/<subject>/`,
   one row per source record, typed and nothing else.
3. **Silver.** Conform it: join to `dim_session`, normalise identifiers, apply crosswalks.
   Entities shared across subjects — `dim_document`, `dim_session` — belong in
   `models/silver/shared/` so politics and research use the same ones.
4. **Gold.** The marts a reader actually wants.
5. **Deliver.** Classify each mart: needed for first paint → JSON; filtered interactively →
   Parquet; long free text read one document at a time → shard. Then
   `npm run data:catalog` and `npm run data:upload`.
6. **Test.** Schema tests in dbt. Reserve a Python check for the things dbt cannot express:
   provenance hashes, reconciliation against a published total, delivery verification.

Step 1 is the only part that needs new Python. Everything from step 2 on is SQL and YAML.

## The rule that matters

No value is ever invented. Every row that fills a gap carries `fill_method`, `source_url`,
`source_hash` and `review_status`. Imputation, interpolation, inferring one party's figure
from another, and any number produced by a language model are all forbidden. A model may
locate a table in a PDF; it may never read the value out of it.
