# KKV alternatives and public-document collection

Checked 2026-10-17. Public court publications provide a permitted document
supplement. They do not replace Konkurrensverket's diary or establish complete
competition-case coverage. KKV-dependent and combined-source rankings are disabled.
IMY ingestion and explicitly IMY-scoped comparisons remain available.

No email, document request, contact form, authentication workaround, proxy rotation
or challenge bypass was used. Existing source access restrictions remain enforced.
No unreviewed company finding was published and no deployment was performed.

## Discovery and access assessment

| Source | Evidence and observed access | Use in this task |
| --- | --- | --- |
| [KKV competition cases](https://www.konkurrensverket.se/konkurrens/tillsyn-arenden-och-beslut/arendelista) | Existing direct-client logs record HTTP 403. The official indexed description says the list is a selection. | Search-index discovery only. The blocked origin was not retried through a browser, alternate host or proxy. |
| [KKV public diary](https://www.konkurrensverket.se/diarium/sok-i-Konkurrensverkets-diarium/), [search help](https://www.konkurrensverket.se/diarium/sok-i-Konkurrensverkets-diarium/sokhjalp/) | Public index exposes diary entries and PDF links. The diary shares the blocked official origin. No supported bulk API was verified. | Candidate URLs only; no private search endpoint or form submission. Indexed text is not a verified original. |
| Indexed KKV decision PDFs, including public diary and document-library links | Search results expose original source references. Some hits instead concern procurement, merger review, competitors, group parents or suppliers. | Private, unreviewed discovery ledger. Neither another host under KKV nor an index/cache is used to retrieve a blocked original for ingestion. |
| [Published court decisions](https://www.domstol.se/domar-och-beslut/publicerade-domar-och-avgoranden/) | Ordinary `AuthorityHttp` access to `www.domstol.se` succeeded after robots checks. Four explicitly published PDFs were retrieved and hashed. | Independent primary document evidence, in the existing Bronze/Silver/review database. Issuer, publication host and named party remain separate. |
| [Domstolsverket open data](https://www.domstol.se/om-webbplatsen-och-digitala-kanaler/oppna-data/) | The official page links an OpenAPI YAML and describes higher-court reports from 1981, decisions from March 2025. Direct API-host `robots.txt` returned 404 in the live probe at `2026-10-17T14:59:06.708552+00:00`. | The existing conservative robots policy halted API access. No API payload, undocumented endpoint or private search service was collected. |
| Independently indexed legal archives and company publications | Useful leads can identify court/docket references and potential aliases, but do not establish the original bytes, legal party or current status. | Discovery only. They cannot create a company finding, verified historical alias or sanction amount. |

The existing HTTP client checks robots before targets and redirects, restricts
origins, serializes requests with a minimum delay, bounds response size, retries
transient failures with exponential backoff and halts on 401/403. A 404 robots
response is a hold under this project's policy. It is not described as an explicit
prohibition by the host. Publication selections and higher-court precedents omit
many investigations, lower-court cases, appeals and unpublished documents.

No blanket open licence for entire websites or attachment collections is asserted.
Public access, the statutory treatment of official decisions, private retention
and public reuse are separate questions. See [source feasibility](source-feasibility.md)
and [risks](risks.md). Full PDF bodies are processed in memory; the default persisted
evidence is a stable official reference, original-byte hash, metadata and exact
private excerpts. Local import does not confer private-copy or public approval.

## Cohort search and coverage

The original `se-it-50-2026-10-17` cohort is unchanged. Membership SHA-256:
`f0866d8ad65709168017e8cdaf0e2e19b772c6bfaeeb908eb187233f96d8b3d5`.
It is read from `.research/compliance-intelligence/cohort-se-it-50-2026-10-17-v2`.

The final plan has 100 public index searches: each of the 50 registered legal names
and each validated, hyphenated organization number followed by `Konkurrensverket`.
The implementation also includes approved aliases from the existing registry.
There are no verified historic aliases in this frozen input. Potential earlier
names seen in documents remain candidates; no group name or renamed entity was
invented or silently added to the cohort.

Query receipts retain engine, execution time, exact queries, response file, indexed
URLs and response hash. The coverage CLI checks queries against the frozen plan.
Earlier experimental queries are retained privately and excluded from the final
100-query count. Search indices change over time; stored responses reproduce the
observed discovery batch, not all future search-engine results.

| Measure | Result | Meaning |
| --- | ---: | --- |
| Companies searched | 50 | Search activity against the fixed cohort, not complete legal coverage. |
| Planned queries executed | 100 / 100 | Registered names and organization numbers; no verified historical alias supplement. |
| Identified candidate KKV case references | 3 | Distinct explicitly labelled docket references in official index results with a cohort name/number mention. These are contextual leads. |
| Verified entity matches for legal attribution | 0 | Source snippets and current-register numbers do not establish historical party identity, role and scope. |
| Accessible independent court PDFs | 4 | Distinct PDF byte hashes, fetched normally from the court host. This is a separate discovery set from the three KKV references. |
| Court extraction candidates | 4 | Private candidates, with uncertain fields held null/unknown. |
| Approved alternative-source findings | 0 | No human review or public approval was manufactured. |
| KKV source-population coverage | Unknown | No denominator for all relevant cases/documents exists. |

A PDF may contain several judgments or appended earlier acts. Four accessible
documents therefore do not establish four distinct operative decisions. That
count remains unassessed until the evidence is scoped and reviewed.

The private discovery ledger separates an acquisition target, another group's
parent and a competitor mention from a directly liable legal entity. A court
document naming a supplier is not a KKV sanction against that supplier. Case
references, legal names, current aliases and organization numbers remain distinct
observations until the existing dated resolver and human review confirm them.

The four court candidates have also been added to the existing IMY/KKV private
review database. The earlier IMY documents and reviews are retained. A separate
initial document-supplement root remains as the live collection/idempotency pilot.
No new company database or company-ID namespace was created.

The private research directory is
`.research/compliance-intelligence/kkv-alternative-2026-10-17/`.
`integrated-coverage.json` contains the detailed receipts and contextual candidates.
The [public aggregate report](kkv-alternative-coverage.json) excludes names,
case candidates, excerpts and reviewer details.

The regenerated [private human review packet](../../.research/compliance-intelligence/kkv-alternative-review-final-2026-10-17/REVIEW.md)
contains 57 current candidates: the unchanged 53 IMY candidates and four court
supplements. Its independent final review remains pending; approved decision
count is zero. Stage-manifest SHA-256:
`0e6a5a0747d2967cec4194b5d5dc3e4ae441413c631035d9200a0224abe8f950`.
The existing IMY source still has 118 current resource references; no IMY records
or human reviews were removed. The verified audit snapshot has 129 entries.

## CLI and manifest contract

Run from the repository root. Existing Python dependencies are sufficient.

Generate a plan without making network calls:

```sh
python -X utf8 platform/compliance_intelligence/public_documents.py plan --cohort .research/compliance-intelligence/cohort-se-it-50-2026-10-17-v2 --output .research/compliance-intelligence/NEXT_PLAN.json
```

The actual pinned public court batch can be rechecked with:

```sh
python -X utf8 platform/compliance_intelligence/public_documents.py fetch --root .research/compliance-intelligence/completion-decisions-2026-10-17 --cohort .research/compliance-intelligence/cohort-se-it-50-2026-10-17-v2 --manifest .research/compliance-intelligence/kkv-alternative-2026-10-17/court-batch-pinned.json --max-documents 4
```

Automatic collection accepts only explicitly listed HTTPS PDF publications on the
independent `www.domstol.se` host. It does not crawl links or fetch any KKV host.
Manifest fields are `schema_version: 1` and `documents`, whose entries contain
`source_id: court_publications`, `source_url` and `expected_sha256` (a 64-character
hash, or null for a deliberate first observation). Unknown keys are rejected.
The whole manifest is validated before network activity. A changed pinned hash
is held for review. Verified live bytes become the current source reference,
invalidating the old review context, without generating new legal claims. A local
file with a mismatched declared hash is rejected without replacing source state.
Use a deliberately revised manifest before extracting the changed live version.

### Manual local import

Use an original PDF obtained through an ordinary permitted public download.
Do not use this command to launder a blocked, authenticated, encrypted or
restricted document. No file from an access-control bypass qualifies.

```sh
python -X utf8 platform/compliance_intelligence/public_documents.py import-local --root .research/compliance-intelligence/completion-decisions-2026-10-17 --cohort .research/compliance-intelligence/cohort-se-it-50-2026-10-17-v2 --manifest .research/compliance-intelligence/YOUR_LOCAL_BATCH/manifest.json --max-documents 10
```

The local manifest uses the same top-level shape and adds these entry fields:

| Field | Required meaning |
| --- | --- |
| `source_id` | `kkv` for a KKV publication host, or `court_publications` for the independent court host. |
| `source_url` | Exact official public reference. Local KKV imports allow the explicitly documented `www`, `information` and `prod` publication hosts; no network request is made to them. |
| `expected_sha256` | Actual original-file SHA-256, required for local import. |
| `local_file` | Relative path within the manifest directory; path escape is rejected. |
| `acquired_at` | Actual UTC download time, not in the future. |
| `acquired_by` | Actual operator ID, kept private. |
| `public_download_without_bypass` | Explicit true only after checking the actual acquisition method. This is provenance, not legal/publication review. |

A PDF is required, bounded to 25 MiB and 250 extracted pages. Encrypted, corrupt,
textless or unsupported documents remain held; no passwords or OCR bypass are
attempted. The pipeline stores an original reference/hash, fetch/import audit,
extraction version, uncertain observation fields, contextual matches and a
schema-validated review candidate. Case number, legal entity, decision/publication
dates, case type, status and any supported sanction amount use the existing
Phase 3 evidence schema. An unknown amount stays null, never zero. Publisher is
stored separately from the extracted deciding authority. Human-scoped corrections
use the existing `review_cli.py import-proposal` command and exact page excerpts.

Repeated URL/hash imports do not duplicate documents or candidate records.
Different URLs keep provenance while identical decision bytes share decision
identity. Changed source versions invalidate prior review context. Logs and
per-run `gold/runs/RUN_ID/supplement-coverage.json` distinguish candidates, hash
changes, extraction holds and deferred documents after a source access failure.
Exit codes: 0 for a completed candidate batch/report, 1 for held/deferred documents,
2 for invalid input or an unrecoverable command error. Reports refuse overwrite.

Rebuild detailed coverage from the recorded public search receipts:

```sh
python -X utf8 platform/compliance_intelligence/public_documents.py coverage --root .research/compliance-intelligence/completion-decisions-2026-10-17 --cohort .research/compliance-intelligence/cohort-se-it-50-2026-10-17-v2 --research .research/compliance-intelligence/kkv-alternative-2026-10-17/research --output .research/compliance-intelligence/NEXT_KKV_COVERAGE.json
```

The CLI emits a plan and validates receipts; it does not scrape a search engine or
invent execution receipts. The current bounded searches were performed using the
research tool, with the actual responses retained privately. Only confirmed party
matches count as verified legal attribution. Discovery counts include contextual
mentions and are never Gold facts.

## Ranking and publication safeguards

`mart_compliance_rankings` is empty unless the analysis explicitly selects
`Integritetsskyddsmyndigheten` and no category outside data protection. The browser
enforces the same scope before enabling metric ordering or ordinal ranks.
KKV-selected, competition-category and combined-source views list companies by
legal name and explain the hold. The analytical context records
`ranking_status`; authority/year coverage identifies unavailable or partial KKV
coverage. An IMY observation alone leaves the company competition metric null.

The dashboard still shows available approved IMY evidence and native-currency
metrics. No overall trust, criminality or ethics score was added. This availability
policy is deliberately conservative and does not unlock merely because a few PDFs
were imported. Re-enabling KKV comparisons requires a separately reviewed coverage
assessment and the existing publication process.

All new records enter the existing review queue. Original allegations, outcomes,
appeal/reversal links, finality and monetary units still require source evidence.
Only current, correctly attributed, human-approved Gold may become public.
Presentation/analytics changes invalidate earlier pending stages, which must be
regenerated and independently reviewed. No promotion, R2 upload or deployment is
part of this task.

## Changed files

- `platform/compliance_intelligence/authority_sources.py`: independent publication-host specifications, separate from IMY/KKV list adapters.
- `platform/compliance_intelligence/authority_http.py`: reuse the same robots/rate/retry/origin policy for independent court hosts.
- `platform/compliance_intelligence/decision_ingest.py`: publication-host metadata and explicit supplemental extraction versions using existing storage.
- `platform/compliance_intelligence/public_documents.py`: manifest fetch/local import, review candidates, frozen-cohort query plan and audited coverage CLI.
- `platform/compliance_intelligence/legal_extraction.py`: separately evidenced HFD and historic Regeringsrätten issuers; neither is replaced by KKV as publication host.
- `platform/compliance_intelligence/analytics.py`: KKV ranking hold, explicit ranking status, null missing competition metrics and authority coverage state.
- `platform/compliance_intelligence/explorer.py`: distinguish a case's own non-competition count from unavailable company-level competition coverage.
- `frontend/src/compliance/model.ts`, `ComplianceExplorer.tsx`: matching ranking scope, disabled controls, legal-name ordering and visible coverage status.
- `platform/tests/compliance_intelligence/test_public_documents.py`, `test_phase4.py`: provenance/hash/path/access/identity/idempotency and ranking regressions.
- `frontend/tests/unit/compliance.test.ts`, `frontend/tests/compliance.spec.ts`: IMY-only comparisons and blocked combined ranking assertions.
- `docs/compliance-intelligence/README.md`, `source-feasibility.md`, `phase-4-methodology.md`, `kkv-alternative.md`, `kkv-alternative-coverage.json`: access evidence, methodology, commands and results.

Private manifests, receipts, logs and review bundles are ignored artifacts, not
production assets. The original cohort, homepage, intro animations, IMY adapter,
credentials, dependencies and deployment configuration were not changed.

## Validation

| Check | Final result |
| --- | --- |
| Full platform Python suite | 641 passed, 2 skipped; `python -m pytest platform/tests -q --basetemp tmp/kkv-alternative-final-platform`. |
| Frontend unit suite | 117 passed. |
| Full desktop/mobile browser suite | 160 passed, 2 skipped; `npm.cmd run test:e2e -- --workers 2 --output tmp/kkv-alternative-e2e-limited`. |
| Production CSP/security browser checks | 3 passed. |
| Production build, TypeScript and formatting | Passed. |
| Live permitted public collection | Four independent court PDFs; original byte hashes recorded. |
| Live idempotent repeat | No new byte version or duplicate candidate on unchanged source bytes. |
| Review/source safeguards | Local provenance, hash/path validation, immediate 403 halt, historical issuer separation and changed-live-hash invalidation tested. No real review approval generated. |
| Frozen cohort and staged payload | Original 50-member checksum, sealed private artifacts and current presentation fingerprint verified; public legal release remains unavailable. |
| Prose and document links | Scanner reports zero findings; updated local document links verified. |
| Required Idea Lineage capture | Attempted; the existing journal raises `KeyError: 'created_at'` in `platform/idea_lineage/store.py:80`. The unrelated journal was not changed. |

Logs are ignored `tmp/kkv-alternative-*.log` files. Earlier broad runs encountered
disk exhaustion, a Windows file-rename error and resource-related timeouts.
Older temporary test files were compressed without removing source or cohort
evidence. Isolated checks passed, followed by the final complete Python run and
the browser run with two workers. No unrelated production behavior or test timeout
was changed to obtain these results.
