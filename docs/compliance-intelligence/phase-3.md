# Phase 3: evidence extraction and review

Implemented 2026-10-17. The Phase 2 private ingestion database now supports
evidence-bound extraction candidates, docket grouping, decision links, human review,
reverification and approved Gold export. There is no public deployment or automatic
approval. Current results are in [the validation report](phase-3-validation.md) and
the aggregated [coverage and review summary](phase-3-summary.json).

## Read and extract existing evidence

The collector reuses the canonical registry resolver, original SHA-256 identities,
private-path restrictions and Bronze/Silver source records. The current pilot has
five source references, including two decision PDFs. It retained no original-body
copies. A reference alone cannot support new full-document extraction offline.

The default extraction command reads only permitted retained originals. Missing
originals become held observations; it does not invent text from URLs or previous
metadata. To re-read the existing reference-only PDFs, explicitly enable reference
refresh. Every response must match the exact Phase 2 document hash. Changed bytes
are held for Phase 2 reingestion and a new document identity.

```sh
python -X utf8 platform/compliance_intelligence/review_cli.py --root .research/compliance-intelligence/phase-2-pilot extract --refresh-references --max-documents 2
python -X utf8 platform/compliance_intelligence/review_cli.py --root .research/compliance-intelligence/phase-2-pilot summary
python -X utf8 platform/compliance_intelligence/review_cli.py --root .research/compliance-intelligence/phase-2-pilot queue
```

The CLI honors `COMPLIANCE_PRIVATE_ROOT` from the existing `.env.example` when
`--root` is omitted. Add `--registry PATH_TO_VERIFIED_PHASE_1_SNAPSHOT_OR_BUNDLE`
to `extract` or `import-proposal` once actual registry evidence is available.
The snapshot's hashes are verified and its identity status is preserved.

Reference refresh reuses Phase 2's same-origin HTTPS client, robots checks,
serial pacing, bounded retries and access denials. It reads only existing document
references, retains no new original copies, and records fetch/policy observations
in the review audit. A hash mismatch needs a new Bronze version, not an exception
to evidence validation. No court requests, alternate-host bypass or external OCR
service is used.

## Extraction contract

[`legal_extraction.py`](../../platform/compliance_intelligence/legal_extraction.py)
provides the strict JSON Schema and deterministic extractor. Existing installed
`pypdf`, `jsonschema`, DuckDB and PyArrow are reused; no dependency was added.

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

## Optional structured LLM assistance

Deterministic extraction is the default. There are no provider calls, API keys,
model-generated summaries or automatic document uploads in this implementation.
An operator can supply a manual or LLM-assisted proposal through the same strict
validation boundary:

```sh
python -X utf8 platform/compliance_intelligence/review_cli.py schema
python -X utf8 platform/compliance_intelligence/review_cli.py --root PRIVATE_ROOT import-proposal --proposal PRIVATE_PROPOSAL.json --original-file MATCHING_ORIGINAL.pdf --registry VERIFIED_REGISTRY --prepared-by PREPARER_ID
```

Use `--refresh-references` instead of `--original-file` for a reference-only source.
The imported file must identify an existing Bronze document. The CLI verifies its
original hash before checking excerpts. `document_pages()` exposes the normalized
page representation to a trusted local model integration; the importer never accepts
LLM-supplied text as the evidence corpus. Any external model processing needs a
separate assessment of data egress, privacy and source terms. No such clearance is
asserted here.

The `schema` command outputs JSON Schema and instructions for treating document
text as untrusted data. Proposals must declare producer kind, version and model
when LLM-assisted. Unknowns are `null`, `unknown` or empty arrays. Additional keys,
including approval fields, are rejected. Fabricated excerpts, page numbers, amounts,
unsupported status claims and allegation-to-finding substitutions fail validation.
Literal evidence is necessary but cannot prove semantic truth: quoted older orders,
multi-column extraction and hostile text can still mislead. Human review remains
mandatory for every public record, including every negative finding about a company.

## Cases, links and status

