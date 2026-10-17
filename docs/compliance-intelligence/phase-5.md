# Phase 5 explorer and research export

Implemented 2026-10-17. Open `#compliance` from the portfolio's Projects menu.
The explorer has four persistent hash routes, with filters in the query string:

| Route | Purpose |
| --- | --- |
| `#compliance` | Cohort observations, approved decisions by issuer, timeline, final amount distribution and full-release source coverage. |
| `#compliance-rankings` | The frozen 50-member table, separate administrative-count and currency-specific monetary comparisons, legal identities and expandable evidence. |
| `#compliance-company?company=CANONICAL_ID` | Direct legal-entity information, individual decisions, current appeal/reversal context, register provenance, workforce intervals and reviewed relationships. |
| `#compliance-stories` | Deterministic comparisons with structured CSV, methodology Markdown and social graphic exports. |

The public legal artifact is an explicit unavailable state. A verified real
company cohort now exists privately; no real Gold decision has human approval.
An independently validated aggregate progress artifact reports the frozen sample,
dated source processing and review counts. It contains no company findings.
See [current completion](completion.md). Production
contains no test companies, invented chart points, sample amounts or implied clean
company counts. Every route remains navigable and explains the missing inputs.
The public methodology can be downloaded even when company data are unavailable.

## Design and interaction

The intended reader is a researcher or portfolio visitor checking what public
decisions establish about a particular legal entity. The interface supports
comparison followed by inspection of exact sources. It reuses `ReportShell`, the
shared navigation, `ChartCard`, `DashGrid` and `RankBars`. Helvetica comes from
`--font`; neutral surfaces, spacing and borders use existing tokens. Muted violet
uses the existing `--series-3` token. No second theme or font package is added.

The fixed cohort/verification notice is the main visual marker: named legal
identity, dated approval and source coverage stay beside the comparison. There is
no score gauge, severity-colored leaderboard or decorative motion. The homepage
intro and animation sources were not edited. Only the shared project registry and
route integration expose this project through the existing navigation.

Filters select originating authority, case category, operative known legal status,
inclusive originating-decision dates, SNI industry and employee size class. The
date window must remain inside the reviewed published window. Later court context
stays attached to the originating lineage. The original sample is never redrawn.
Entity scope switches between individual companies and dated cohort-member group
aggregates. Group labels link to that root's own identity. A foreign parent does
not acquire a subsidiary's legal outcomes on its company detail page.

Administrative sanctions can be appealed. Final amounts are a separate metric;
SEK and EUR have separate sorting and totals. Unassessed entities stay null and
have no observed rank. Counts and ranks are observations within approved evidence,
not risk or ethics measures. Criminal convictions remain separately unmeasured
under the current upstream contract. Verified revenue metadata are unavailable;
the detail view says so and uses register employee intervals without a fabricated
headcount. See the [public methodology](phase-4-methodology.md).

Full-release authority/year coverage is labeled as preceding interactive filters.
Field completeness in approved rows is distinct from source-population or search
coverage; the latter denominators remain unknown. Selected decision/document counts
on the overview and narrative follow the interactive filters. Native issuer and
originating authority are deliberately named separately.

Native form controls, disclosure elements and tables support keyboard use. Scroll
regions keep wide tables local on phones; links, source hashes and company names
wrap. Headings, focus indicators, live selection counts and chart text alternatives
are provided. Charts use a zero baseline and visible numeric labels. The module
adds no animation and follows the existing site's responsive report layout.

## Stage and review the public projection

The producer is
[`explorer.py`](../../platform/compliance_intelligence/explorer.py). It requires
the real verified cohort, a current approved Gold release and a validated Phase 4
analytics bundle. The analytics input must use legal-entity scope without
categorical filters. Its reviewed time window bounds browser exploration.
Use the actual private paths produced by Phases 1–4; the names below are examples.

```sh
python platform/compliance_intelligence/explorer.py stage --root .research/compliance-intelligence/phase-2-pilot --release .research/compliance-intelligence/approved-gold --cohort .research/compliance-intelligence/cohort --analytics .research/compliance-intelligence/analytics-release --output .research/compliance-intelligence/explorer-stage --prepared-by ACTUAL_PREPARER_ID
```

Staging writes a sealed private bundle with `review_status=pending` and returns the
exact stage-manifest SHA-256. It does not write a public file or grant approval.
It revalidates current Gold/cohort/analytics eligibility and recomputes per-lineage
measures through the Phase 4 transform. No private candidate is a metric input.
The projection includes only cohort companies and reachable reviewed relationships,
approved decision facts, allowed public source references and method/coverage
metadata. Original bodies, excerpts, reviewer IDs and private paths are excluded.

An authorized human publication reviewer must inspect the exact staged projection,
its identity/relationship reuse and the deterministic presentation/export behavior.
The final reviewer must differ from `prepared_by`. The operator-maintained roster
has the same human/role structure as Phase 3. The approval JSON requires:

