# Phase 2 operation and source assessment

Implemented and checked on 2026-10-17, Europe/Stockholm. The module collects public
source observations into private storage. It does not determine violations, case
outcomes, party liability, appeals, finality or rankings. The canonical Phase 0
legal tables remain unpopulated by this collector.

## Official sources and access

| Source | Interface checked | Access observed | Scope and restrictions |
| --- | --- | --- | --- |
| IMY | [Published sanction index](https://www.imy.se/om-oss/beslut-publikationer-och-remisser/beslut-om-sanktionsavgift/), linked case pages and PDFs | HTTP 200 through the collection client. No documented supported bulk decision API or downloadable decision dataset located in the official pages checked. | Index has year sections 2019–2026. Entries are discovery candidates; GDPR applicability, appeal documents and legal category require review. It is not an exhaustive register. |
| IMY | [Supervision and decisions](https://www.imy.se/tillsyner/) | Official public HTML selection, separate from the implemented sanction index | Describes a selection from 2018 onwards. This broader list is not silently substituted for sanction-index coverage. |
| Konkurrensverket | [Published competition cases](https://www.konkurrensverket.se/konkurrens/tillsyn-arenden-och-beslut/arendelista) | Direct client received HTTP 403. The source was halted. Official browser-indexed content was usable for researching the list and adapter shape. | Selected cases include open investigations, closures, authority acts and court attachments. Live pagination and PDF collection remain unverified because of the access response. |
| Konkurrensverket | [Public diary](https://www.konkurrensverket.se/diarium/sok-i-Konkurrensverkets-diarium/) and [search help](https://www.konkurrensverket.se/diarium/sok-i-Konkurrensverkets-diarium/sokhjalp/) | Researched as an alternative official route; no diary adapter or supported bulk API established | Registered cases since 1998 have broader scope than the published selection. Document availability and publication delays remain separate coverage limits. |

No search-engine cache is used as ingestion evidence. Internal browser search
endpoints and alternative hosts are not treated as supported APIs or used to work
around the 403. The KKV adapter is implemented and tested against synthetic HTML;
production response validation is still required after ordinary access is available.

The [IMY robots file](https://www.imy.se/robots.txt) returned HTTP 200 and disallowed
paths matching `/*?query=` and `/*&query=`. The
[Konkurrensverket robots file](https://www.konkurrensverket.se/robots.txt) returned
HTTP 200 with a sitemap and no disallow directives. These observations permit no
inference about document reuse rights or continued future access. Every run checks
robots again. Missing, redirected, non-plain-text or denied robots responses stop
collection. Source and redirect URLs must remain on the configured HTTPS origin.

## Reuse and privacy

[IMY's reuse policy](https://www.imy.se/om-oss/vart-uppdrag/vidareutnyttjande-av-data/)
says that release and reuse require consideration of each document, including
personal data and secrecy, and identifies decisions as documents normally available
electronically for reuse. It does not grant a blanket open license for the website.

[Konkurrensverket's material policy](https://www.konkurrensverket.se/om-oss/om-webbplatsen/anvanda-och-lanka-till-vart-material/)
permits reproduction subject to conditions. It identifies protected material,
restricts reproduction for sale without permission, requires source/retrieval-date
attribution and recommends links for electronic redistribution. No blanket CC0 or
CC BY license is asserted. Check actual attachment authorship and conditions.

Default retention is a stable official reference, retrieval metadata, exact-byte
SHA-256 and limited extracted candidates. Bodies are processed in memory and are
not persisted. Extracted names, references and evidence fragments stay private.
Nothing is sent to a language model or an external OCR service. A scanned PDF
receives `no_extractable_text_ocr_not_run`; encrypted PDFs are rejected.

Optional original-byte retention requires a documented private-copy review JSON
via `--copy-policy`. Each source entry must contain `reviewer_id`, `reviewed_at`
(UTC), its exact `terms_url`, a `rationale` and HTTPS `allowed_prefixes` ending in
`/`. Scope the prefixes to the actual cleared documents. This records the operator's
assessment; it grants no new right and does not approve publication. For example,
the structure is `{"imy": {"reviewer_id": "...", "reviewed_at": "...",
"terms_url": "...", "rationale": "...", "allowed_prefixes": ["..."]}}`.
Fill it with actual reviewed facts; no approval is supplied by this task.

Public source availability does not resolve processing grounds, retention periods,
redaction or publication risk. Raw evidence may contain complainants, employees,
contact details or other personal data. Set the private directory's access and
retention controls before retaining copies. Public R2 and its whole-warehouse
backup must never receive this database or its evidence directory.

## Run the pilot

Use the existing Python requirements; no dependency was added. The entry point is
[`decision_ingest.py`](../../platform/compliance_intelligence/decision_ingest.py).
It reads `.env` through the existing helper and honors `COMPLIANCE_PRIVATE_ROOT`
from [`.env.example`](../../.env.example). Authority collection uses no API key.
SCB credentials remain confined to the Phase 1 register client.

```sh
python -X utf8 platform/compliance_intelligence/decision_ingest.py --source all --root .research/compliance-intelligence/decisions --max-pages 1 --max-records 2 --max-documents 2
```

Bounds apply separately to each source. Requests are serial with at least two
seconds between starts, increased by robots crawl delay. Four attempts use
exponential backoff for network errors, 429 and transient server errors. HTTP
`Retry-After` is honored. A delay exceeding 60 seconds defers the source to a later
run instead of making an early request. HTTP 401/403 halt that source immediately.
There is no proxy rotation, CAPTCHA bypass or automatic alternative-host fallback.
Responses are limited to 25 MiB; timeouts and extraction errors are reported.

The CLI exits 0 for a successful bounded batch, 1 for recorded source failures,
and 2 for configuration or fatal execution errors. A successful small batch does
not mean complete source coverage. INFO logs contain source, document ID and change
state; source bodies, cookies and credentials are omitted from logs.

The original pilot's five fixed resource URLs and baseline hashes are in
[`phase-2-pilot-manifest.json`](phase-2-pilot-manifest.json). To keep that exact URL
sample when the public index changes:

```sh
python -X utf8 platform/compliance_intelligence/decision_ingest.py --source imy --root .research/compliance-intelligence/decisions --batch-manifest docs/compliance-intelligence/phase-2-pilot-manifest.json --max-pages 1 --max-records 2 --max-documents 2
```

Manifest mode follows only listed resources. Newly discovered URLs are recorded
as `deferred_manifest_scope`. Each observation compares its hash to the baseline.
Live responses can change. The HTML contains per-response nonces, and its hashes
changed between pilot runs; no legal correction was inferred.
Reference-only mode reproduces URL membership and comparison, not offline original
bytes. Reproducing extraction offline requires an authorized retained original and
the recorded extractor/dependency version. Never replace a baseline with new bytes
without preserving the earlier manifest.

## Storage and update behavior

[`ingestion.sql`](../../platform/compliance_intelligence/ingestion.sql) runs in a
separate `ingestion.duckdb` under the private root. It uses the existing
Bronze/Silver/Gold layer names without registering a public dbt subject or job.
`private_path`, `relative_file`, canonical JSON and byte hashes reuse Phase 1 and
`lib.rawstore`. The normal rawstore writer targets the public warehouse, so this
collector supplies a private writer and does not change that writer's global root.

| Layer | Contents and grain |
| --- | --- |
| Bronze | One run configuration and report; one fetch row per HTTP attempt; robots observations; immutable content identities per source/URL/hash; current URL pointers and optional private content-addressed blobs. |
| Silver | One extraction per document/version; per-run discovery edges, including parent document, anchor label and deferred/failure state; contextual company mentions with registry candidates. |
| Gold | Per-run ingestion counts and coverage reports in private JSON/Parquet. There are no outcome aggregates or public releases. |

The acquisition configuration pins the collector code hash, extractor version,
source seeds, bounds, optional copy-policy hash and frozen-cohort membership hash.
Every successfully observed document has URL, authority, exact-byte digest, MIME
type, size, retrieval time and permitted copy reference or stable original URL.
Selected HTTP validators and source HTML/PDF metadata are preserved. Publication
and decision dates are extracted independently with field evidence. Missing or
conflicting values remain null. A source update date stays in source metadata.
IMY's first-page decision template can supply its explicitly labelled `Datum`
only when the expected decision heading and decision-document path are present.

Published pagination links are followed and deduplicated. The IMY sanction index
is currently a single page with year sections. KKV list pagination uses published
page links; if a rendered result range indicates more records but supplies no
usable links, the report records `pagination_links_missing`. An unrecognized
layout fails extraction and requires a source-layout check. Repeated URLs do not
loop. Duplicate bytes share one blob when copies are
retained; distinct source URLs keep distinct document identities and provenance.

Re-running the same root retains previous document versions and records new fetches.
ETag/Last-Modified requests use 304 only when an extraction for the current parser
is available. Otherwise the body is fetched again. Same URL/hash/parser produces
one extraction; changed bytes or parser code produce new evidence or extraction
versions. A new byte version records the previous document ID. Reverted content
also retains its fetch history. Rights/privacy review state stays unapproved.

Words concerning corrections or replacement, and labelled links to replacement
documents, create review candidates. A changed hash is not a confirmed corrected
decision; a source mention of an appeal is not a verified appeal outcome. Human
review must establish any `supersedes`, appeal or finality relationship later.
This phase does not merge dockets, create legal decisions, interpret amounts or
populate sanctioned-party links. Multiple docket references remain a candidate
set with a null singular reference.

## Expand to the frozen cohort

A verified real 50-company cohort became available on 2026-10-17. The broader IMY
run now has 50 dated member observations against collected mentions; KKV remains
blocked. The original pilot's `not_measured_registry_missing` status is historical.
See [completion](completion.md) for the current batch and unknown coverage limits.

When the Phase 1 frozen bundle exists and verifies, add it to a broader bounded
publication scan. Increase these bounds deliberately after inspecting the pilot:

```sh
python -X utf8 platform/compliance_intelligence/decision_ingest.py --source all --root .research/compliance-intelligence/decisions --cohort .research/compliance-intelligence/YOUR_FROZEN_COHORT --max-pages 100 --max-records 500 --max-documents 1000
```

Use a fresh scan without `--batch-manifest` to discover beyond the fixed pilot.
The bundle is read and hash-verified without changing sample membership. A search
for each member is an assessment against collected publication mentions, not an
automated assertion of no cases. Coverage remains partial even at the end of a
selected website list. A missing mention is not a legal clearance.

Organization numbers use the existing legal-entity validation and exact registry
resolver. Name candidates use the registry's aliases and effective dates. Names
and numbers are not paired from text proximity. With no document decision date,
the snapshot date is only a search hint and automatic confirmation is withheld.
All mentions have `contextual_mention`/`context_only` scope and require review.
The resolver does not follow parents, subsidiaries or mergers. Neither an issuer
nor a foreign parent receives another entity's case. A registry search country's
value does not determine the document subject's registration country.

## Handoff

1. Supply and freeze the verified Phase 1 cohort using the existing SCB or local
   register workflow. Preserve its original population, date and membership hash.
2. Establish ordinary permitted KKV access or an official supplied extract. Recheck
   robots/terms and validate real list, pagination and attachment layouts before
   expanding. Do not treat the synthetic adapter tests as production verification.
3. Inspect private pilot failures, date evidence and candidate names. Add source
   layout fixtures when real templates differ. Record unresolved extraction and
   scan/OCR gaps with their evidence versions.
4. Run the larger bounded scan with the verified cohort and inspect per-source
   failures, deferred discoveries and member candidate sets. Keep unknown source
   denominators and search coverage as null.
5. A later interpretation phase may review identities, classify distinct legal
   events and link appeals/corrections with evidence. Privacy, reuse and publication
   approvals must bind to exact evidence versions before any public export.

No rankings, dashboard, homepage or intro-animation change is part of this phase.
