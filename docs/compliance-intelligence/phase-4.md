# Phase 4 operations

Implemented 2026-10-17. The entry point is
[`analytics.py`](../../platform/compliance_intelligence/analytics.py), with typed
tables in [`analytics.sql`](../../platform/compliance_intelligence/analytics.sql).
It uses the existing DuckDB, Parquet, canonical JSON and sealed-directory helpers.
No additional dependency, public warehouse migration, scheduled ingestion,
dashboard, R2 upload or frontend change is introduced.

Read the [public methodology](phase-4-methodology.md) before using any comparative
values. Current inputs are not ready: the real register/cohort is missing and the
pilot has zero human-approved Gold records. Commands below use illustrative path
names for inputs that must first be created through the existing gated workflows.
Do not create fake records to satisfy these paths.

## Inputs and commands

1. Acquire a real SCB or permitted CSV/Parquet register and freeze the 50-company
   cohort using [Phase 1](phase-1.md). Preserve that bundle and its identity evidence.
2. Complete source evidence, identity/legal/privacy and independent publication
   review in [Phase 3](phase-3.md). Export an approved sealed Gold release. Reviews
   must still be fresh; source and identity dependencies must remain unchanged.
3. Check collection/readiness without generating company metrics:

```sh
python platform/compliance_intelligence/analytics.py status --root .research/compliance-intelligence/phase-2-pilot
```

Build into a new private directory. Existing output directories are never replaced:

```sh
python platform/compliance_intelligence/analytics.py build --root .research/compliance-intelligence/phase-2-pilot --release .research/compliance-intelligence/approved-gold --cohort .research/compliance-intelligence/cohort --output .research/compliance-intelligence/analytics-release --year 2025 --authority Integritetsskyddsmyndigheten --category data_protection --scope legal_entity
```

Other filters are repeatable `--authority`, `--category`, `--status`, `--industry`
(eligible primary SNI code) and `--size-class` (SCB class code); inclusive
`--date-from`, `--date-to`; `--scope corporate_group` and `--group-as-of`.
Omitted categorical filters include all values. Invalid enum values, dates or
future group dates fail explicitly. Year and date filters intersect. See the
methodology for originating-authority and originating-decision-date semantics.

The build revalidates Gold and the frozen cohort before deriving metrics. It then
checks selected decisions and status dependencies against the exact original
document SHA-256 and every supported claim's precise normalized page excerpt.
This is a reconciliation check, not a new extraction or approval step. Changes to
source bytes, evidence or current approvals hold the build without a completed
output. Unapproved candidates are never included in analytical facts.

Retained permitted originals are read privately. Reference-only evidence cannot
be reconciled offline. Use `--refresh-references` only when permitted fresh source
access is appropriate. This reuses the source policy/robots, host, rate, retry and
audit controls from Phase 2/3 and requires the original hash to match. Restricted
or changed originals cause a hold; this flag cannot override source restrictions.
No unrestricted copy of a reference-only document is written into the bundle.

Validate before delivery or query, with the live review store still available:

```sh
python platform/compliance_intelligence/analytics.py validate --root .research/compliance-intelligence/phase-2-pilot --release .research/compliance-intelligence/approved-gold --cohort .research/compliance-intelligence/cohort --bundle .research/compliance-intelligence/analytics-release
python platform/compliance_intelligence/analytics.py query --root .research/compliance-intelligence/phase-2-pilot --release .research/compliance-intelligence/approved-gold --cohort .research/compliance-intelligence/cohort --bundle .research/compliance-intelligence/analytics-release --table mart_compliance_company_summary
```

Validation checks sealed files and current Gold/cohort eligibility, recomputes all
six projections, checks methodology and code versions, compares exact JSON rows
with SQL and checks Parquet against SQL in both directions. A resealed changed
metric does not pass. Query performs this validation and returns `{context, rows}`.
Withdrawal or expiry invalidates existing analytics; regenerate only after the
reviewed release is valid again. CLI failures return exit code 2 with a bounded
error code. Private source bodies are excluded from errors. Directly opening exported
files bypasses live validation, so public delivery must use this validation gate.

## Storage and reproducibility

The build creates the six required tables under `gold` in an isolated
`analytics.duckdb`, plus typed Zstandard Parquet and canonical JSON for each table,
including empty tables. `methodology.json` contains input manifest/membership
hashes, code hash, row counts and canonical dataset hashes. `cohort-definition.json`
and `reconciliation.json` preserve the cohort context and original-document checks.
The artifact manifest binds the actual files.

Canonical row hashes are stable for identical approved inputs, filters and code.
Physical DuckDB/Parquet bytes and creation timestamps are not claimed to be
byte-identical across executions. The code hash binds this transform and its SQL;
the Gold and cohort manifests bind the upstream versions. Python package versions
remain those of the existing project environment, not a new hermetic runtime.

These are private release candidates under `.research/` or `tmp/`. Do not copy the
private evidence database or use the existing whole-warehouse R2 backup path.
There is no automatic public promotion. A future publisher must revalidate inputs,
carry methodology/coverage alongside metrics, apply the existing public projection
rules and handle withdrawal/replacement of published artifacts.

## Next implementation handoff

Once authorized register data and human reviews exist, freeze and verify the real
50 members, build the selected approved release, reconcile its originals and run
`validate`. Inspect currency-separated totals and review-status lifecycle links
against the corresponding official publications before public delivery. Record
the real authority-publication regression checks in the validation report.

Keep KKV's blocked access as missing coverage until permitted access works. Do not
replace it with inferred zeros. Expand financial metadata or criminal-law scope
only through separately evidenced upstream contracts and human legal approval.
No score, public dashboard or broader ingestion is part of this change.
