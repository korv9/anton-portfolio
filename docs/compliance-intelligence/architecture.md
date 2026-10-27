# Architecture

Status: designed 2026-10-16 and implemented through Phase 5 (see the
[README](README.md)). [Phase 1](phase-1.md) adds register acquisition, identity
resolution and private frozen-cohort bundles. Phase 2 adds private source acquisition
and candidate extraction in a separate Bronze/Silver/Gold database. Phase 3 adds scoped
extraction, decision links, human review, reverification and approved release staging.
No legal record has human approval. Production legal-domain tables are not populated
from parser output.

## Storage and execution boundaries

| Stage | Intended contents | Boundary and existing reuse |
| --- | --- | --- |
| Acquisition | Register snapshots and original authority/court documents | Separate private store and private DuckDB file outside repository/public warehouse upload roots. Reuse `rawstore` retry, exact-byte hash and manifest semantics after supporting this private root. |
| Bronze | Immutable fetch versions with URL, request, timestamp, original-byte digest and response metadata | Never put unreviewed evidence in `warehouse/raw` with its current publishing configuration. Credentials, personal identifiers and authentication headers must be excluded from manifests/logs. |
| Silver | Legal entities, aliases, dated relationships, cases, decisions and claim-level evidence | Typed tables in a private database; verified organization numbers anchor identity. Keep extraction candidates and reviewed assertions distinguishable. |
| Review | Identity decisions, legal interpretation, privacy clearance, publication authorization | Private audit trail tied to exact record/evidence versions. Human decisions cannot be inferred from a successful parser or dbt test. |
| Gold | Approved, minimized entity/outcome facts and coverage observations | Future dbt subject follows existing bronze/silver/gold conventions, but reads approved projections only into the public warehouse. |
| Export | Cohort/methodology CSV and JSON; later Parquet analytical facts | Explicit column allowlist, source links, status/as-of dates and release manifest. Exclude raw PDFs, personal details, reviewer IDs, extraction text and private object references. |
| Delivery | Immutable reviewed release and compatible snapshot pointer | Reuse `platform/publish/release.py` and `configs/delivery/`; publication must be a separate authorized operation after tests/review. Add no live group now. |

The Phase 0 namespace `compliance_intelligence` describes domain contracts, not a
fourth production medallion layer. `open_contract_database()` always uses
`:memory:`. Never copy its DDL into the publicly backed-up `portfolio.duckdb`.
Phase 1 may persist reviewed registry data only after confirming reuse terms and
the private/public boundary. Before any enforcement acquisition, private storage
must be provisioned with separate credentials and no public access. A private prefix
inside the existing public R2 bucket is insufficient.

## Company identity and group scope

`dim_company` represents one registered entity identity. A Swedish legal entity
keeps its `company_id` through a legal-name change; a newly registered successor has
a distinct identity. Proposed Swedish ID: `se:orgnr:<10 normalized digits>`.
Phase 1 must validate length, permitted legal-entity number class and Luhn checksum
against register evidence; format alone is not verification. Sole traders and
natural-person identifiers are excluded from the cohort.

Registered branches can be represented with `entity_kind=registered_branch`, linked
to their legal operator by `branch_of`. They are excluded from the initial cohort
of Swedish limited companies. A foreign parent has its own local registry number,
registry authority and registration country. Its Swedish `organization_number` is
null. Never invent a Swedish organization number for a foreign parent.

`country_code` means country of registration, not customer market, tax residence,
ownership nationality or country of alleged conduct. `legal_case.jurisdiction_country`
is separate. `authority` identifies the issuing authority/court, not the issuer of a
security. A securities issuer is a company with role `issuer`; it can be different
from the sanctioned shareholder. A natural-person sanctioned party remains outside
the public company identity model, even if a company is named in the document.

Aliases are evidence-backed and dated. A brand may have multiple legal operators;
identical names can return multiple candidates. Relationships record
`subsidiary_of`, `merged_into` or `branch_of` with effective intervals and evidence.
A corporate group is derived from a reviewed, dated ownership graph; it is not a
legal entity or an alias. A future group display can reference the parent identity
and relationship version without collapsing member identities.

Only a verified exact organization-number match supports automatic identity
confirmation in Phase 1. A contradictory name, historic name outside its valid
period, unclear operator or multiple candidates requires review. Fuzzy/name matches
are candidates with evidence and reasons, never silent assignments. Confidence is
a category with reasons (`verified`, `ambiguous`, `unverified`), not an invented
probability. Store candidate sets and match-method provenance privately in Phase 1.

Decisions attach through `decision_company` to directly documented parties. Group
membership never propagates a sanction. Joint liability needs explicit decision
evidence identifying each liable legal entity and scope. A merger preserves the
original case party and adds the succession relationship; it does not rewrite history
or establish transfer of liability by itself. An issuer, customer or contextual
mention cannot enter sanctioned-party metrics.

## Fixed cohort design

