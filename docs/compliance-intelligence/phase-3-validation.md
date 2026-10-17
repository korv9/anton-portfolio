# Phase 3 validation and review coverage

Historical validation run. The later authenticated population, frozen cohort and expanded evidence batch are recorded in [current completion](completion.md). Counts and input-status statements below refer to this report's original run.

Checked 2026-10-17, Europe/Stockholm. The aggregate machine-readable result is
[`phase-3-summary.json`](phase-3-summary.json). UTC timestamps fall on the preceding
calendar date because the pilot ran shortly after local midnight.

## Existing evidence and real pilot

The private Phase 2 database contained 14 byte-version identities and five current
source references. Two of those references were decision PDFs; no original-body
copy had been retained. Phase 3 read this database and re-fetched only those two
existing PDF references with robots/access checks. Both original SHA-256 values
matched the earlier evidence. Full document bodies and normalized full text were
not saved, sent to a model or published.

Two source documents were processed twice while validating extractor versions,
giving four successful hash-verification observations. There are two current
candidate records and four retained candidate versions. The public summary omits
names, monetary/outcome candidates, excerpts and reviewer information.

| Review measure | Result at `2026-10-16T22:46:59.762801+00:00` |
| --- | --- |
| Current extraction candidates | 2 |
| Provisional issuer/docket groups | 2 |
| Unresolved canonical company identities | 2; actual register input is missing |
| Fully complete evidence records | 0; current-status scope needs human resolution |
| Actual human review actions | 0 |
| Approved identity/legal/privacy/publication reviews | 0 / 0 / 0 / 0 |
| Publication-eligible Gold records | 0 |
| Cohort coverage fraction | null; no verified 50-company denominator |
| Audit entries | 12; chain and candidate hashes verified |

The deterministic parser extracted supported candidate fields while abstaining on
conflicting procedural/history statements. Unknown current status was not converted
to finality from the age of the documents. No real company violation or reviewed
outcome was asserted. Missing identity evidence was not replaced with a brand or
parent-company guess.

The last full extraction run finished at `2026-10-16T22:45:02.830046+00:00`.
Exact private run reports are under the ingestion root's `review/reports/` directory.
Gold export to `.research/compliance-intelligence/phase3-approved-preview-2026-10-17`
contained zero records. Its sealed empty release passed `validate-release` at
`2026-10-16T22:45:34.666749+00:00`. Nothing was uploaded to public R2.

Source coverage carries its own observation dates from Phase 2. IMY remains
`bounded_partial`, last observed at `2026-10-16T22:21:52.733587+00:00`. KKV remains
`blocked_access`, last observed at `2026-10-16T22:13:57.642733+00:00`; its 403 was
not treated as zero cases or bypassed in Phase 3. Neither selected-source coverage
nor complete historical appeal/finality coverage can be quantified from this pilot.

## Checks and adversarial cases

The Phase 3 suite uses synthetic companies, source text and human-role fixtures.
Those approvals are confined to temporary test databases. No real record was
approved by a test or by the implementation task.

| Check | Result |
| --- | --- |
| Phase 3 adversarial suite | 46 tests, included in the full Python run. |
| Full `python -m pytest platform/tests -q --basetemp <fresh workspace tmp>` | 569 passed, 2 skipped; 37.03 seconds. |
| `npm.cmd run check` | Passed. |
| `npm.cmd run format:check` | Passed. |
| `npm.cmd run test:unit` | 104 passed. |
| Real PDF reference refresh | Two unique source hashes verified; two current candidates held. |
| Real public-eligible Gold export | Zero records; empty release validation passed. |
| Repository prose scanner on changed Markdown | Zero findings. |

Idea Lineage capture was attempted from the final answer. The existing private
journal still fails with `KeyError: 'created_at'` in `platform/idea_lineage/store.py:80`.
That unrelated journal was left unchanged.

Covered failure modes:

- Similar names, contradictory organization numbers and unique brand aliases
  cannot verify another legal operator. Exact legal-name-only identity needs a
  separate authorized human review.
- Swedish thousands/million/billion units, decimal commas and SEK/EUR remain
  explicit. Wrong units, missing currency, negative/grouped ambiguous amounts and
  fabricated LLM amounts fail or abstain.
- Appeals and annulments retain the original order and amount. A pending reversal
  blocks publication; a reviewed annulment has no inferred effective fine. A
  reversal of a reversal becomes unknown until its appellate chain is resolved.
- Several decisions on a docket and several judgments in one file remain distinct.
  Ambiguous follow-up targets and possible duplicate byte representations are held.
- LLM extra approval fields, fabricated pages/quotes, unsupported finality and
  document prompt injections cannot approve records. Allegations and proposed fines
  do not become regulatory findings through the deterministic pattern match.
- Human/service roles, explicit attestation, preparer independence, separate
  publication reviewer, privacy/reuse clearance, review expiry and rejection are
  enforced. Reapproval needs a new publication approval.
- Changed source versions/context, altered candidate/action data, timezone changes,
  stale releases and rehashed Gold value substitutions cannot bypass verification.

No frontend files changed; frontend E2E was not run. The full Python run uses a
fresh workspace `tmp` base because the machine's default pytest temp root has an
existing access problem. Existing unrelated worktree changes were preserved.

## Files changed

New code and tests:

- `platform/compliance_intelligence/legal_extraction.py`
- `platform/compliance_intelligence/legal_review.py`
- `platform/compliance_intelligence/legal_review.sql`
- `platform/compliance_intelligence/review_cli.py`
- `platform/tests/compliance_intelligence/test_phase3.py`

New documentation: `phase-3.md`, `phase-3-validation.md`, `phase-3-summary.json`
under `docs/compliance-intelligence/`.

Updated documentation: `README.md`, `architecture.md`, `data-dictionary.md` in
the same directory. No dependency, public warehouse, delivery configuration,
homepage or animation file changed in this phase.

## Handoff

Provide actual verified registry input, re-extract with `--registry`, inspect each
record with `show`, and create scoped corrections through `import-proposal` where
needed. Supply authorized human reviewer identities and record their actual
decisions. Complete current appeal/finality searches before approving that status.
Validate each staged release again before future public promotion. Commands,
trust boundaries and remaining template limits are in [Phase 3 operation](phase-3.md).
