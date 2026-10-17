# Phase 1 validation

Historical validation run. The later authenticated population, frozen cohort and expanded evidence batch are recorded in [current completion](completion.md). Counts and input-status statements below refer to this report's original run.

Checked 2026-10-16. The requested functionality is implemented. Actual cohort
selection and authenticated production validation await authorized register data.
The user confirmed that no SCB access or local extract is available. No real or
placeholder company rows have been added to product data.

## Current input status

`python platform/compliance_intelligence/cli.py status` reports
`awaiting_authorized_data`: `SCB_API_KEY` is absent, no local extract/metadata is
configured, and cohort generation has not run. This command makes no network
request. The public SCB OpenAPI and documentation were inspected; authenticated
company-data endpoints were exercised only with synthetic offline responses.

## Checks

| Check | Result | Evidence |
| --- | --- | --- |
| Focused compliance pytest suite | 47 passed | 15 Phase 0 checks and 32 Phase 1 checks, including parametrized cases. |
| Full platform pytest suite | 493 passed, 2 skipped | Final run: 36.30 seconds, using a new GUID-named temporary directory under workspace `tmp/`. |
| `npm.cmd run check` | Passed | Current shared frontend worktree type-checks. |
| `npm.cmd run format:check` | Passed | Current frontend formatting passes; these files were not changed by Phase 1. |
| `npm.cmd run test:unit` | 104 passed | Existing frontend Node tests. |
| CLI `status` and `--help` | Passed | Actual local input status and all six commands displayed without secrets. |
| New/updated documentation prose scan | Passed | Repository scanner reports zero hits. |
| Relative document links and whitespace | Passed | Checked all compliance documents and task code/configuration. |
| Required Idea Lineage extraction | Failed on existing journal data | The command was run on the final answer; `store.py` still raises `KeyError: 'created_at'` while reading the existing journal, before appending events. Existing journal data was left untouched. |
| Live authenticated SCB integration | Not run | No API key is available; activate and verify the first real run as documented. |
| Browser/E2E, deployment and public publishing | Not run | No frontend or delivery changes; no publishing requested in this phase. |

Full logs remain in ignored `tmp/compliance-phase1-pytest-final.log`,
`tmp/compliance-phase1-types.log`, `tmp/compliance-phase1-format.log` and
`tmp/compliance-phase1-unit.log`. Earlier Phase 0 results remain in
[the Phase 0 validation report](validation.md); those describe the worktree at that
earlier time. Unrelated worktree edits were retained.

## Behaviors covered

- Organization-number normalization, the SCB `16` prefix, checksum failure and
  natural-person rejection.
- Stable 50-entity ranking/hash under shuffled input and duplicate observations;
  size-class ordering, boundary counts and explicit exclusions.
- Insufficient population, incomplete declared coverage, missing identity/reuse
  reviews and conflicting register names prevent freezing.
- Shared legal names/brands produce review candidates; exact IDs with contradictory
  names stay held. Historic-name validity has an exclusive end date; a current name
  is not assumed to have applied historically, and future identity is unverified.
- Foreign parents keep their local register numbers/countries, siblings keep their
  identities, and mergers never redirect the predecessor to the successor.
- Reviewed alias/relationship evidence is persisted separately with review records;
  contradictory parents and relationship cycles are rejected.
- CSV and Parquet import, SCB header mapping, conflicting name columns, byte hashes,
  required legal form, row counts and private-path containment.
- Actual private DuckDB tables, CSV/JSON bundles, read-only queries, refused overwrite,
  file tampering and exploratory search without membership changes.
- SCB cursor traversal, count drift, repeated cursors, page bounds, HTTP authentication
  failures, refused redirects, network exceptions and absence of credentials in logs
  or persisted evidence. Missing access creates no placeholder snapshot or cohort.

Synthetic fixtures are generated inside tests and written only to test temporary
directories. They are not an example cohort or source evidence for any real entity.

## Changed files for Phase 1

| File | Change |
| --- | --- |
| `.env.example` | Empty `SCB_API_KEY` and optional local input/private-output variables. |
| `platform/compliance_intelligence/policy.json` | Versioned SNI 2025 segments and SCB employee-class ordering with official sources. |
| `platform/compliance_intelligence/sources.py` | Official-origin API client, sealed acquisition, CSV/Parquet fallback, provenance and reviewed identity supplements. |
| `platform/compliance_intelligence/registry.py` | Number normalization, conflict holds, dated aliases/relationships, direct identity resolution and exploratory candidates. |
| `platform/compliance_intelligence/cohort.py` | Deterministic selection, transactional private tables, frozen exports, manifests and verification. |
| `platform/compliance_intelligence/cli.py` | `status`, `ingest`, `build`, `verify`, `search`, `resolve`. |
| `platform/compliance_intelligence/schema.sql` | Added the complete population-manifest hash to `cohort_definition`; existing 13-table contract retained. |
| `platform/tests/compliance_intelligence/test_phase1.py` | Offline source, identity, group, cohort and export regression coverage. |
| `docs/compliance-intelligence/phase-1.md` | Activation, source mapping, local sidecar, supplements, commands and limitations. |
| `docs/compliance-intelligence/phase-1-validation.md` | This report. |
| `docs/compliance-intelligence/README.md` | Current implementation/input status and Phase 1 navigation. |
| `docs/compliance-intelligence/architecture.md` | Distinguishes implemented Phase 1 behavior from later enforcement/publication design. |
| `docs/compliance-intelligence/data-dictionary.md` | Version 1 population provenance and application-level freeze semantics. |
| `docs/compliance-intelligence/phase-1-handoff.md` | Links the original plan to current operation/validation. |

No frontend, homepage, intro animation, dependency, scheduled pipeline, R2 delivery
group or enforcement ingester was changed by this task.

## Remaining handoff

1. Obtain authorized SCB access and set `SCB_API_KEY`, or supply a real complete
   CSV/Parquet extract and provenance sidecar.
2. Ingest privately, check scope and exclusions, resolve conflicts and complete
   identity/completeness/reuse review as applicable. Add source-backed aliases and
   parent/history links where available; keep unknown relationships absent.
3. Run `build` and `verify` to create the actual 50-company cohort. Keep the
   original bundle and methodology, with later exploration separate.
4. Validate production API behavior and real-data coverage before declaring the
   cohort established. Enforcement ingestion remains a separate later phase.

Decision: Keep the original legal-entity cohort immutable through create-once bundles.

Finding: All implementation checks pass offline; a real cohort still requires authorized register input.