Case groups use an issuer namespace and normalized docket. An authority decision
and its court appeal remain separate cases. A decision identity uses original-byte
hash plus decision slot; identical copies do not become new decisions. Separate
acts on one docket remain separate decisions. Different byte representations with
the same docket/date/party/outcome are held as possible duplicates, not summed.

Directed links point from a later act to the earlier act's exact record version:
`appeal_of`, `upholds`, `modifies`, `annuls`, `supersedes`, `remands`, `related_to`
and `duplicate_of`. Link evidence must name the target docket and support the
disposition. Chronology, target identity and cycles are checked. Exact unambiguous
references can produce deterministic link candidates. Several possible judgments
on the referenced docket create pending links and hold all affected decisions.
An explicit scoped proposal resolves those targets before legal approval.

Only a current, legally reviewed follow-up can affect the earlier act's derived
status. Unreviewed/stale links, competing lifecycle effects or an additional
appellate stage produce unknown status and hold publication. The current conservative
graph reducer requires a reviewer to resolve complex appellate chains explicitly;
it does not infer that the last timestamp restores or cancels a sanction.

| Status | Meaning in this module |
| --- | --- |
| `investigation` | Supported investigation stage; no finding implied. |
| `alleged` | Supported allegation/claim stage; no finding implied. |
| `decided` | A documented act has been issued; outcome and finality remain separate. |
| `appealed` | An actual appeal is supported, distinct from appeal instructions. |
| `final` | Explicit finality evidence has been reviewed; age alone is insufficient. |
| `modified` | A reviewed subsequent act changes, supersedes or remands the targeted act. |
| `annulled` | A reviewed subsequent act annuls the targeted act. |
| `unknown` | Insufficient, conflicting, stale or unresolved evidence. |

Original outcome, original amount and original stage are retained. Current status
and finality are separate: an annulment or modification may have unknown or confirmed
finality. An upheld order does not automatically become final. Gold includes
subsequent decision source references supporting its current-status projection.
Effective monetary sanction remains null for non-final, modified, annulled or
uncertain states. It is not populated by overwriting the original amount.

