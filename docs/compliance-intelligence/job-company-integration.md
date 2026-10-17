# IT jobs and canonical company identity

Implemented and source-checked 2026-10-17. Readers can open a verified advertising
entity from an IT advertisement and return to its related current advertisements.
Unknown identities remain visible as advertisements, without company-level data.

## Repository audit

The checkout had aggregate job reports, occupation/technology analyses and ad
clusters, but no individual-ad section named "Veckans IT-jobb" and no canonical
company profile route. `JobsReport.tsx` and `JobsProduct.tsx` remain the existing
job product. The new list is a deep dive at `/#jobb-it`, reached from that report
and its topic navigation. The four existing report tabs remain intact.

`ingest_jobs.py` already provides immutable `raw.job_ads` payload versions,
deduplication and a retrying JobSearch client. `weekly_jobs.py` uses that same
client and writer. The daily market pipeline retains its archive/stream counts;
its new export step collects current advertisements. The existing market
export contains aggregate counts. Legacy hashed
`gold.dim_employers.employer_id` values remain legacy identifiers, not canonical
company IDs. No existing historical ads are rematched by name.

The existing compliance registry supplies organization-number validation, legal
identity records, reviewed aliases, dated relationships, private snapshot storage,
sealing and DuckDB schemas. `populate_database` can now materialize those same
registry tables without freezing a cohort. Job identity bundles use the same
`dim_company`, `dim_company_alias`, `company_relationship` and ID namespaces.
They are versioned materializations of this registry, not another company ID
system. The original frozen cohort is never changed by a job refresh.

No usable company financial history, client/contract, repository-ownership or
issuer mapping dataset was found. The profile exposes these gaps and accepts
reviewed, directly attributed context observations when available. Public legal
data comes exclusively from the existing approved Compliance Explorer release.

## Sources and access

