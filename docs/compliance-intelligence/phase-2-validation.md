# Phase 2 validation and ingestion coverage

Historical validation run. The later authenticated population, frozen cohort and expanded evidence batch are recorded in [current completion](completion.md). Counts and input-status statements below refer to this report's original run.

Checked 2026-10-17 in Europe/Stockholm. Source timestamps below are UTC, so the
acquisition interval begins on 2026-10-16 UTC. No 50-company cohort or outcome
dataset has been invented to fill the missing register dependency.

## Live source pilot

The initial run `bbfbe4aa-ffe6-4e4e-a795-b18846c6cb42` used one listing page,
two records and two documents per source as maximum bounds. It finished at
`2026-10-16T22:13:57.642733+00:00`. Originals were processed in memory with stable
official references and byte hashes; no original-body copy approval was supplied.

| Source | Listing pages attempted | Record pages observed | PDF documents observed | Result |
| --- | --- | --- | --- | --- |
| IMY | 1 | 2 | 2 | `bounded_partial`; five distinct resources observed, 43 discoveries deferred by the batch limits, no resource failures. |
| Konkurrensverket | 1 | 0 | 0 | `blocked_access`; HTTP 403 at the official list URL, no repeat/bypass attempt within that source run. |

Both robots files returned HTTP 200 in direct checks. IMY disallows query-based
search paths; KKV supplied no disallow directive. See the linked policies and the
current [source feasibility matrix](phase-2.md#official-sources-and-access).

The fixed five-resource baseline is
[`phase-2-pilot-manifest.json`](phase-2-pilot-manifest.json), recorded by run
`a80a462c-a27e-432b-81b1-4543a1e1764b` ending at
`2026-10-16T22:19:05.461569+00:00`. It includes the index, its first two record
pages and their linked PDFs. This is a technical source pilot selected by document
order, independent of company cohort selection. It is not an IT company sample.

The fixed-manifest verification run
`d5b94fe9-1b3e-4d5e-8c7a-4bd430384d26` ran from
`2026-10-16T22:21:41.901180+00:00` through
`2026-10-16T22:21:52.733587+00:00`. It fetched exactly those five resource URLs.
Both PDF hashes matched; all three HTML hashes differed from the baseline. HTML
contains per-response nonces. The collector retained byte-version history and
made no claim that a legal decision had been corrected. It recorded 45 discovery
edges outside manifest scope. Seven observed edges represent five distinct
resources, because seeds and parent links are separate provenance edges.

| PDF reference | SHA-256 | Candidate decision date | Publication date |
| --- | --- | --- | --- |
| [IMY PDF 1](https://www.imy.se/globalassets/dokument/beslut/2026/beslut-efter-tillsyn-enligt-dataskyddsforordningen--miljodata-i-karlskrona-aktiebolag.pdf) | `1a9f5492445f4f5d9e377bb2f3b625550c0814325225380d33e247debdd61bd6` | 2026-09-22 | null |
| [IMY PDF 2](https://www.imy.se/globalassets/dokument/beslut/2026/beslut-efter-tillsyn-enligt-gdpr_sportadmin-i-skandinavien-ab.pdf) | `fe587bb0419cadaee2e462e8250e085a29cbf15eec60e10b9f7255faf29107cf` | 2026-01-26 | null |

The dates are unreviewed template extractions from first-page `Datum` fields.
Publication dates were not established and were not filled from decision dates,
source update dates or URL years. Revision-marker counts are unreviewed search
candidates. No company violation, legal outcome, appeal disposition, finality or
sanction amount was inferred or exported.

Private evidence metadata and exact per-run JSON/Parquet reports are under
`.research/compliance-intelligence/phase-2-pilot/`, outside the public warehouse
and upload paths. This directory is ignored by Git. The tracked pilot manifest
contains only public document references, technical hashes/dates and unreviewed
status, without extracted personal details, private paths or reviewer identifiers.

## Coverage and remaining dependencies

- Company denominator: null. No authorized register API data or supplied extract
  exists, so a verified frozen 50-member cohort cannot yet be attached.
- Cohort execution: prepared and tested with a temporary synthetic frozen bundle.
  Real expansion requires the Phase 1 input and ordinary KKV access. It was not run.
- IMY denominator: unknown. The published selection is not the complete diary;
  the small batch defers most index entries and other linked documents.
- KKV denominator: unknown. A 403 does not mean zero cases. Pagination and PDF
  access need a live check after access becomes available.
- Extraction recall: unknown. The literal legal-suffix matcher is a candidate
  heuristic, not exhaustive named-entity recognition. Scans receive no OCR,
  ambiguous dates/dockets remain null, and human evidence review is pending.
- Historical, appeal and finality coverage: not measured. Linked court documents
  are retained as separate observations; proceedings are not merged or interpreted.
- Publication: not approved. No public database migration, upload or new scheduled
  source job was added. No rankings, dashboard, homepage or intro edits were made.

## Checks

| Check | Result |
| --- | --- |
| `python -m pytest platform/tests -q --basetemp <fresh workspace tmp directory>` | 523 passed, 2 skipped; final run 37.60 seconds. The default Windows pytest temp root has an existing access problem; the explicit fresh workspace root avoids it. |
| Compliance tests | 77 included in the full run: 47 existing foundation/registry checks and 30 Phase 2 checks. |
| `npm.cmd run check` | Passed. |
| `npm.cmd run format:check` | Passed. |
| `npm.cmd run test:unit` | 104 passed. |
| Live bounded collection | IMY five resources observed; KKV recorded 403 and halted. |
| Fixed-manifest live check | Five URLs retained; two PDF baseline hashes matched. |
| Repository prose scanner on changed Markdown | Zero findings. |
| `npm.cmd run ideas:extract -- --input tmp/compliance-phase2-final-answer.md --project compliance-intelligence --apply` | Failed on the existing private journal's `KeyError: 'created_at'` in `platform/idea_lineage/store.py:80`. The unrelated journal was left unchanged. |

Tests cover robots wildcard/allow rules, same-origin restrictions, redirects,
retry/backoff and long Retry-After deferral, unavailable robots policies,
pagination, bounds, URL/blob deduplication, 304/idempotence, changed byte versions,
source failures, conflicting/missing dates, multiple docket references, candidate
correction links, PDF text/scans/encryption/corruption, private storage, scoped
copy review, frozen-manifest membership and unchanged frozen cohort membership.
Company tests preserve ambiguous aliases and direct legal-entity scope across a
parent relationship. Network responses and company fixtures in tests are synthetic.

Frontend E2E was not run because this phase changes no frontend code. Existing
unrelated dirty worktree changes were preserved.

## Files changed in this phase

New code:

- `platform/compliance_intelligence/authority_sources.py`
- `platform/compliance_intelligence/authority_http.py`
- `platform/compliance_intelligence/decision_ingest.py`
- `platform/compliance_intelligence/ingestion.sql`
- `platform/tests/compliance_intelligence/test_phase2.py`

New documentation:

- `docs/compliance-intelligence/phase-2.md`
- `docs/compliance-intelligence/phase-2-validation.md`
- `docs/compliance-intelligence/phase-2-pilot-manifest.json`

Updated documentation: `README.md`, `architecture.md`, `data-dictionary.md` and
`source-feasibility.md` under `docs/compliance-intelligence/`. Earlier Phase 0/1
untracked files and unrelated tracked changes remain in the worktree. No dependency,
deployment, public delivery configuration or frontend source file was changed by
Phase 2. See [operation and handoff](phase-2.md#handoff) for the next executable steps.
