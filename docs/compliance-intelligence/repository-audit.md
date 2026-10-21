# Repository audit

Audited local worktree: `C:/Users/46762/orca/workspaces/anton-portfolio/shiner`.
Remote: `https://github.com/korv9/anton-portfolio.git`.
HEAD at audit: `eb2f4e0fade4e7f60127f913f4d00b83fd2036fb` (2026-10-14).
Audit date: 2026-10-16. This is a source audit of the local worktree, not an assertion
about the currently deployed Cloudflare configuration.

The worktree already contains many unrelated frontend, workflow, dependency and
documentation edits. They were retained. Existing file contents are the evidence
for this audit, including those edits.

## Investigation method

Read `CLAUDE.md`, the repository graph-first skill and applicable coding/writing
skills. Queried `graphify-out/graph.json` with approximately 1,000-token queries,
then narrowed to named artifacts and read their source. The graph has 6,289 nodes;
broad queries were truncated. `dim_company`, `company` and `pipeline.yml` did not
resolve to graph nodes. Targeted source inspection filled these gaps; the graph
was neither rebuilt nor treated as proof that a component does not exist.

`docs/compliance-intelligence/` did not exist when the task started. These documents
establish the Phase 0 baseline requested before Phase 1.

## Actual structure and reuse

| Area | Existing implementation | Finding for this module |
| --- | --- | --- |
| Python orchestration | `platform/pipeline.py`, `platform/pipeline.yml` | Single subject registry with ingest, dbt, ML, export and publish steps. Reuse when an authorized, reviewed pipeline exists; add no subject in Phase 0. |
| Warehouse | `platform/dbt_project.yml`, `platform/profiles.yml`, `platform/macros/` | dbt bronze/silver views and gold tables in DuckDB; `PORTFOLIO_DB` selects the database. Model tags select independent subjects. |
| Current job ads | `platform/ingest/jobtech/ingest_jobs.py`, `ingest_history.py`, `platform/models/bronze/jobs/stg_job_ads.sql` | Immutable ad payload versions; extracts employer name and organization number. Useful identity candidates, not company-register evidence. |
| Employer dimension | `platform/models/gold/jobs/dim_employer.sql` | Latest employer observation per `employer_id`. Staging hashes `org:<number>` or a lowercased name fallback. No checksum, legal-name validation, group identity or temporal alias resolution. Do not reuse this hash as `company_id`. |
| Whole job market | `platform/ingest/jobtech/ingest_market.py`, `ingest_stream.py`, `full_corpus.py`, `platform/models/{bronze,gold}/market/`, `platform/publish/export_market.py` | Historical archive counts and a completeness-aware stream. Most market marts are aggregated and cannot support company-level attribution. Keep SSYK occupation classifications separate from SNI company industries. |
| IT analytics | `platform/models/silver/jobs/`, `platform/models/gold/jobs/`, `platform/publish/export_job_clusters.py`, `platform/nlp/` | Role/skill and clustering analytics. Ad counts are observations, not entity size or compliance exposure. |
| Company Intelligence | Targeted searches in models, ingest, project components, routes and architecture registry | No dedicated Company Intelligence module or authoritative canonical company registry was identified. The nearest reusable component is `dim_employer`. Treat the named project as intended scope, not an existing implementation. |
| Legal sources | `platform/legal/{parse,cellar}.py`, `platform/ingest/eu_ai_act/`, `platform/models/*/eu_ai_act/` | Existing EU act parsing, provision identity and version comparison. Useful for legal-basis context; not Swedish enforcement or court decision parsers. |
| Raw provenance | `platform/lib/rawstore.py` | Retrying HTTP session, byte SHA-256, per-fetch JSONL manifests and collection checkpoints. Reuse byte hashing and manifest conventions. Default raw storage is unsuitable for unreviewed legal evidence. |
| Common utilities | `platform/lib/common.py` | JSON and paths; `raw_sha` preserves bytes while `portable_sha` normalizes line endings. Document hashes must use original bytes. |
| Parquet | `platform/publish/build_parquet.py`, JobTech outputs, `frontend/src/parquet.ts` | PyArrow/DuckDB exports and lazy `hyparquet` browser reads. Reuse after field selection and publication review. |
| R2 release delivery | `platform/publish/{release,build_catalog,warehouse_store,upload}.py`, `configs/delivery/`, `platform/lib/delivery.py` | Versioned groups, manifests, hashes and snapshot activation exist. `upload.py` is the older unversioned path. Use release machinery only for approved projections. |
| Frontend | `frontend/src/jobb/{JobsProduct,JobsReport,Dashboard}.tsx`, `frontend/src/jobs/`, `frontend/src/router.ts`, `frontend/src/projects/` | React/TypeScript, Vite and hash routing. `frontend/src/jobb/data.ts` reads `jobs/market.json`; `dataSource.ts` resolves local or pinned release paths. No compliance route was added. |
| Shared UI | `frontend/src/ui/{Project,Editorial,Disclosure,Trace}.tsx`, `frontend/src/ui/dash/`, `frontend/src/site/`, `frontend/src/charts/` | Reuse existing report, navigation, source and dashboard components in a later UI phase. |
| Data quality | `platform/quality/quality_registry.yml`, `platform/quality/`, `platform/tests/` | Pass/warning/fail/not-measured patterns already exist. Coverage and evidence measures can join this registry later; avoid a composite company compliance score. |