The proposed population is active, Swedish-registered limited companies (`AB`,
legal entities) with a primary SNI 2025 code in one of six segments: 58290 other
software publishing, 62100 computer programming, 62201 computer consultancy, 62202
computer facilities management, 62900 other IT and computer services, and 63100 data
infrastructure, processing and hosting. Codes are stored as five digits with the
classification version. Foreign-owned Swedish subsidiaries
qualify; foreign parents, branches and pure holding entities do not qualify merely
because their groups operate IT businesses. Multiple qualifying subsidiaries may
appear because the unit is a legal entity, not a corporate group.

Select 50 entities by descending SCB employee-size-class order, then ascending
normalized organization number. Freeze the codebook for class ordering and exclude
unknown/missing class values with counts and reasons. This is a size-class-based
sample, not a claim to identify the 50 largest firms by exact employment. If the
50th position falls within a broad class, the tie-break is deterministic but
economically arbitrary; publish that limitation and boundary class size. Avoid
mixing group turnover with entity employee classes. If a complete eligible population
or 50 verified entities is unavailable, fail selection and document the gap.

`cohort_definition` records a population document/hash, actual snapshot as-of date,
methodology JSON/version and selection code SHA. Do not backdate a current register
snapshot to the audit date. `compliance_cohort` stores the selected identities,
original SNI and size-class attributes, source and ranks. Freeze a canonical
membership hash and original export. Re-running against the same snapshot and code
must reproduce the same ordered 50 identities and hash.

After freezing, dissolution, mergers and changed names are longitudinal annotations.
There are no replacements or silent sample refreshes. A later cohort receives a new
ID and remains comparable only with its own methodology. Exploratory company search
is a separate read-only population query; its results cannot change cohort membership
or denominators. Selection must be completed independently of enforcement searches.

## Cases, events and decisions

One `legal_case` is one authority/court docket, namespaced by issuing body and
reference number. An administrative file and an appeal court file are separate
cases. Multiple documents and decisions can belong to a case. A later `case_link`
relation must record `appeal_of`, `remittal_of` and `related_to`, with source evidence.
A separate `decision_link` records which act upholds, varies, quashes or supersedes
another act. Both are designed here and intentionally absent from the Phase 0 DDL.

`case_event` is an observed procedural occurrence. Preserve allegation,
investigation, regulatory finding, administrative sanction, judgment, final judgment,
criminal conviction, acquittal and closure without finding as different categories.
These are not ordinal severity levels. An allegation does not imply that an
investigation exists, and a closed case does not imply a violation.

`legal_decision` is an authority/court act with its own status, source, legal basis,
date and monetary remedy. `decision_kind` states the forum/type; `outcome_type`
states its result. A criminal conviction requires a criminal judgment and separate
legal review. A corporate fine must retain its actual legal basis and party; it
must not be relabeled as a natural person's conviction. The initial product should
exclude personal criminal-history records entirely.

Decision date, publication date, event date and retrieval time answer different
questions and may be missing independently. Never fill an absent date from another
field. `decision_status`, `appeal_status`, `finality_status` and `stay_status` are
separate. A sanction may be issued, appealed and stayed at the same time. Default
appeal/finality values are `unknown`; the passage of a nominal appeal period or a
missing appeal search result is insufficient to assert finality. Use court/authority
confirmation with field-level evidence and a verification date.

Appeal outcomes preserve the original decision and link a new decision with the
upheld, varied, quashed or remitted disposition. Do not overwrite amounts/history or
count the same proceeding twice. Later analytical rules must choose either original
orders or effective outcomes as of an explicit date. Joint amounts remain at the
decision grain; joining multiple parties must not multiply the amount.

## Evidence and review

Each source version has a URL, original-byte SHA-256, publisher, fetch time,
publication date where known, content type, size and access/reuse/privacy status.
Content-addressed private storage retains changed versions; equal bytes at different
URLs can share a blob without collapsing fetch provenance. HTTP validators are
cache hints, not document identity. Hash derived/OCR text separately, never in place
of the original document. Pin extraction tool/model version, language and page/section
locators. A model-generated summary is an unreviewed derivative, not authority text.

`source_evidence` links each material assertion to a document and locator: identity,
party role, date, legal basis, amount, appeal and finality all need support.
`record_hash` is SHA-256 over a canonical JSON representation of the full reviewed
record plus ordered evidence IDs and document hashes. Future serialization must use
sorted keys, UTF-8, stable ISO dates/UTC timestamps, decimal strings and no NaN.
The original-document hash and the structured-record hash have different meanings.

Workflow: unreviewed extraction enters identity review; unresolved identities are
held. A legal reviewer verifies categories, amounts and current appeal/finality.
Privacy/reuse review clears the actual public projection. A different publication
reviewer approves that exact record/evidence version and export artifact. Record
reviewer, time and rationale for every action. Corrections or new source versions
invalidate relevant approvals and reopen review. Rejected/withdrawn records are
held, with reasons preserved privately. Publication requires all required approvals,
no open identity conflict and fresh verification. There is no Phase 0 exporter that
could bypass this workflow.