[Sveriges Domstolar's appeal guidance](https://www.domstol.se/hogsta-domstolen/amnen/missnojd-med-dom-eller-handlaggning/overklaga-en-dom/overklaga-till-kammarratten/att-overklaga-till-kammarratten/)
describes appeals and finality. Courts can supply
[finality certificates](https://www.domstol.se/stockholms-tingsratt/om-tingsratten/ta-del-av-allman-handling-och-arkivinformation/bestallningsformular-for-intyg-om-laga-kraft-ej-skilsmassa/).
This implementation does not determine finality by calculating statutory deadlines
or treat absence of an appeal in the collected selection as proof.

## Human review

The private `queue` command shows record/context hashes, identity ambiguity,
completeness, approval states and publication blockers. Inspect the concrete
evidence and proposed public projection before reviewing:

```sh
python -X utf8 platform/compliance_intelligence/review_cli.py --root PRIVATE_ROOT show --record-hash RECORD_HASH
python -X utf8 platform/compliance_intelligence/review_cli.py --root PRIVATE_ROOT review --request PRIVATE_REVIEW_REQUEST.json --reviewers PRIVATE_REVIEWER_ROSTER.json
```

`show` labels its projection `preview_not_approved`. Queue/show output contains
private evidence and reviewer details; do not publish it or copy it to public logs.

The operator-maintained roster maps real reviewer IDs to `kind: human` and a list
of permitted roles: `identity`, `legal`, `privacy`, `publication`. Service principals
are refused. A request must contain exact `record_hash`, current `context_hash`,
`review_kind`, `disposition` (`approved`, `rejected`, `withdrawn`), `reviewer_id`,
`rationale`, `human_attestation: true` and `examined_evidence: true`.

Additional requirements for approval:

- Identity: exact verified register number/name or a unique, time-valid exact
  registered legal name checked by the human reviewer. Brand-only, conflicting,
  foreign-parent and ambiguous matches remain held.
- Legal: complete supported legal fields and resolved lifecycle targets;
  explicit `verified_at` UTC and `reverify_by` date. Court follow-ups can receive
  legal review without company attribution, but cannot become company Gold rows
  without separately verified direct identity/scope.
- Privacy: both `privacy_cleared: true` and `reuse_cleared: true` for the actual
  projection, source excerpts and dependency evidence.
- Publication: all prerequisite approvals must be current. The reviewer must
  differ from the preparer and identity/legal/privacy approving reviewers.

No actual reviewer or approval is supplied in this task. The assistant did not
approve the real candidates. The roster/request files are trusted local operator
inputs protected by filesystem permissions, not an authentication service. Before
remote or multi-user deployment, authenticate principals and protect the roster
and database server-side. A client-supplied reviewer name is insufficient there.

Every action is append-only through the application and records its exact evidence
context. Changes to source versions, record versions, registry versions, lifecycle
dependencies or incoming legal reviews invalidate applicable approvals. New
prerequisite reviews require a later publication approval; a rejection followed
by reapproval cannot revive an older publication approval automatically.

Reverification policy: at most 30 days for open, appealed, uncertain or non-final
records and 90 days for explicitly final records. These are project freshness
limits, not legal deadlines. Future verification times and excessive intervals are
rejected. Expired legal review blocks export until a new human legal review and
publication approval.

## Audit, Gold and release validation

[`legal_review.sql`](../../platform/compliance_intelligence/legal_review.sql) adds
private `review` tables to `ingestion.duckdb`. Candidate record versions and review
actions are retained. The audit chain binds sequence, UTC time, event payload and
previous hash. Verification checks candidate hashes and review-action payloads
against their audit entries. It is tamper-evident under trusted storage, not an
externally anchored signature system; an administrator able to rewrite the whole
database and chain is outside that guarantee.

```sh
python -X utf8 platform/compliance_intelligence/review_cli.py --root PRIVATE_ROOT verify-audit
python -X utf8 platform/compliance_intelligence/review_cli.py --root PRIVATE_ROOT export-gold --output PRIVATE_NEW_RELEASE_DIRECTORY
python -X utf8 platform/compliance_intelligence/review_cli.py --root PRIVATE_ROOT validate-release --bundle PRIVATE_NEW_RELEASE_DIRECTORY
```

Gold export checks every gate again and emits only an allowlisted public projection.
It omits raw excerpts, original PDFs, reviewer identities, rationale, model metadata
and private paths. JSON, optional nonempty Parquet, release metadata and integrity
manifest are staged in a new private directory. Zero eligible records produces an
empty JSON dataset and manifest, not fabricated rows.

`validate-release` rechecks approval freshness, current source/graph context, exact
projection values, unique decisions and JSON/Parquet agreement. Even a rehashed
bundle cannot substitute a new amount under an approved record hash. Run it against
the live private review database immediately before any future public promotion.
An older bundle is an as-of snapshot, not a permanent permission to serve stale
records. Revocation/expiry requires removal from any future current release.

This phase adds no public dbt subject, warehouse migration, R2 group or scheduled
publisher. Phase 0 legal-domain contracts remain separate from candidate observations;
no parser inserts unreviewed decisions or sanctioned-party links there. Public
delivery integration must preserve these gates and the private storage boundary.

## Remaining work

The real frozen SCB cohort was supplied and 55 unique PDF byte versions were
checked on 2026-10-17. There are 53 private candidates and two textless documents
held for OCR; none has human approval. Inspect and correct the scoped proposals in
the [current review packet](completion.md). Current register identity cannot prove
a historical legal name without dated evidence. Establish ordinary
KKV access before expanding its document coverage. Real authorized human reviewers
must resolve legal-status ambiguity, party scope and current appeal evidence before
any approval. Broader court templates, unsupported remedies, OCR and complex
multi-party/appellate chains remain held until supported and reviewed.

No rankings, dashboard, homepage or intro-animation changes are included.
