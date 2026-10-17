# Current completion and review handoff

Checked 2026-10-17. This report supersedes the input-readiness statements in the
earlier phase validation reports. Implementation and real processing have advanced;
public legal publication remains held. No company outcome has been approved by
the assistant or by a human reviewer.

## Phase status

| Phase | Implemented and exercised | Remaining acceptance work |
| --- | --- | --- |
| 1, cohort and identity | Authenticated SCB acquisition, complete six-segment traversal, canonical registry, conservative resolution and a verified frozen 50-company export. | Human clearance of source reuse/publication. Historical aliases, ownership and foreign parents remain absent unless separately evidenced; current SCB observations cannot supply their history. |
| 2, source ingestion | Broader IMY scan and an incremental repeat bound to the real cohort; URL/version/hash provenance, reference-only retention and failure reporting. | KKV returns HTTP 403. Ordinary permitted access or an official supplied extract is required. Two unique PDFs have no extractable text. Source-population coverage remains unknown. |
| 3, evidence and review | 53 schema-validated private candidates, queue, lifecycle/identity holds, exact excerpts, audit chain and pending human request templates. | Zero evidence-complete records and zero human actions. Resolve dated identity, party role, current status and other blockers before approval. Textless documents require authorized OCR or a supplied accessible version. |
| 4, analytics | All six datasets built and reconciled against the actual cohort and validated empty approved Gold. There are 50 unassessed company rows and 18 authority/year coverage rows. | Real approved authority-publication reconciliation is pending. Case/decision/amount/ranking tables have no rows; unknown sanction measures remain null. Financial history is unavailable. Criminal convictions remain a separate unmeasured scope. |
| 5, explorer and export | Four responsive views, structured SVG/PNG/CSV/Markdown export, independent final-review gate, aggregate progress panel, browser/accessibility/security/build checks. | The exact private stage is pending human review. Company findings, rankings and legal exports are withheld. No deployment was performed. |

The public progress panel is processing metadata. It cannot supply a legal finding,
company name, excerpt or sanction amount. Both its producer and browser parser
reject extra fields, unsupported source URLs and inconsistent counts.

## Reproducible cohort

SCB retrieval ran from `2026-10-17T14:01:50.186821+00:00` to
`2026-10-17T14:02:22.475675+00:00`. Source as-of date: **2026-10-17**.
The private source snapshot contains 62,113 rows, 47,080 normalized legal entities,
15,033 excluded rows and no conflicting identities or duplicate observations.
Excluded source rows include natural-person identifiers and foreign legal persons
without their local registration identity. They remain private and are not product
downloads. There are 43,836 eligible active Swedish ABs.

| Primary SNI 2025 | Segment | Received rows | Pages |
| --- | --- | ---: | ---: |
| 58290 | Other software publishing | 4,277 | 1 |
| 62100 | Computer programming | 31,623 | 7 |
| 62201 | Computer consultancy | 21,492 | 5 |
| 62202 | Computer facilities management | 1,440 | 1 |
| 62900 | Other IT and computer services | 1,031 | 1 |
| 63100 | Data infrastructure, processing and hosting | 2,250 | 1 |

Every industry reached its terminal page; count-before, received and count-after
agreed. SCB has no immutable point-in-time token. Equal counts do not prove that
attributes stayed unchanged during the sequential acquisition.

Selection sorts employee size class descending, then organization number ascending.
Twenty-five selected entities are above class 8; the remaining 25 come from the
72 eligible entities in class 8 (200–499 employees). This is a size-class sample
with a deterministic tie rule. It is not a ranking by exact headcount, revenue or
corporate-group size. Original membership is preserved independently of search.

- Cohort ID: `se-it-50-2026-10-17`.
- Membership SHA-256: `f0866d8ad65709168017e8cdaf0e2e19b772c6bfaeeb908eb187233f96d8b3d5`.
- Population manifest SHA-256: `95af1fe6480472f95f70d639df32e3e15eb7ad04de583a7c75198054ee47f8cd`.
- Canonical private bundle: `.research/compliance-intelligence/cohort-se-it-50-2026-10-17-v2`.
- Exports: [private cohort CSV](../../.research/compliance-intelligence/cohort-se-it-50-2026-10-17-v2/cohort.csv), `cohort.json`, `methodology.json`, `registry.duckdb`, evidence and integrity manifest in that bundle. The CSV link is local; private bundles are not committed to GitHub.

The original bundle without `-v2` remains intact. Version 2 preserves its exact
membership hash and corrects private DuckDB source reuse flags to `unverified`.
Its materialization is newly sealed; it is not a new sample. No human reuse review
was invented. `build --private-only` permits selection only from a complete directly
acquired SCB population. The default reviewed-source requirement and public gates
remain enforced. Local CSV/Parquet completeness and reuse requirements are unchanged.