The Phase 0 SQL implements default-unreviewed states, named/timestamped final review
actions, typed keys, monetary constraints and several legal category guards.
It does not enforce independent reviewers, evidence completeness, all cross-table
semantics, immutable cohorts or actual publish rights. Phase 1 now adds identity
validation and application-level cohort freezing. Enforcement evidence and publication
controls now have a separate private Phase 3 implementation (`review_cli.py`). Passing
SQL tests is insufficient approval to publish; its human gates, source freshness
and release validation must also pass.

## Coverage and uncertainty

Maintain one observation per company/source/search window/run. Its query manifest
records identifiers, aliases and effective periods searched, filters, pagination,
terminal-page proof, retrieval failures and document-request outcomes. A complete
search means complete execution against that source within that window, not complete
knowledge of all proceedings. Record source-selection bias separately.

| Measure | Definition | Interpretation |
| --- | --- | --- |
| Cohort integrity | Verified unique members / target 50 | Must be 50/50 before cohort freeze; no records implies not measured. |
| Search execution coverage | Complete applicable company/source/window cells / all applicable planned cells | Always show numerator, denominator and restricted/failed/partial cells; curated sources remain incomplete histories. |
| Identity ambiguity | Unresolved candidate-party matches / all candidate-party matches | Show candidates held from publication; zero denominator gives null. |
| Evidence completeness | Supported required assertion fields / all required assertion fields | Required fields include party, category, amount when present, and claimed appeal/finality. |
| Review completion | Required approved record-version reviews / required reviews | Unknown or rejected reviews do not pass; no averaging across review kinds. |
| Verification freshness | Eligible records verified within policy interval / eligible records | Proposed policy: 30 days for open/appealed records, 90 days for final records; show max age. These are project policies, not statutory limits. |
| Finality uncertainty | Decisions with unknown finality / decisions assessed | Display alongside separate final/non-final counts. |
| Document accessibility | Retrieved readable primary documents / identified relevant documents | Show request-required, withheld, unavailable and OCR-limited counts separately. |

Use a proposed analysis window beginning 2018-05-25 and ending at the declared
analysis as-of date, while retaining older related decisions needed to explain an
appeal. This improves comparability with GDPR-era IMY publication but does not
equalize authority coverage. Review the window before enforcement work. Use the
wording "no matching published record found in the searched sources/window" only
when a documented search supports it. Never derive a company innocence/risk rating
or sanction probability from missing results.

## Phase 4 analytical boundary

The analytics CLI (`analytics.py`) reads only current-valid Phase 3 approved Gold and
a verified fixed 50-member Phase 1 cohort. It rechecks legal-entity identities and
original-document hashes/excerpts before writing six isolated `gold` tables as
DuckDB, JSON and Parquet. No private candidate becomes an analytical fact. A status
dependency may validate an approved row without becoming a separate public fact.

Explicit reviewed decision links define sanction lineages before date or status
filters apply. Native case/issuer IDs remain distinct. Appeals and duplicate
documents cannot create another obligation; cross-company links and ambiguous
branches hold the build. Original and final-effective amounts have separate roles
and native currencies. Cohort-member group aggregation retains legal attribution
on every fact. Criminal-law scope stays separately unmeasured under the current
Swedish Gold contract.

Private analytical bundles include the cohort definition, filters, status snapshot,
source reconciliation, unknown coverage denominators and observation-only metric
warnings. A query validates current approvals and recomputes SQL/Parquet/JSON
agreement; withdrawn/expired Gold makes an older analytical release invalid.
This is not a public publisher or a change to whole-warehouse R2 backup. Public
delivery must run the same gate and carry the [methodology](phase-4-methodology.md).

## Phase 5 public explorer boundary

The explorer producer stages an allowlisted public projection from live-validated
Gold, cohort and analytical bundles. Per-lineage measures reuse the Phase 4 Python
transform; browser filtering sums those reviewed contributions with exact native-
currency cents. Direct entity facts stay separate from group membership. A final
independent human review binds the sealed projection and presentation-source hash.
Promotion rechecks current approvals and writes only the designated public JSON
envelope. Original documents, excerpts and review-store records remain private.

The explorer (unrouted since 2026-10-21) reads this same-origin envelope without the
private warehouse or a new R2 delivery group. Its build gate and browser validate approval, integrity
and expiry. Pending, invalid, unavailable and expired data never fall back to mock
company metrics. Active pages poll the current envelope and check it on focus;
operators must withdraw/redeploy when underlying reviews are revoked. Offline
copies and exported images cannot be recalled through that mechanism.

Research graphics come from structured aggregates rendered as SVG and canvas PNG.
CSV and methodology exports retain filters, source references and fingerprints.
See [Phase 5](phase-5.md) for review operations, cache boundaries and limitations.