JobSearch's [official OpenAPI document](https://jobsearch.api.jobtechdev.se/swagger.json)
declares advertisement reuse under [CC0](https://creativecommons.org/publicdomain/zero/1.0/deed.sv).
The collector uses the API, not website scraping: Data/IT occupation field
`apaJ_2ja_LuF`, publication window, publication-date sort, 100 records/page,
offsets below 2,000, four requests/second, retries/backoff on throttling and server
errors. Larger result sets split the publication interval, with overlapping
boundaries deduplicated by native advertisement ID. Different IDs remain distinct
even when titles match. Changing totals, repeated/missing pages and an unresolved
dense interval fail the collection. Equal page totals cannot prove an immutable
snapshot: the API offers no snapshot token. Copies and request parameters remain
private, so the observed batch can be reproduced offline even after ads disappear.
Client query wall times use Europe/Stockholm; OpenAPI does not specify upstream
offset semantics. Publication timestamps retain their source representation.
Daily hiring counts use the source calendar-date text, without an inferred UTC
conversion. Split windows overlap by one second to avoid losing boundary records.

[SCB documents](https://www.scb.se/vara-tjanster/bestall-data-och-statistik/foretagsregistret/avgiftsfria-uppgifter-i-foretagsregistret/)
current legal-unit/workplace data, employee size classes, a personal API key,
5 requests/second and no historical or changes-only endpoint. The existing
SCB client stays below that limit. Targeted requests use the documented v1 legal
unit endpoint with `16` followed by the validated ten-digit organization number.
The key is read from `SCB_API_KEY` and sent only in `X-API-Key`.
The authenticated endpoint and its returned identity were checked live. A 404
remains missing; unsupported foreign-legal-person records are held with their
evidence for identity review. A current snapshot
does not establish when a company changed its name or employee count.

The employer population includes employers in all industries advertising IT jobs.
It is not the eligible IT-company population or the fixed 50-company cohort.
SCB lookup snapshots explicitly set `population_complete=false`. Company ID,
registration country, securities issuer and workplace remain separate.

## Resolution contract

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

## Tables and analytical grain

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

## Public API and routes

This is the existing static Worker/R2 architecture; no duplicate API server is
introduced. `jobs/company-intelligence.json` is part of the existing `jobs` delivery
group, excluded from `jobs-analysis` to give it one owner. The existing pinned
delivery loader serves the same dataset to the list and every company profile.
Semantic checks reconcile IDs, payload hashes, evidence, status counts and match
percentage; Node validates the browser contract during the production build.
The production publisher also checks official live JobSearch provenance and
withholds fixture/historical batches. Private audit files retain implementation
hashes and the resolution version.

The version-1 response has `state=available` or `state=unavailable` with a reason.
Available responses include `generated_at`, `valid_until`, `registry_hash`,
`coverage`, `metrics`, `jobs`, `links`, `companies`, `relationships` and `context`.
The [delivery schema](../../configs/delivery/schemas/company-intelligence.json)
and [browser model](../../frontend/src/companies/model.ts) define the fields.
Ad fields include native ID, title, original employer/workplace, validated public
organization number or null, location, structured skills, publication/deadline,
original URL and canonical payload hash. "Technologies" means skills explicitly
mentioned in ads, not an asserted deployed stack. No raw descriptions or contacts
are published. Natural-person organization identifiers are withheld.
The advertisement hash is SHA-256 of the existing writer's sorted-key UTF-8 JSON
serialization (`ensure_ascii=False`, default separators), not a digest of the
linked HTML page. Original API-response byte hashes and request parameters are
retained separately in the sealed private collection.

| Route | Behaviour |
| --- | --- |
| `/#jobb-it` | Current ads, coverage, search and verified company links. |
| `/#jobb-it?company=<encoded canonical ID>` | Jobs explicitly linked to that entity; no group rollup. |
| `/#jobb-it?q=<search>` | Search card metadata; this does not resolve identities. |
| `/companies/:companyId` | Canonical legal profile; the complete ID is URL-encoded as one segment. |
| `/#compliance-company?company=<encoded ID>` | Existing reviewed decision detail/evidence. |

Profiles show overview, financial/workforce context, observed recruitment,
documented decisions, corporate events/relationships, clients/contracts, technology,
repositories/issuer context and related jobs. Missing IDs return a missing-profile
state; no similarly named company is substituted. Back/forward, reload and native
open-in-new-tab work. Site-root data/assets and Cloudflare's documented
[SPA fallback](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
support deep links. Existing hash routes and home navigation remain available.

## Missing legal data and publication safeguards

Only the existing approved, unexpired public Gold release can supply legal records.
The join is exact `company_id`; family-level metrics prevent multiple judgments
from becoming multiple sanctions. A parent receives no subsidiary decisions.
Appeal/finality statuses and subsequent source decisions remain visible. The
public approval fingerprint now also includes company-profile presentation code.
No legal ingestion, rankings or new legal conclusions occur in the job pipeline.

An unavailable/expired legal release means **not assessed**, not zero sanctions.
Approved records with no company decision also do not establish a negative search.
The requested wording "No documented sanctions identified in the covered sources
and period" needs an actual reviewed company-scoped search record defining those
sources and dates. None exists yet, so the implementation displays the narrower
truthful unavailable/incomplete-coverage state. It never says zero violations.
Company-scoped complete-search coverage remains null; reviewed documents and
complete authority/company search coverage must not be confused.

## Local operation and deployment

Keep the real key in the existing ignored root `.env` or process environment.
[`.env.example`](../../.env.example) declares the key and local register fallback.
Local CSV/Parquet extracts still use the Phase 1 provenance-sidecar ingestion;
pass that sealed snapshot directory with `--registry`. Missing API access is
supported: ads are collected, but unmatched identities remain unresolved.
Authentication failures with a configured key fail the refresh; they do not
silently downgrade an allegedly verified company.

```powershell
# Collect a new observed batch and prepare its canonical identity projection.
python platform/publish/job_companies.py refresh
# Same operation, atomically replacing the designated local public projection.
python platform/publish/job_companies.py refresh --publish
# Offline rebuild / human review from exact preserved inputs (new output path).
python platform/publish/job_companies.py resolve --collection .research/run/collection --database .research/run/job-market.duckdb --registry .research/run/registry --output .research/run/reviewed --reviews .research/reviews.json --reviewers .research/reviewers.json --context .research/context.json --publish
# Targeted SCB lookup: private JSON array, validated legal-person numbers only.
python platform/publish/job_companies.py lookup --numbers .research/numbers.json --output .research/new-registry
python platform/publish/job_companies.py check
npm run jobs:check
npm run build
```

Optional `--identities` uses the existing reviewed identity supplement. Context
inputs accept only the enumerated financial, workforce, event, contract, technology,
GitHub and stock observation kinds, exact company ID, `entity_scope=legal_entity`,
approved human review, period/label/string value/unit, verification time and
precise source URL/hash/locator. Stock observations additionally require their own
`issuer_id` and country. Human reviewer identity/rationale remain private. Legal
findings are not a context-fact kind and must use the Gold release instead.
Reviewed context may include a verified registry entity with no observed current
ads; its profile shows that context without inventing recruitment records.

The daily `market` subject runs the new refresh/export step. Set `SCB_API_KEY` in
the existing `anton-portfolio` GitHub environment; the workflow references that
secret without embedding it. The local key does not configure GitHub or Cloudflare.
No SCB secret is needed in the browser or static Worker. Build and deploy through
the existing process, then publish the updated versioned `jobs` R2 group. An old
active delivery manifest lacks the new file: the UI truthfully reports unavailable
until that group is published; it never substitutes unrelated local production data.

Private raw responses, SCB snapshots, review queues, DuckDB/Parquet and audit logs
stay under `.research/job-company/` (or an explicitly chosen private output).
They are excluded from the warehouse upload roots and Git. CI currently discards
these private working files with its runner; operators needing retained manual
review must archive the sealed bundle in access-controlled private storage, not
the public R2 data prefix. Refreshes do not automatically carry human decisions
to changed input versions. Use the offline resolve command for a reviewed batch.

Jobs expire after 48 hours; the UI withholds stale records. A failed refresh keeps
the previous artifact, which still expires. Daily refresh and failure monitoring
are therefore required. The build checks structure even for expired snapshots,
while the browser enforces freshness. This prevents an unrelated site build from
publishing stale ads as current or depending on a private API credential.

No deployment or external secret change was performed by this implementation.
The homepage and intro animations were not changed for this integration.