| Field | Required value or meaning |
| --- | --- |
| `reviewer_id` | Actual roster principal with `kind=human` and the `publication` role. |
| `disposition` | `approved`. |
| `human_attestation`, `examined_evidence` | Explicit true after the human examination. |
| `privacy_cleared`, `reuse_cleared` | Explicit true for this registry, relationship, decision and export projection. |
| `stage_manifest_sha256` | Exact hash returned by staging. |
| `reviewed_at` | Actual UTC timestamp, at or after stage creation and not in the future. |
| `valid_until` | Actual UTC deadline after review, no more than 30 days after that review and no later than any selected evidence deadline. |
| `rationale` | The reviewer's substantive reason for approving this projection. |

No actual human approval file is generated by this task. After a real review:

```sh
python platform/compliance_intelligence/explorer.py promote --root .research/compliance-intelligence/phase-2-pilot --release .research/compliance-intelligence/approved-gold --cohort .research/compliance-intelligence/cohort --analytics .research/compliance-intelligence/analytics-release --staged .research/compliance-intelligence/explorer-stage --approval .research/compliance-intelligence/final-approval.json --reviewers .research/compliance-intelligence/reviewers.json
npm.cmd run compliance:check
npm.cmd run build
```

Promotion revalidates all inputs, regenerates and compares the exact staged
projection, enforces the independent final review and records its private audit
event. Only then does it atomically replace
`frontend/public/data/compliance/release.json`. There is no arbitrary production
output argument and no upload. The review binds the public payload and the exact
module/model/export/CSS source fingerprint, with line endings normalized to LF.
Changing those presentation files
requires restaging and another final review. The build gate rejects corruption,
missing approval, an expired release or a changed presentation fingerprint.

The envelope's SHA-256 is an integrity check, not a digital signature. The security
boundary includes the authorized private roster, approval-file handling, protected
repository/deployment and operator permissions. A repository administrator who can
rewrite the application and its checks is outside this local gate's trust model.

## Withdrawal and freshness

The browser validates the envelope hash, 50-member identity shape, allowed source
protocols, attribution, metric types and approval/evidence deadlines before showing
company results. It stops displaying expired results and checks freshness before
downloads. It reloads the current release at least once per minute while active
and on focus. Failed validation hides results; it does not fall back to cached
fixture values. The specific release URL uses `Cache-Control: no-store`.

The earliest deadline includes legally reviewed status dependencies, even when
they have no independently public company decision row. Date-only Phase 3 evidence
deadlines become UTC midnight at the start of that date
for public expiry, a conservative boundary. A final projection review cannot
extend underlying legal verification. Legal changes before the deadline still
need an operator action; this static application has no connection to private
review-store changes. Withdraw locally and redeploy the replacement through the
normal site delivery process:

```sh
python platform/compliance_intelligence/explorer.py withdraw --root .research/compliance-intelligence/phase-2-pilot --reason review_withdrawn
```

Other supported reasons are `evidence_changed` and `reverification_required`.
Withdrawal writes only an unavailable state and records a private audit entry.
It cannot erase already downloaded files or social posts. Deployment propagation,
offline browsers and copies remain publication risks; retract or replace shared
graphics when a decision is reversed or the evidence changes. Never describe the
polling interval as immediate global revocation.

## Research exports

The research page has reproducible issuer counts, decision timelines and native-
currency final amount distributions. Text describes the selected approved records;
there is no LLM-written company narrative or inferred allegation/finding. More than
eight issuer categories are grouped as other issuers; long year ranges use labeled
adjacent year intervals. The underlying decision CSV preserves every selected
approved decision and its native monetary rows; the chart CSV preserves the exact
plotted aggregates.

SVG is generated from structured values at 1200 × 1200 or 1200 × 1500. PNG draws
that same SVG onto an exactly sized canvas. Nothing is extracted from a screenshot
or the DOM chart. Both exports include title, originating-decision period, cohort
snapshot, filters, current-status snapshot, review expiry, release identifier and
visible exact source URLs that fit the reference area. SVG metadata contains all
source URLs and hashes. The companion Markdown includes every exact reference,
the full release/membership hashes, filters and the public methodology. PNG is
inherently a raster image; download the Markdown for complete machine-readable
references and clickable links.

Native currencies are never summed together. Final-effective monetary rows alone
enter distributions; original amounts remain traceable in the decision CSV. Money
sorting and totals use integer cents (`BigInt`) to preserve decimal precision.
CSV fields are quoted and formula-like cells are neutralized before spreadsheet
use. SVG text/attributes are XML-escaped; there are no external images, scripts or
font requests. Helvetica falls back to Arial where unavailable. PNG decode or
canvas failures report an error and leave SVG/CSV available.

## Acceptance still requiring real inputs

The authorized register and frozen 50 members now exist privately. Obtain real
record-level human approvals and complete original-publication reconciliation.
Then stage the public projection, inspect the four views and exports privately,
obtain the independent exact-stage approval and promote. Run the build/security/
browser checks and deploy through the existing site process. Nothing in this
phase approves the existing real candidates or publishes company outcomes.