## Current sources

The pipeline registry includes JobTech current ads, stream and archives; SCB
statistical tables; Försäkringskassan; Folkhälsomyndigheten; ESS; Kolada; Riksdagen;
Valmyndigheten; OECD; Skatteverket; EU Publications Office/Cellar; European Commission;
DiVA; Project Gutenberg and curated symbolic texts. News reads SVT, Sveriges Radio
Ekot and Regeringskansliet feeds. DrugComb and legacy builders have separate inputs.

SCB statistical ingestion uses PxWeb. It is a different service from the SCB
company-register API and does not establish register access. No IMY, KKV, FI,
Swedish court enforcement or company-register ingestion subject is registered.

## Design tokens

`docs/design-system.md` defines the current direction; `frontend/src/tokens.css`
owns token values. The local version uses `--color-canvas` (#F1EFE7),
`--color-surface` (#E2DFD6), `--color-panel` (#CECBC2), `--color-border` (#A9A69D),
`--color-border-control` (#858279), `--color-ink` (#363636),
`--color-ink-secondary` (#57554E) and `--color-ink-inverse` (#F1EFE7).
Existing aliases include `--page`, `--paper`, `--surface`, `--line` and `--ink`.
Typography uses the Helvetica/system stack with semantic `--type-*` roles and
tabular figures. A future module must use these tokens and existing UI primitives.
This audit makes no style or animation change.

## Deployment and storage findings

`wrangler.toml` serves `dist/` as Cloudflare Workers static assets. Repository docs
describe Workers Builds on pushes, production on `main` and branch previews.
GitHub workflows build data and publish R2 releases; they do not deploy the site.
`build-warehouse.yml` also backs up the whole configured DuckDB database. That path
can expose private tables even if the release exporter omits them.

The committed `frontend/public/data/delivery.json` has legacy JSON/Parquet/shard
bases and no `manifest_url`. The current `dataSource.ts` additionally supports
`VITE_R2_MANIFEST_URL` and a generated `manifest_url` with pinned release indexes.
Consequently the code supports releases, but the committed delivery artifact still
selects legacy serving unless deployment supplies an override. Some existing prose
describes only legacy serving. Actual production mode was not remotely inspected.

The existing R2 bucket is described as public, with warehouse backups and raw/feature
trees. A path called `private` inside that bucket is not access control. New legal
evidence and reviewer records need a separate private store and private DuckDB file,
outside the paths consumed by `pipeline.py push` and `warehouse_store.py`.

## Test infrastructure

`package.json` exposes TypeScript checking, Prettier, Node unit tests and Playwright.
CI runs these plus frontend build/security checks, the Python suite, pipeline dry
run, data contracts and dbt parse/compile. Python tests use pytest; dbt SQL/YAML
tests live alongside them under `platform/tests/`. Runtime dependencies already
include DuckDB, PyArrow, requests, pypdf, PyYAML, jsonschema and boto3. No dependency
was added for Phase 0. Actual results are in [validation](validation.md).
