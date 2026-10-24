# Data dictionary

The current-ad identity extension (`job_company_link`, `company_resolution_review` and the
hiring-context marts) is described under [Job/company tables](#jobcompany-tables).

Contract version 1, 2026-10-16. Executable field types and local constraints are in
[`schema.sql`](../../platform/compliance_intelligence/schema.sql).
These private domain contracts are materialized by the Phase 1 builder when verified
register input is supplied; they are not production dbt models. The
[`DocumentReader`](../../platform/compliance_intelligence/contracts.py) protocol has
no fetching implementation.

## Conventions

All IDs are strings with stable namespaces. Organization numbers are identifiers,
never numeric measures. Dates use ISO calendar dates; timestamps use timezone-aware
UTC values. Validity intervals are `[valid_from, valid_to)`; a null endpoint means
unknown/open, so it cannot prove that a relationship existed on an arbitrary date.
Code and registry snapshots must be versioned outside the table contents as well.

Every SQL column declared `not null` is structurally mandatory; primary keys are
non-null. Other columns are nullable. Null means unknown/not supplied, except where
an explicit status documents not applicable or no monetary remedy. Null amounts
must never be coerced to zero. A `sanction_type=none` is an affirmative source-backed
statement; `unknown` is the default. Enum values must be preserved in exports or
mapped through an explicitly versioned label dictionary.

Common fields:

| Field | SQL type | Meaning |
| --- | --- | --- |
| `source_document_id` / `document_id` | varchar, FK where declared | Exact primary-source version supporting the row; additional field evidence goes in `source_evidence`. |
| `last_verified_at` | timestamptz, required where present | When the represented information was checked against the supporting source, distinct from download/build time. Reverification also needs an audit entry. |
| `review_status` | review_state, required, default unreviewed | `unreviewed`, `in_review`, `approved`, `rejected`, `withdrawn`. A row flag cannot replace record-version approval evidence. |
| `record_hash` | varchar, required | Lowercase 64-hex SHA-256 of canonical record content plus supporting evidence versions; see architecture. It is not a document hash. |

## Source document

`source_document`: one fetched document/response version from one source context.
Primary key: `document_id`. Matching bytes across sources do not merge provenance.

| Fields | Type | Meaning |
| --- | --- | --- |
| `document_id`, `source_id` | varchar | Internal version ID and source registry key, such as `imy` or `scb_company_register`. |
| `source_url`, `publisher` | varchar, required | Public primary-source HTTPS URL and publishing body; authority identity remains separately attached to the case. |
| `publication_date` | date, nullable | Publisher's date, unknown if absent; not inferred from retrieval or PDF filesystem metadata. |
| `fetched_at` | timestamptz, required | Retrieval time. Future manifests also record request/filter, redirects, response headers/status and collection completion. |
| `document_hash` | varchar, required | SHA-256 of original response/document bytes, lowercase 64 hex. No newline normalization, OCR or reserialization before hashing. |
| `content_type`, `byte_count` | varchar / bigint, required | Response media type and original byte length greater than zero. |
| `storage_ref` | varchar, nullable/private | Private content-addressed object reference. Excluded from public exports. |
| `access_status` | varchar | `public`, `request_required`, `restricted`, `unknown` (default). Public retrieval is independent of reuse approval. |
| `reuse_status`, `terms_url` | varchar / nullable varchar | `unverified` (default), `permitted`, `restricted`; supporting policy/license URL, with its dated evidence retained privately. |
| `privacy_status` | varchar | `unreviewed` (default), `cleared`, `redaction_required`, `blocked`; applies to this source version, not automatically to every derivative. |
| `last_verified_at` | timestamptz | Common verification field. |

## Company registry

`dim_company`: one current registered identity. Primary key `company_id`; unique
Swedish `organization_number` and unique `(country_code, registry_authority,
registry_number)`. Historic names and identity changes remain in aliases/evidence.

| Fields | Type | Meaning |
| --- | --- | --- |
| `company_id` | varchar | Stable legal-identity ID, proposed Swedish form `se:orgnr:<digits>`. Does not change with brand or legal-name changes. |
| `organization_number` | varchar, nullable for foreign identities | Exactly ten normalized Swedish digits; Phase 1 must add legal-entity class/checksum/register verification. Swedish records require it and match `registry_number`; foreign records leave it null. |
| `registered_legal_name` | varchar, required/nonblank | Register name, retaining diacritics and legal suffix. Search normalization must retain the original. |
| `country_code` | varchar, required | Two-letter country of registration. No inference about headquarters, parent nationality or case jurisdiction. |
| `registry_authority`, `registry_number` | varchar, required | Register namespace and its entity identifier, also usable for foreign parents. |
| `legal_form`, `entity_kind` | varchar | Register legal form; `legal_entity` (default) or `registered_branch`. A registered branch has a distinct register identity but is not a separate legal person. |
| `identity_status` | varchar | `unverified` (default), `verified`, `ambiguous`. Verified requires reviewed register support; no probabilistic score is inferred. |
| `source_document_id`, `last_verified_at` | common | Identity evidence and verification time. |

`dim_company_alias`: one evidenced name/operator association over a validity interval.
Primary key `alias_id`; `company_id` references `dim_company`. Aliases are deliberately
not globally unique. Multiple legal entities may operate the same brand.

| Fields | Type | Meaning |
| --- | --- | --- |
| `alias_id`, `company_id`, `alias` | varchar, required | Association ID, operator identity and nonblank original name. |
| `alias_type` | varchar | `brand`, `trading_name`, `historic_legal_name`. A brand never becomes an independent legal entity merely through this row. |
| `valid_from`, `valid_to` | nullable date | Effective dates supported by the source, not dates a crawler first saw a name. |
| `source_document_id`, `review_status`, `last_verified_at` | common | Support, review and freshness. |

`company_relationship`: one directed relationship assertion over a validity interval.
Primary key `relationship_id`. Self-links are rejected; no group-level case merge
or sanction inheritance is implied.

| Fields | Type | Meaning |
| --- | --- | --- |
| `relationship_id` | varchar | Stable assertion ID. |
| `company_id`, `related_company_id` | varchar, FKs | Child/predecessor/branch and parent/successor/operator respectively. |
| `relationship_type` | varchar | `subsidiary_of`, `merged_into`, `branch_of`. |
| `valid_from`, `valid_to` | nullable date | Effective relationship interval; unknown dates require manual temporal review. |
| `source_document_id`, `review_status`, `last_verified_at` | common | Relationship evidence, review and freshness. |

## Cohort

`cohort_definition`: one versioned selection. Primary key `cohort_id`.

| Fields | Type | Meaning |
| --- | --- | --- |
| `cohort_id`, `as_of_date`, `target_size` | varchar / date / integer | Cohort version, actual population snapshot date and fixed target of 50. No real sample exists yet. |
| `methodology_version`, `methodology_json` | varchar / json | Version plus population filters, SNI/class codebooks, ordering/tie-breaks, exclusions and source references. JSON structure validation belongs to Phase 1. |
| `population_document_id` | varchar, FK | Representative original source document for the selected population. For a multi-page API snapshot, full population provenance is bound by `population_manifest_hash`. |
| `population_manifest_hash` | varchar, required | SHA-256 of the canonical population manifest containing metadata and every original document/request/hash. Added in Phase 1 so a single source page cannot be mistaken for the entire population. |
| `selection_code_sha` | varchar | Git SHA or SHA-256 of selection code. Must identify exact executable selection logic. |
| `frozen_at`, `membership_hash` | nullable timestamptz / varchar | Both null for draft; both present for frozen. Membership hash covers ordered membership and selection attributes using a documented canonical serialization. |

`compliance_cohort`: one selected company in one cohort. Primary key `(cohort_id,
company_id)`; unique rank per cohort.

| Fields | Type | Meaning |
| --- | --- | --- |
| `cohort_id`, `company_id` | varchar, FKs | Cohort and legal-identity membership. |
| `selection_rank` | integer | Deterministic rank 1 through 50. |
| `primary_sni_code`, `sni_version` | varchar | Five-digit primary code at selection and `2007` or `2025`. The proposed first cohort uses 2025. |
| `employee_size_class`, `size_class_order` | varchar / integer | Original class code and explicit codebook ordering, not an estimated exact employee count. |
| `selection_document_id` | varchar, FK | Evidence for this entity's selection attributes. |

The DDL limits membership to 50 ranks. The Phase 1 builder validates population
scope, reviews, eligibility and exactly 50 members before its database transaction.
Sealed, create-once output directories and read-only queries preserve the original
bundle through the supported interface. Hash verification detects file/database
changes; it is not a cryptographic signature or a replacement for filesystem access
control. Exploratory search never inserts memberships.

## Case and decision

`legal_case`: one authority/court docket. Primary key `case_id`; unique
`(authority, authority_case_number)`.

| Fields | Type | Meaning |
| --- | --- | --- |
| `case_id` | varchar | Stable namespace-qualified docket ID. Not a company or corporate-group ID. |
| `authority` | varchar | Stable issuing-body identity, including the specific court. Never a securities issuer company. |
| `authority_case_number` | varchar | Official docket/reference, preserving the source representation. |
| `jurisdiction_country` | varchar | Country of the legal proceeding, separate from party registration country. |
| `case_type` | varchar | `data_protection`, `competition`, `procurement`, `financial_regulation`, `civil`, `criminal`, `other`. |
| `lifecycle_status` | varchar | `unknown` (default), `open`, `closed`, `remanded`; closure is not a substantive finding. |
| `source_document_id`, `last_verified_at` | common | Docket support and verification. |

`legal_decision`: one act within a case. Primary key `decision_id`; multiple acts may
exist in one docket. Authority is obtained by joining `legal_case`; primary source
URL/hash are obtained by joining `source_document`. No denormalized copies are needed.

| Fields | Type | Meaning |
| --- | --- | --- |
| `decision_id`, `case_id` | varchar / FK | Decision identity and issuing docket. |
| `decision_kind` | varchar | `administrative`, `administrative_judgment`, `civil_judgment`, `criminal_judgment`, `procedural`. |
| `outcome_type` | varchar | `regulatory_finding`, `administrative_sanction`, `criminal_conviction`, `acquittal`, `dismissal`, `no_finding`, `other`. A criminal conviction/acquittal requires `criminal_judgment`. |
| `decision_date`, `publication_date` | nullable date | Legal act date and source publication date. Independently unknown if absent. |
| `legal_basis` | nullable varchar[] | Cited legal instrument/version and provisions, with source locators; null is unverified, an empty list does not establish legality. |
| `decision_status` | varchar | `unknown` (default), `issued`, `corrected`, `varied`, `overturned`, `withdrawn`. Historical versions remain auditable. |
| `appeal_status` | varchar | `unknown` (default), `not_appealed_verified`, `appealed`, `pending`, `decided`, `withdrawn`, `not_appealable`. No appeal found is not verified non-appeal. |
| `finality_status` | varchar | `unknown` (default), `not_final`, `final`. Final requires an appeal state compatible with finality and separate source evidence. |
| `stay_status` | varchar | `unknown` (default), `not_stayed`, `stayed`. Enforcement stay is distinct from finality. |
| `sanction_type` | varchar | `unknown` (default), `none`, `administrative_fine`, `corporate_fine`, `coercive_fine`, `damages`, `costs`. These financial remedies are not interchangeable metrics. |
| `sanction_amount` | nullable decimal(20,2) | Nonnegative amount exactly stated in the source; decimal arithmetic, no floating-point rounding. A decision with several remedies needs later remedy-item rows; do not combine types here. |
| `currency` | nullable varchar | Three-letter currency, e.g. SEK; required exactly when an amount is present. Validate against the applicable ISO codebook later, not only format. |
| `source_document_id`, `review_status`, `last_verified_at` | common | Primary act, review and verification. |

An upheld administrative sanction remains an administrative-sanction outcome in an
administrative judgment. A final judgment is a judicial decision with verified finality;
it may concern a finding, acquittal or another outcome. It is not a synonym for conviction.

## Events and parties

`case_event`: one evidenced occurrence. Primary key `event_id`. An optional linked
decision must belong to the same case via a composite foreign key.

| Fields | Type | Meaning |
| --- | --- | --- |
| `event_id`, `case_id`, `decision_id` | varchar / FK / nullable FK | Event identity, docket and relevant act. |
| `event_type` | varchar | `allegation`, `investigation`, `regulatory_finding`, `administrative_sanction`, `judgment`, `final_judgment`, `criminal_conviction`, `acquittal`, `appeal_filed`, `appeal_decided`, `remittal`, `closure_without_finding`, `correction`. |
| `event_date`, `recorded_at` | nullable date / required timestamptz | When it occurred and when it entered the system. |
| `source_document_id`, `review_status` | common | Occurrence evidence and review. |

Findings/sanctions/judgments/convictions/acquittals require a decision link. Future
cross-table validation must also verify matching event/outcome category and that a
`final_judgment` links a judicial decision with evidenced `finality_status=final`.
These cross-table semantics are not all implemented by the Phase 0 DDL.

`decision_company`: one company role per decision. Primary key `(decision_id,
company_id, party_role)`; same entity can have multiple documented roles.

| Fields | Type | Meaning |
| --- | --- | --- |
| `decision_id`, `company_id` | varchar, FKs | Act and directly documented legal identity. |
| `party_role` | varchar | `sanctioned_party`, `regulated_entity`, `claimant`, `respondent`, `issuer`, `contextual_mention`. |
| `attribution_scope` | varchar | `context_only` (default), `direct_legal_entity`, `documented_joint_liability`; group membership is never a default liability scope. |
| `identity_status` | varchar | `unverified` (default), `verified`, `ambiguous`. Sanctioned-party rows require verified identity and a liability scope. |
| `source_document_id`, `review_status` | common | Party-role evidence and review. |

Amounts belong to the decision, not each party. A joined party table must not
duplicate sums. Multi-remedy allocations, group displays and natural-person parties
are outside this minimal contract and require later design/review before publication.

## Assertion evidence and review

`source_evidence`: one source locator supporting one field of a record version.
Primary key `evidence_id`. Generic target references need later referential checks;
SQL only enforces the linked document FK.

| Fields | Type | Meaning |
| --- | --- | --- |
| `evidence_id`, `target_table`, `target_id` | varchar, required | Assertion ID and target record, including canonical serialized composite IDs where needed. |
| `record_hash`, `field_name` | varchar, required | Supported version and field. |
| `document_id`, `locator` | varchar, required | Exact document FK plus PDF page/paragraph, HTML section or structured JSON path. |
| `extraction_method`, `extractor_version` | varchar | `manual`, `structured`, `text`, `ocr`, plus parser/tool/model or human procedure version. |
| `observed_at` | timestamptz | When the assertion was extracted/checked. |

`record_review`: one review action on one record version. Primary key `review_id`.
The audit trail is append-only by workflow policy; SQL alone does not enforce that.

| Fields | Type | Meaning |
| --- | --- | --- |
| `review_id`, `target_table`, `target_id`, `record_hash` | varchar | Review action and exact reviewed version. |
| `review_kind` | varchar | `identity`, `legal`, `privacy`, `publication`. Privacy review includes reuse and the actual proposed projection. |
| `review_status` | review_state | Common states; approved/rejected/withdrawn actions require a nonblank reviewer and timestamp. |
| `reviewer_id`, `reviewed_at` | nullable varchar / timestamptz | Internal actor and decision time, withheld from public data. |
| `rationale` | varchar, required | Evidence checked, unresolved issues or reason for approval/rejection/withdrawal. |

Approvals bind to the current evidence set and record version. No rows in this table
automatically trigger export. Later publication validation must reject stale approvals
and require a publication reviewer independent of extraction/legal preparation.

## Coverage

`coverage_observation`: one company/source/window/search-run observation. Primary
key `coverage_id`; keep successive observations to explain changes in coverage.

| Fields | Type | Meaning |
| --- | --- | --- |
| `coverage_id`, `company_id`, `source_id` | varchar | Search observation, entity FK and source identifier. |
| `window_start`, `window_end` | date, required | Inclusive requested search window; end cannot precede start. |
| `searched_at` | nullable timestamptz | Actual execution time, absent before searching. |
| `search_status` | varchar | `not_started` (default), `complete`, `partial`, `failed`, `not_applicable`, `restricted`. Not applicable needs a documented reason. |
| `query_manifest` | nullable json | Identifiers, time-valid aliases, filters, paging, terminal proof, source versions and retrieval errors. Complete status requires it and a search time. |
| `candidate_count` | nullable integer | Nonnegative candidate hits; zero is valid only after an actual search. Not-started rows require null count/time. |
| `limitations` | varchar, required | Source-selection, inaccessible history, redaction, identity and parsing limitations for this observation. |

Metrics and denominators are defined in [architecture](architecture.md). Empty
observations produce not-measured/null values, never a fabricated 0% or 100%.

## Minimum requested field mapping

| Required field | Canonical home |
| --- | --- |
| `company_id`, `organization_number` | `dim_company`; the `decision_company` bridge preserves every documented company role. |
| `case_id`, `case_type`, `authority` | `legal_case`. |
| `decision_date`, `publication_date`, `legal_basis` | `legal_decision`; source versions independently retain their publication date. |
| `decision_status`, `appeal_status`, `finality_status` | `legal_decision`. |
| `sanction_amount`, `currency` | `legal_decision`, at one monetary-remedy grain in this contract. |
| `source_url`, `document_hash` | `source_document`, reachable through document FKs and field evidence. |
| `review_status` | Reviewed record plus version-bound `record_review`. |
| `last_verified_at` | Company, source document, relationship, alias, case and decision where freshness is material. |

Future logical relations `case_link`, `decision_link`, remedy items, identity-match candidates and
release manifests are described in the architecture/handoff, not silently implied to
exist in the executable schema. Add them when their phase needs an implementation.

## Phase 2 acquisition tables

The following tables are implemented by `ingestion.sql` in a separate private
database. They contain observations and extraction candidates. They do not create
rows in `legal_case`, `legal_decision`, `case_event` or `decision_company`.

| Table | Key and fields | Meaning |
| --- | --- | --- |
| `bronze.ingestion_run` | `run_id`; `started_at`, `finished_at` timestamptz; `configuration`, `report` JSON | Acquisition interval, bounds, seed URLs, collector code SHA, extractor version, manifest/policy hashes and optional verified cohort ID/membership hash. |
| `bronze.document_version` | `document_id` PK; unique `source_id`, `source_url`, `document_hash`; `authority`, `content_type`, `byte_count`, `first_fetched_at` | A source/URL/byte-version identity. `document_id` hashes the canonical source/URL/digest tuple; `document_hash` is the original fetched response body's SHA-256 after HTTP transfer decoding, never an extracted-text hash. |
| `bronze.document_version` retention fields | Nullable `storage_ref`, `copy_review` JSON; `reuse_status`, `privacy_status` | `reference_only_unverified` by default, with original URL as the reference. An approved scoped private-copy assessment can set `private_copy_reviewed` and a content-addressed blob. Privacy remains unreviewed and public release is not authorized. |
| `bronze.resource` | PK `source_id`, `source_url`; `document_id`, nullable `etag`, `last_modified`; `last_verified_at` timestamptz | Current observed version and HTTP cache hints for the URL. Older document versions stay available. Verification here means retrieval/cache verification, not legal verification. |
| `bronze.fetch` | `fetch_id` PK; `run_id`, `source_id`, `source_url`, `fetched_at`, `attempt`, nullable `status_code`; `response_metadata` JSON | One request attempt, including robots, redirects, retries and denials. Only selected response headers are retained; credentials/cookies are omitted. |
| `bronze.fetch` change fields | Nullable `document_id`, `previous_document_id`, `changed`, `error_code` | Successful content observations link current/previous identities. `changed` signals byte change, including reversion, without determining correction or supersession. HTTP errors and policy denials have no document identity. |
| `bronze.robots_observation` | PK `run_id`, `source_id`; `source_url`, `checked_at`, `document_hash`, `status_code`, `rules` JSON | Robots fetch, hash, matching allow/disallow rules and crawl delay. Failed requests also appear in the fetch log. |
| `silver.document_extraction` | PK `document_id`, `extraction_version`; `extracted_at`; nullable `publication_date`, `decision_date`, `case_reference`; `review_status`, `payload` JSON | One parser result per exact document version. Parser version incorporates its code, registry normalizer code and installed pypdf version. Conflicting singular fields remain null; review defaults to unreviewed. |
| `silver.discovery` | PK `run_id`, `source_id`, `source_url`, `kind`, `parent_document_id`; `label`, `status` | Discovery edges retain their parent evidence and anchor text. Seed parents use an empty string. Kind is listing/record/document; status records observation, duplicate discovery, failure or deferral by bound/manifest/source halt. Edge counts are not distinct document counts. |
| `silver.company_mention` | PK `run_id`, `document_id`, `mention_index`; nullable `company_id`; `candidate_ids`, `resolution` JSON; `review_status` | Number/name candidates resolved against the supplied canonical registry. A company ID can confirm registry identity only; scope remains contextual and unreviewed. No relationship traversal or sanctioned-party attribution. |
| `gold.ingestion_coverage` | View grouped by `run_id`, `source_id`; `fetch_attempts`, `failed_attempts`, `observed_versions` | Request-level operational counts. Retries count as attempts; robots fetches have no document version. These are not case or sanction counts. |

The Silver payload retains selected HTML/PDF `source_metadata`, plural
`case_references`, literal `named_legal_entities`, validated `organization_numbers`,
date `field_evidence`, discovery `links`, `revision_markers`,
`revision_link_candidates` and extraction `limitations`. Evidence carries a page or
main-content locator; extracted dates also retain their source fragment. A singular
case reference is null when multiple dockets are present. Correction markers and
links are candidates requiring review, not established legal relationships.

Private Gold JSON adds per-source attempted pages/records/documents, observed
URLs/hashes, independent dates, deferred-discovery counts, errors, terminal-list
state and limitations. A pinned manifest adds baseline hash comparisons. With a
verified cohort it adds each member's candidate document IDs and
`partial_publication_scan` status. Without a cohort, size and coverage fractions
are null and status is `not_measured_registry_missing`. The private Parquet file
contains per-run/source operational counts and the same unknown denominators.

## Phase 3 evidence and review model

Private `legal_review.sql` extends the ingestion database without populating the
Phase 0 legal-domain tables. Source observations become versioned candidates.
The exact proposal schema is available through `review_cli.py schema` and is
implemented in `legal_extraction.py`.

| Table/view | Grain and fields | Guarantees and limits |
| --- | --- | --- |
| `review.candidate` | `record_hash` PK; `record_id`, `document_id`, nullable `case_id`, `created_at`; `payload`, `identity_match`, `completeness` JSON; nullable `registry_hash` | Immutable serialized candidate version. Record hash binds proposal, source URL/hash, publisher, preparer, identity result, registry hash, completeness and pending-link diagnostics. Record ID hashes original document bytes plus decision slot. |
| `review.current_record` | `record_id` PK, `record_hash` | Current candidate version, without deleting earlier candidates or reviews. It does not imply an approved decision. |
| `review.decision_link` | PK source record hash / target record ID / relation; exact target record hash and evidence JSON | Directed proposed appeal/upholding/modification/annulment/supersession/remittal/related/duplicate relationship. Target docket excerpt, disposition, chronology and cycles are checked; legal review is still required. |
| `review.pending_link` | PK source record hash / target record ID; target record hash, reason, evidence | Possible follow-ups with ambiguous or unconfirmed targets. They hold affected decisions and require a scoped proposal before legal approval. |
| `review.action` | `action_id` PK; record/context hashes, review kind, disposition, reviewer ID, review time; nullable verification time/due date; rationale, full action JSON, audit sequence | Human approval/rejection/withdrawal. Latest action per review kind governs that exact version. Service principals and unauthorized roster roles are refused. |
| `review.audit_log` | Sequence PK; UTC event time/type/payload, previous hash and event hash | Append-only application audit for candidate creation, source-access policy/request observations and human actions. Chain and record/action consistency are checked. Full database administrators can rewrite the chain; protect storage and retain external backups if stronger assurance is required. |
| `review.evidence_access` | Access ID, document ID, check time, method, nullable matched-hash flag, result | Original availability, retained/local/reference-refetch method, verified original hash or explicit hold/failure. It does not grant reuse rights. |
| `review.case_groups` | Provisional issuer/docket ID and distinct decision count | Exact normalized docket grouping. Different acts on the same docket remain distinct; court/authority cases remain separate namespaces. |

Proposals carry `document_id`, `decision_slot`, `scope_pages`, producer kind/version/
model, strict typed `claims` and directed `links`. Each claim has `value` plus
`evidence` entries with physical page, normalized character start/end and literal
quote. `null`, `unknown` and empty arrays preserve uncertainty. Extra keys, approval
claims, invented excerpts and unsupported values are rejected.

The claim set includes authority, case number, legal entity, optional organization
number, case type, legal basis, independent dates, original outcome, monetary
sanction, appeal information, status, party role and attribution scope. Status
values are `investigation`, `alleged`, `decided`, `appealed`, `final`, `modified`,
`annulled`, `unknown`. The original outcome is distinct from status and finality.
Monetary values use decimal strings with explicit SEK/EUR and administrative-fine
type; unsupported remedies remain unclassified. The rules are under
[Extraction contract](#extraction-contract) below.

Review context binds source/record heads, registry snapshot hash, decision links
and incoming legal-review heads. New evidence or dependency reviews invalidate
matching approvals. Publication must follow current identity/legal/privacy reviews
and use an independent reviewer. Verification deadlines are project policy: 30 days
for non-final/uncertain records and 90 for explicitly final records.

Gold is produced through the gated exporter, staged privately as JSON and nonempty
Parquet. It includes canonical company/case/decision-version IDs, source authority
and docket, reviewed direct party, original outcome/amount/status, derived current
status and finality, subsequent-decision references, source URL/hash, review context
hash, verification/due dates and status-as-of time. Effective amount stays null
without a confirmed final unchanged order. Quotes, original documents, reviewer
IDs, model metadata and private paths are excluded. `validate-release` checks the
projection and current approvals again before future public promotion.

### Extraction contract

[`legal_extraction.py`](../../platform/compliance_intelligence/legal_extraction.py)
provides the strict JSON Schema and deterministic extractor.

| Claim | Extraction and uncertainty rule |
| --- | --- |
| `authority` | Issuing-body evidence in the first scoped page's header. The hosting authority is separately preserved as `source_publisher`; a court PDF hosted by IMY does not become an IMY judgment. Unsupported or conflicting issuers stay null. |
| `case_number` | Literal Swedish authority/court references. Multiple distinct references stay uncertain until a reviewer scopes the act. Docket grouping uses normalized issuer plus reference, never company or group name. |
| `legal_entity`, `organization_number` | Literal operative subject and valid legal-person number when present. Missing numbers stay null. Context mentions are not paired into a legal operator from proximity. |
| `case_type`, `legal_basis` | Document-supported category and literal law/regulation references. Current deterministic rules cover GDPR, competition and public procurement terminology; other supported categories require documented proposals or abstention. |
| `decision_date`, `publication_date` | Independently labelled dates with exact excerpts. Conflicts remain null; URL year, update date and retrieval date cannot fill them. |
| `original_outcome` | Supported outcome candidate, separate from current status. Administrative sanctions, regulatory findings, dismissal, no finding, procedural acts and judgments remain distinct. Criminal conviction requires separate explicit evidence and a criminal forum; a fine does not imply conviction. |
| `monetary_sanction` | Decimal amount string, explicit currency and sanction type. The current parser handles administrative fines. It does not classify damages, costs or corporate/coercive fines as administrative sanctions. |
| `appeal_information` | `unknown`, `instructions_only`, `filed`, `pending` or `decided`, with supporting excerpts. Instructions explain how to appeal; they do not establish that an appeal was filed. |
| `status` | Proposed status of the scoped act. Conflicting issue/history/finality statements abstain to unknown. Dispositions affecting another act belong in a directed decision link. |
| `party_role`, `attribution_scope` | Direct liability requires the named subject of the operative clause. An issuer or contextual mention cannot receive another entity's sanction. Parent, subsidiary and merger links are not traversed. |

Swedish grouping spaces, decimal commas, `miljon/miljoner`, `miljarder`, `tkr`,
`mkr` and `mnkr` are parsed using Decimal. Examples of supported units are
`1,8 miljoner kronor` and `35 000 euro`. Missing currencies/units, negative amounts,
ambiguous dotted/grouped decimals and conflicting currency abbreviations abstain
or fail proposal validation. Amounts remain at the decision grain.

Each known claim has `evidence`: physical PDF page number, `start`, `end` character
offsets and a literal `quote`. Offsets address normalized page text: whitespace is
collapsed and soft hyphens are removed. They are not byte offsets or printed court
page labels. Imports check every excerpt against a freshly hash-verified original.
The extractor version hashes its code and pypdf version. Unsupported text layouts,
encrypted PDFs, empty text and scans require review; no OCR is invented.

One proposal represents one scoped act and one directly attributable primary legal
entity. Several operative parties or ambiguous joint liability stay held. A document
containing several judgments needs separate `decision_slot` values and scoped page
sets, with field-specific offsets for each act. The whole-document extraction
abstains on conflicting dates or parties. It does not split an amount across parties.

## Phase 4 analytical model

Typed definitions are in
[`analytics.sql`](../../platform/compliance_intelligence/analytics.sql). These
tables are created in a separate private `analytics.duckdb`, not migrated into the
existing publicly backed-up warehouse. Counts refer to filtered approved evidence.
See the [public methodology](phase-4-methodology.md) for exact inclusion rules.

| Table | Grain / identifier | Fields and meaning |
| --- | --- | --- |
| `gold.fact_compliance_cases` | `(company_id, case_family_id)` | Origin authority/docket, earliest originating decision date, count of approved decision acts. `case_family_id` is the originating native case ID; distinct orders on one docket share this case row. |
| `gold.fact_compliance_decisions` | `decision_id` | Approved `record_hash`, direct `company_id`, native case ID, family and originating decision IDs; native/origin authorities; case category, original outcome, current legal status and finality; independent decision/publication dates, legal-basis list and origin date; origin/administrative/GDPR/competition flags; exact source URL and document hash. Flags count each sanction lineage once on its origin row. |
| `gold.fact_compliance_amounts` | `amount_id`, SHA-256 of origin/decision/kind | Decision, origin, entity and case IDs; decimal(20,2) amount, native currency, original or final_effective kind; originating date/authority/category, conversion method, source URL/hash. Nonnegative amounts, no currency conversion. Only final_effective contributes to totals. |
| `gold.mart_compliance_company_summary` | `entity_id` within one filtered bundle | Legal entity/group label and scope, cohort ID, member ID list/count, SNI and employee-class lists; employee interval bounds; observed approved decisions/case families; nullable sanction/GDPR/competition/appeal/modified/annulled counts; separate nullable criminal metric and explicit scope status; distinct reviewed documents; final totals by currency; exploratory count and currency-specific amount rate bounds; metric/coverage status and period/group dates. |
| `gold.mart_compliance_rankings` | Entity/scope/metric/currency in one bundle | Observed decimal-string value, nullable descending dense rank, assessed comparison count, explicit observation-only basis and null coverage fraction. Separate metrics only; currency is null for counts. |
| `gold.mart_compliance_source_coverage` | `(authority, period_start, period_end, period_role)` | Requested-window or subsequent-context role, approved decision and distinct document counts, known/assessed assertion fields, approved-row field completeness; nullable source-population denominator and population/search coverage fractions, explicit population-unknown status. |

Summary `entity_id` equals `company_id` for legal-entity scope or a reviewed dated
group root for group scope. `cohort_member_ids` always lists the actually aggregated
members. Group IDs do not replace defendant IDs in the facts. Employee bounds are
register class limits, not headcounts; rate bounds are decimal strings. Final
amount maps use currency keys and decimal strings, never a mixed-currency scalar.

`observed_approved_decisions` and `reviewed_source_documents` can be zero while
sanction metrics remain null (`not_assessed`). With selected approved evidence,
zero is an observed count within that evidence only. An empty final-amount map is
not a comprehensive zero-liability assertion. `criminal_convictions` is null under
the present contract, with a separate explanation in `criminal_metric_status`.

Bundle `methodology.json` binds cohort/member hashes, as-of dates, selection rules,
filters, status snapshot, approved-Gold manifest hash, transform/SQL code hash,
dataset row counts/hashes and warnings. `cohort-definition.json` repeats the cohort
context; `reconciliation.json` lists checked source/record hashes and URLs.
Parquet, SQL and JSON project the same rows. The sealed artifact manifest binds
physical files; canonical dataset hashes provide logical reproducibility.

## Phase 5 public projection

`explorer.py` produces one sealed private stage and, after final human review, one
same-origin public `release.json`. `state=unavailable` contains no company payload.
`state=approved` has publication status, actual review/deadline timestamps, a SHA-256
of the exact UTF-8 `payload_json` string and that string. The browser verifies the
bytes before parsing the projection. The fingerprint is not an identity signature.

| Projection field | Grain and scope |
| --- | --- |
| `context` | Approved analytical cohort, membership hash, selection/date/filter metadata, warnings and status snapshot. Original membership is 50; interactive filters select within it. |
| `presentation_sha256` | Hash binding the reviewed module's model, exports, component and stylesheet sources; the build gate checks the same order. |
| `companies` | Allowlisted canonical identity and register-source fields for cohort members and reached related entities; membership flag, employee interval bounds and explicitly null financial metadata. Private identity-review objects are excluded. |
| `relationships` | Reviewed directed entity IDs/type/validity and source URL/hash. Does not move legal liability. |
| `families` | One approved originating sanction/decision lineage, with company/native case/origin IDs, authority, category, originating date, operative status, separate metric contributions, amounts by kind/currency, approved decisions and reviewed status-document references. |
| `coverage` | The full approved release's Phase 4 authority/year/role cells, preceding interactive filters. Unknown source/search denominators stay null. |
| `evidence_valid_until` | Earliest selected decision's legal reverification deadline, conservatively normalized to UTC midnight. Final public approval cannot extend it. |
| `methodology_markdown` | The exact public method text examined with the staged payload. |

The decision CSV has one row per selected approved decision, with its own monetary
row array, native legal identity/status, source hash/URL and release/filter context.
The chart CSV instead has one row per plotted aggregate; its grain is different.
Methodology Markdown carries complete exact references and cohort/release hashes.
Graphic metadata embeds the same context; PNG carries the visible subset and needs
the companion Markdown for complete machine-readable references.

## Job/company tables

### Resolution contract

1. A validated legal-person organization number in the canonical registry verifies
   the advertised identity, provided its name is not contradictory.
2. A unique explicitly reviewed alias can verify an entity without a number.
   Brand, trading and historic names require source evidence and a dated validity
   interval covering the advertisement publication date.
3. Normalized current names and conservative similar-name candidates remain in
   the review queue. Confidence is evidence strength, not a calibrated probability.
4. Contradictory names, invalid numbers, multiple candidates and unsupported
   identities remain ambiguous, awaiting review or unresolved. An invalid supplied
   number never falls back to a name match.

An automatic link means **advertised employer**. It does not identify a recruiter
or an undisclosed end client. `recruiter` and `actual_employer` require explicit
human-reviewed role evidence. Workplace text and job descriptions do not establish
those roles. Parent ownership, merger edges and brand resemblance do not transfer
ads, finances or compliance decisions to another legal entity.

Manual review is bound to both `job_payload_hash` and `registry_hash`. A changed
ad or registry version requires a new review. The input JSON array requires:
`job_id`, `relationship_type`, `company_id` (nullable for rejection), both hashes,
`disposition` (`approved`/`rejected`), `reviewer_id`, UTC `reviewed_at`, HTTPS
`evidence_url`, SHA-256 `document_hash`, `source_locator` and `rationale`.
`--reviewers` names an explicit JSON array of authorized human reviewer IDs.
Conflicting role reviews are rejected. This CLI is a private operator tool, not a
public review endpoint; reviewer access must be controlled by its operator.

### Tables and analytical grain

The extension lives in [`job_links.sql`](../../platform/compliance_intelligence/job_links.sql).

| Table/view | Grain and purpose |
| --- | --- |
| Existing `dim_company` | One legal entity per canonical registry snapshot. |
| Existing `dim_company_alias` | Reviewed, sourced and dated alias of one entity. |
| Existing `company_relationship` | Dated, sourced relationship; no automatic aggregation. |
| `job_observation` | One native job ID and pinned payload hash per collection, with publication time. |
| `job_company_link` | One job ID × relationship type per resolved snapshot. |
| `company_resolution_review` | One immutable human review, bound to both input versions. |
| `company_registry_observation` | Current sourced SNI and employee class, by exact company ID. |
| `company_context_fact` | Reviewed, directly attributed measure/event observation, with period, unit and source. |
| `mart_company_hiring_daily` | Company × role × publication day; distinct observed advertisements. |
| `mart_company_hiring_context` | Daily hiring rows joined to register context and each reviewed financial observation. |

`job_company_link` contains `job_id`, nullable `company_id`, `relationship_type`,
`match_method`, `match_status`, `match_confidence`, nullable `verified_at`, original
employer name/number/workplace, both version hashes and JSON match evidence.
SQL constraints enforce non-null company/verification time only for verified
links. Private Parquet exports include links, reviews and the two hiring marts.

The financial join is one row per financial observation; **do not sum repeated
ad counts across financial measures or periods**. Units/currencies are retained,
never converted or summed implicitly. The same canonical ID enables size/activity
and financial/activity comparisons, but current size classes are intervals and
the observed weekly ad population is not hiring volume. Historical ads outside
this window, withdrawn ads and company workforce history are not reconstructed.
Neither financial nor legal outcomes establish a cause for recruitment changes.