The documented fields, SNI codebook, key activation and local fallback are in
[Phase 1 operation](phase-1.md). The source is the
[official SCB register API](https://www.scb.se/vara-tjanster/bestall-data-och-statistik/foretagsregistret/avgiftsfria-uppgifter-i-foretagsregistret/).

## Authority and review coverage

The expanded cohort-bound run is `82f07b44-b305-4e88-8ee9-7fdeb6399484`, finished
`2026-10-17T14:15:32.196110+00:00`. Its private coverage file is
`completion-decisions-2026-10-17/gold/runs/82f07b44-b305-4e88-8ee9-7fdeb6399484/coverage.json`
under `.research/compliance-intelligence/`.

| Source | Observation | Coverage meaning |
| --- | --- | --- |
| [IMY sanction publications](https://www.imy.se/om-oss/beslut-publikationer-och-remisser/beslut-om-sanktionsavgift/) | 1 list, 45 record-page attempts and 73 document attempts; no HTTP/extraction failures in this run. Current storage has 56 PDF URL references with 55 distinct byte hashes. | `bounded_partial`; list traversal is not a complete authority diary or verified court/appeal search. OCR gaps remain. |
| [KKV case list](https://www.konkurrensverket.se/konkurrens/tillsyn-arenden-och-beslut/arendelista) | Official listing returned HTTP 403; source halted. | `blocked_access`; no inferred zero cases, proxy/cache bypass or unsupported alternative extraction. |

Attempt counts include repeated discoveries and aliases. They are not counts of
distinct cases, decisions or companies. Identical PDF bytes are extracted once.
The 55 unique PDF versions produced 53 candidates and two `no_text_ocr_not_run`
holds. Original bytes were hash-checked in memory; no unapproved permanent PDF
copy or external LLM transmission was made.

There are 19 provisional case groups. All 53 records have unresolved identity or
other evidence blockers; all 50 cohort members have only partial-publication-scan
observations. A cohort-company contextual mention was found in a document whose
direct decision subject is another legal entity. It is prioritized for party-role
review, with `context_only` scope, and has not become a sanction against the cohort
company. Group ownership and group-turnover references do not transfer liability.

The prepared audit has 113 verified entries, head
`9e7c7ca8cdf4d2fd46b3e05b2929e3a1ac0f909972733ff8a5a710ade95f340f`.
Human actions, publication-eligible records and approved Gold decisions are all zero.
This is workflow status, not evidence of zero sanctions or violations.

Current review artifacts are private:
`.research/compliance-intelligence/completion-review-ready-2026-10-17/`.
`REVIEW.md` includes exact source URLs, hashes, claims, page/character excerpts,
cohort-context labels and blockers. `record-review-templates.json` and
`final-review-template.json` are pending templates with null reviewer IDs and false
attestations. They confer no approval. `cohort-context.json` keeps contextual
candidate IDs separate from direct party identity. Earlier handoff bundles remain
historical snapshots.

## Operator commands and exact next steps

Run from the repository root. Keep `SCB_API_KEY` in the ignored local environment
or GitHub environment secret; never put it in a command, artifact or public asset.
The GitHub environment secret exists, but the local workflow change still needs
normal code delivery before the remote job can use it.

```sh
python -X utf8 platform/compliance_intelligence/cli.py status --cohort .research/compliance-intelligence/cohort-se-it-50-2026-10-17-v2
python -X utf8 platform/compliance_intelligence/cli.py verify --bundle .research/compliance-intelligence/cohort-se-it-50-2026-10-17-v2
python -X utf8 platform/compliance_intelligence/review_cli.py --root .research/compliance-intelligence/completion-decisions-2026-10-17 queue
python -X utf8 platform/compliance_intelligence/review_cli.py --root .research/compliance-intelligence/completion-decisions-2026-10-17 verify-audit
```

1. Assign actual human reviewer principals in a protected roster, following
   [Phase 3 operation](phase-3.md). Inspect originals, party roles, dated legal
   identity, current appeal/finality evidence and reuse/privacy terms. Correct
   scoped proposals with exact excerpts; abstain on unavailable evidence.
   A reviewer name alone is not approval. Rejection is an explicit review action.
2. Apply each completed request copied outside the sealed handoff with
   `review_cli.py --root PRIVATE_ROOT review --request ACTUAL_REQUEST.json --reviewers ACTUAL_ROSTER.json`.
   The publication reviewer for a negative record must be independent of its
   preparer and prerequisite approvers. Do not approve a brand or group context
   as the sanctioned legal operator.
3. After corrections/reviews, rebuild the handoff in a **new** output directory:

   ```sh
   python -X utf8 platform/compliance_intelligence/completion.py prepare --root .research/compliance-intelligence/completion-decisions-2026-10-17 --cohort .research/compliance-intelligence/cohort-se-it-50-2026-10-17-v2 --output .research/compliance-intelligence/NEXT_REVIEW_BUNDLE
   ```

   Omit `--extract` after human corrections. Explicit `--extract --refresh-references`
   is available for a deliberate new evidence run; it does not preserve the
   assumption that previous candidate corrections remain current.
4. Review the exact regenerated public projection and its presentation/export
   behavior. Current pending stage-manifest SHA-256:
   `27227c570d30830c15b10b0979d02ec0cdf647f3b3d64dd8786ac28c450097ee`.
   Current payload SHA-256:
   `174bb0930fb302c64443306d81adab405b819d5498ee85049595a819f9ec0fb6`.
   Use the new hashes if anything changes. The independent final reviewer completes
   the template with actual UTC review/expiry dates and privacy/reuse clearance.
   A cohort-only release can be reviewed with no legal findings; it still requires
   registry publication clearance and cannot imply that companies have no cases.
5. Promote using [the Phase 5 command](phase-5.md), with `--root` pointing at the
   decision store, `--cohort` at version 2 and `--release`, `--analytics`, `--staged`
   at the new handoff's `gold`, `analytics`, `explorer-stage` directories. Approval
   must bind that exact stage; promotion revalidates it against live review state.
6. Recheck the normal production build and security tests, then deliver the reviewed
   assets using existing Cloudflare static hosting. Do not upload `.research/`,
   review databases, raw SCB rows or the private handoff to R2/public hosting.
7. KKV expansion remains a separate access dependency. Obtain ordinary permitted
   access or an official supplied extract, verify source layout/robots/terms, then
   rerun the existing adapter and the same review/analytics process. Financial and
   ownership datasets also require their own real evidenced inputs.

For aggregate-only processing status, `completion.py publish-progress --bundle
PRIVATE_BUNDLE` writes `frontend/public/data/compliance/progress.json`. It never
writes the legal release. The production build validates this metadata separately.
The current public legal release remains `unavailable`.

## Validation and changed files

| Check | Latest result |
| --- | --- |
| Full platform Python tests | 631 passed, 2 skipped. |
| Additional final Phase 1 reuse/materialization regression | 34 passed. |
| Handoff and public-progress producer tests | Included in full suite; no fabricated human approval accepted. |
| Frontend unit tests | 116 passed. |
| Full desktop/mobile browser tests | 160 passed, 2 skipped after updating stale CV-path assertions. |
| Production CSP/security browser checks | 3 passed. |
| TypeScript, frontend formatting, production build | Passed. |
| npm dependency audit | Zero vulnerabilities. |
| Required Idea Lineage capture | Attempted; existing journal raises `KeyError: 'created_at'` in `platform/idea_lineage/store.py:80`. Product checks are unaffected; the unrelated journal was left unchanged. |

Logs are ignored files under `tmp/compliance-completion-*.log`. The first browser
run had four CV expectations using the old relative path; the production path was
already absolute for canonical company URLs. Only those test expectations changed.
Mobile and desktop processing-panel screenshots were visually checked; the panel
uses shared grey surfaces, font, spacing and muted violet border. Axe checks passed.
No new style token, animation, dependency or homepage edit was added in this work.

Files changed in this completion increment:

- `platform/compliance_intelligence/cohort.py`, `cli.py`: explicit private SCB selection, accurate status/verification, bulk DuckDB materialization and truthful source-reuse flags.
- `platform/compliance_intelligence/completion.py`: extraction/review handoff, approved-only analytics/staging, contextual identity labels and aggregate-only public progress.
- `platform/compliance_intelligence/explorer.py`, `scripts/check_compliance_release.mjs`: progress parser included in reviewed presentation fingerprint; production metadata validation.
- `frontend/src/compliance/progress.ts`, `ComplianceExplorer.tsx`: strict processing metadata contract and responsive unavailable/review status panel.
- `frontend/tests/fixtures/compliance.ts`, `unit/compliance.test.ts`, `compliance.spec.ts`, `cv-viewer.spec.ts`: metadata adversarial, accessibility/navigation and existing path regressions.
- `platform/tests/compliance_intelligence/test_phase1.py`, `test_completion.py`: private-only/reuse, bulk registry, sealed pending handoff and public field-boundary checks.
- `frontend/public/data/compliance/progress.json`, `release.json`: real aggregate processing metadata and the accurate unavailable reason `human_review_pending`, without legal findings.
- `docs/compliance-intelligence/README.md`, phase operation/validation notices, `completion.md`, `completion-status.json`: current state and handoff.

All earlier phase schema, connector, review, analytics, explorer/export and
job/company modules remain in use; their original changes are listed in each
phase validation report. The shared worktree has substantial unrelated edits.
No commit, push, workflow dispatch, R2 upload or Cloudflare deployment was performed
by this completion increment.
