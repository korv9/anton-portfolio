# Phase 4 validation and readiness

Historical validation run. The later authenticated population, frozen cohort and expanded evidence batch are recorded in [current completion](completion.md). Counts and input-status statements below refer to this report's original run.

Checked 2026-10-17, Europe/Stockholm. The aggregate operational status was read at
`2026-10-16T23:06:59.771189+00:00`. See
[`phase-4-summary.json`](phase-4-summary.json) for machine-readable results.

## Delivered scope

All six requested analytical datasets have typed private DuckDB schemas, JSON and
Parquet exports. The build uses only live-validated approved Gold and a frozen,
verified 50-company cohort. It implements separate administrative/GDPR/competition
counts, final native-currency amounts, appeal and modified/annulled counts,
reviewed-document counts, authority/year coverage, requested filters, dated group
aggregation and exploratory employee-interval normalization. Separate observed
metric ranks carry comparison counts and coverage limitations; no universal score
is implemented.

The criminal metric is explicitly null/unmeasured because the current Swedish Gold
contract has no legally cleared legal-person criminal-conviction scope. Corporate
fines and administrative sanctions cannot fill it. No verified revenue data exist,
so normalization uses documented employee class bounds only. These limits are
explained in the [public methodology](phase-4-methodology.md).

## Actual input readiness

| Input or result | Observed state |
| --- | --- |
| Authorized real company register / frozen cohort | Missing; no actual 50-company sample exists. |
| Existing publication-eligible Gold candidates | 0. |
| Existing extraction pilot | Two current candidates, no human approval; Phase 3 report remains the evidence record. |
| IMY operational coverage | `bounded_partial`, last source observation `2026-10-16T22:21:52.733587+00:00`. |
| KKV operational coverage | `blocked_access`, last source observation `2026-10-16T22:13:57.642733+00:00`; recorded 403, not a zero-case result. |
| Real cohort analytics / rankings produced | None. |
| Real original-publication regression reconciliation | Not run: there is no reviewed real Gold example or verified cohort. |
| Public upload, dashboard or homepage change | None in this phase. |

The existing empty Phase 3 release is not evidence that 50 companies have no
sanctions. No real candidates were approved to make the tests pass. No additional
enforcement ingestion or source-access bypass was attempted.

## Tests

| Check | Result |
| --- | --- |
| Full Python suite with fresh workspace-local `--basetemp` | 601 passed, 2 skipped; 67.47 seconds. |
| Phase 4 regressions within that run | 32 passed. |
| `npm.cmd run check` | Passed. |
| `npm.cmd run format:check` | Passed. |
| `npm.cmd run test:unit` | 104 passed. |
| Prose scanner on changed Markdown | Zero findings after editing two flagged phrases. |
| `git diff --check` | Passed; new compliance files are currently untracked. |

The tests create owned synthetic Swedish-text PDF publications and temporary
register/review stores. Their fixture URLs use official-host shapes for adapter
validation; they are not actual authority publications. Test-role human approvals
exercise all existing Phase 3 gates and do not constitute real-world review.
Approved-source projection scenarios separately exercise lifecycle arithmetic.

Regression checks cover:

- Reviewed administrative and competition examples, explicit finality, pending
  appeals, independent acts on one docket and missing cohort observations.
- Native SEK/EUR separation, original versus final amount roles, Swedish million
  units and reconciliation against exact source bytes and page excerpts.
- Multiple appellate documents without duplicated obligations, annulments outside
  the date window, a modified order with a separately approved replacement amount,
  and exclusion of allegations, investigations and unknown states.
- Immutable membership under filters, member-only group aggregation without
  liability transfer, unknown parent dates, mergers and cross-company appeal links.
- Zero/open-ended employee intervals, explicit missingness, authority/year field
  completeness distinct from unknown search/population coverage, and observed
  ranks that exclude unassessed companies.
- Identical canonical dataset hashes across repeated builds and input ordering;
  all six SQL tables and typed Parquet exports; complete SQL/JSON/Parquet agreement.
- Withdrawal invalidating both Gold inputs and existing analytical outputs;
  changed/resealed metric values and cohort definitions rejected during validation.

The original-publication reconciliation implementation is runnable, but its tested
fixtures do not replace real reviewed examples. When the register and approvals
exist, run the same build against the exact retained or permitted refreshed
authority originals and record the real source/hash checks here. Phase 3 previously
verified the two actual pilot PDF hashes; those unreviewed documents remain
ineligible for Phase 4 business metrics.

## Changed files in this phase

- `platform/compliance_intelligence/analytics.py`: approved-only build, reconciliation,
  metric/filter/group logic, coverage, validation and CLI.
- `platform/compliance_intelligence/analytics.sql`: six typed analytical tables.
- `platform/tests/compliance_intelligence/test_phase4.py`: 32 synthetic regression
  checks, including reviewed PDF fixtures and complete bundle validation.
- `docs/compliance-intelligence/phase-4.md`, `phase-4-methodology.md`,
  `phase-4-validation.md`, `phase-4-summary.json`: operation, public methodology,
  checks and observed readiness.
- `docs/compliance-intelligence/README.md`, `architecture.md`, `data-dictionary.md`:
  analytical boundary, documentation links and table definitions.

The worktree already contained extensive unrelated frontend, pipeline and security
changes, plus the untracked Phase 0–3 module. Those changes were preserved. No
homepage or animation source was edited in this phase. No new dependency was added.

## Remaining acceptance and handoff

Real benchmarking is pending inputs, not a completed empirical study. Activate
authorized SCB access or supply a permitted complete register extract; verify and
freeze the actual 50-member cohort. Resolve identities and status evidence, obtain
actual independent human reviews and export fresh approved Gold. Reconcile the
selected records against official originals, run the documented build/validate
commands and inspect the case-level totals and source limitations before any public
delivery. A future publisher must revalidate and display the cohort definition and
coverage alongside every comparison.

Idea Lineage capture was attempted from the exact final answer with
`npm.cmd run ideas:extract -- --input tmp/compliance-phase4-final-answer.md --project compliance-intelligence --apply`.
The existing private journal failed with `KeyError: 'created_at'` in
`platform/idea_lineage/store.py:80`. That unrelated journal was left unchanged.
