# Phase 1 operation

Implemented 2026-10-16: SCB register acquisition, local CSV/Parquet import,
conservative legal-entity resolution, exploratory search and frozen 50-entity
cohort bundles. On 2026-10-17 the real SCB population was acquired and the 50-member
sample was frozen. See [current completion](completion.md) for exact inputs,
private exports, membership hash and remaining publication review.

Run commands from the repository root with the existing Python requirements
installed. No new dependency is needed. The entry point is
[`cli.py`](../../platform/compliance_intelligence/cli.py).

## Activate SCB access

Register through the portal linked by
[SCB's current API information](https://www.scb.se/vara-tjanster/bestall-data-och-statistik/foretagsregistret/avgiftsfria-uppgifter-i-foretagsregistret/),
accept its terms and obtain your authorized key. The key is personal to the issued
API access. Set `SCB_API_KEY` in the process environment or an ignored local `.env`.
The CLI uses the repository's existing `load_env` helper. Existing environment
values take precedence over `.env`. Add variables from
[`.env.example`](../../.env.example) to an existing `.env`; copy the example only
if no `.env` exists. Keep production credentials in the authorized secret store.

```sh
python platform/compliance_intelligence/cli.py status
python platform/compliance_intelligence/cli.py ingest --source scb --output .research/compliance-intelligence/register-2026-10-16 --reuse-reviewed-by YOUR_REVIEWER_ID
```

The output directory name is illustrative. Actual `as_of_date` comes from retrieval,
not the directory name. `--reuse-reviewed-by` records your review of source reuse
terms; omit it to keep source reuse unreviewed. The explicit `build --private-only`
option permits private selection from a complete directly acquired SCB population
while preserving that unreviewed state. It cannot approve a local extract or a
public release. `--reuse-reviewed-by` does not
approve public publication. A key is never supplied as a command-line argument,
written to provenance or printed in an error message.

The implementation follows the
[official AFR v1 OpenAPI specification](https://apiafr.scb.se/swagger/v1/swagger.json),
retrieved without authentication for inspection on 2026-10-16:

- HTTPS origin `https://apiafr.scb.se/v1`, header `X-API-Key`; redirects are refused.
- `GET /juridiskaenheter/naringsgren/{code}` for each eligible primary SNI code,
  with `limit` and subsequent `cursorId`.
- Read `jes`, `pagination.hasMore` and `pagination.nextCursorId`; traverse every
  page through the terminal response. The default page size is 5,000, with a
  configurable hard page bound of 1,000 per industry.
- Check each industry's `/count` before and after acquisition, received record count,
  repeated IDs/cursors, returned primary industry, field types and requested page size.
  Errors or a reached page bound leave no completed snapshot.
- Issue requests sequentially at no more than four per second. Existing HTTP
  retry/backoff handles throttling and transient server errors. Record original
  response bytes/hashes, query parameters and retrieval timestamps without headers.

The API has no point-in-time snapshot token. Equal before/after counts cannot prove
that all values remained unchanged during retrieval. The manifest records the
acquisition interval and this limitation; acquisition crossing a UTC date is
rejected. Authenticated production acquisition passed those checks on 2026-10-17.
The API provides current register observations, not historical identity evidence
for a company at an older legal decision date.

## Local CSV or Parquet fallback

Provide the actual extract and a JSON provenance sidecar. CSV supports UTF-8/BOM
and comma, semicolon or tab delimiters; Parquet uses the existing PyArrow dependency.
No fabricated or bundled example companies are supplied.

| Canonical column | Accepted SCB column | Meaning |
| --- | --- | --- |
| `organization_number` | `OrgNr` | Ten digits, hyphenated ten digits, or SCB's 12-digit legal-person form beginning `16`; checksum and legal-person number class validated. |
| `registered_legal_name` | `Namn` | Registered legal-unit name. Empty names are held. |
| `primary_sni_code` | `PrimarNaringsgren.naringsgren` | Five digits, optionally dotted; only the primary industry qualifies. |
| `active` | `FtgStat` | `true`/`1` means active; `false`/`0`/`9` means inactive. Missing activity remains unknown. |
| `employee_size_class` | `AnstKl` | SCB class code, not a headcount or an interval label. Missing/zero class is excluded from selection. |
| `legal_form` | `Jurform` | `49` or `AB` qualifies. This extra field is required to exclude non-AB entities and branches. |
| `sni_version` | supplied in metadata if absent from the file | Must explicitly be `2025` to select the initial cohort; there is no silent 2007 crosswalk. |

Headers are case-insensitive and must be unique. See the
[official JE layout](https://www.scb.se/contentassets/8a8eb5c3d45f461ea93482f8e8d4de4f/postbeskrivning-je.pdf)
and [variable descriptions](https://www.scb.se/vara-tjanster/bestall-data-och-statistik/foretagsregistret/variabelbeskrivning/).
The codebook and selected six industry segments are pinned in
[`policy.json`](../../platform/compliance_intelligence/policy.json).

Sidecar structure below is an unfilled configuration template. Replace the marked
values with facts about the real extract. Leave completeness/reviews unset until
actually checked; exploratory import works without declaring a complete population.

```json
{
  "schema_version": 1,
  "source_id": "scb_company_register",
  "publisher": "SCB",
  "source_url": "https://apiafr.scb.se/v1/juridiskaenheter",
  "as_of_date": "ACTUAL-SNAPSHOT-DATE",
  "fetched_at": "ACTUAL-UTC-TIMESTAMP",
  "source_sha256": "ACTUAL-EXTRACT-BYTE-HASH",
  "row_count": "REPLACE-WITH-INTEGER",
  "sni_version": "2025",
  "primary_sni_codes": ["58290", "62100", "62201", "62202", "62900", "63100"],
  "population_complete": false,
  "terms_url": "https://www.scb.se/vara-tjanster/bestall-data-och-statistik/foretagsregistret/avgiftsfria-uppgifter-i-foretagsregistret/",
  "identity_review": null,
  "completeness_review": null,
  "reuse_review": null
}
```

Each completed review has the shape
`{"reviewer_id":"ACTUAL-REVIEWER","reviewed_at":"ACTUAL-UTC-TIMESTAMP"}`.
Identity review attests that the names and numbers came from the documented register.
Completeness review attests that the extract covers the whole declared eligible
population across all six primary industries, including all size classes and known
exclusions. A hand-picked list of 50 names is insufficient. Reuse review records
assessment of the actual dataset terms. Dates/timestamps must be ISO values with
explicit UTC timestamps; a population cannot be dated after retrieval.

```sh
python platform/compliance_intelligence/cli.py ingest --source file --input /private/companies.csv --metadata /private/companies.metadata.json --output .research/compliance-intelligence/register-snapshot
```

Replace `.csv` with `.parquet` for a Parquet extract. Alternatively set
`COMPLIANCE_COMPANY_FILE` and `COMPLIANCE_COMPANY_METADATA` in the environment.
`ingest --source auto` prefers that configured file; otherwise it uses `SCB_API_KEY`.
If neither input exists, the command exits with an actionable error and creates no
empty dataset. HTTP failures also create no completed snapshot.

## Identity enrichment and matching

Both acquisition modes accept `--identities /private/identity-evidence.json`.
This optional supplement has `documents`, `companies`, `aliases` and `relationships`
arrays. It supplies verified evidence for foreign parents, historic names, brands,
mergers and dated parent/operator links. A source file path is relative to the
supplement, stays within that directory and has its original-byte `document_hash`
checked before import.

| Supplement collection | Required fields |
| --- | --- |
| `documents` | `document_id`, `path`, `document_hash`, `source_id`, `source_url`, `publisher`, `fetched_at`, `content_type`. |
| `companies` | `registered_legal_name`, `legal_form`, `country_code`, source document ID/locator and a `review`. Swedish identities need `organization_number`; foreign identities need `registry_authority` and `registry_number`, with no Swedish number. Optional SNI/activity/class fields affect eligibility. |
| `aliases` | `company_id`, `alias`, `alias_type`, `valid_from`, `valid_to`, source document ID/locator, `review_status=approved` and `review`. Alias types: `brand`, `trading_name`, `historic_legal_name`. |
| `relationships` | `company_id`, `related_company_id`, `relationship_type`, effective dates, source document ID/locator, `review_status=approved` and `review`. Types: `subsidiary_of`, `merged_into`, `branch_of`. |

Swedish IDs are `se:orgnr:<normalized-number>`; foreign IDs are
`<lowercase-country>:<escaped-registry-authority>:<escaped-registry-number>`.
Country means registration country. Registry namespaces and foreign numbers retain
their source values. The supplement is a manually reviewed input, not an automatic
ownership inference engine. Unknown effective dates are retained and cannot prove
historic alias validity. Unreviewed supplements are rejected. An unsupported
foreign entity is not silently manufactured from its Swedish subsidiary's name.

```sh
python platform/compliance_intelligence/cli.py resolve --snapshot .research/compliance-intelligence/register-snapshot --number ACTUAL-ORGANIZATION-NUMBER --name "ACTUAL REGISTERED NAME" --on-date YYYY-MM-DD
python platform/compliance_intelligence/cli.py resolve --snapshot .research/compliance-intelligence/register-snapshot --country GB --registry-authority ACTUAL-REGISTRY --registry-number ACTUAL-FOREIGN-NUMBER --subject-role issuer
```

Only a verified exact registry identity can return `status=verified`. A supplied
name must agree with the current name or a documented alias valid on the requested
date. Names alone return candidates needing review. Shared names/brands, conflicting
observations and inconsistent dates are held with reasons and candidate IDs.
Suffixes and diacritics are retained; normalization only applies Unicode NFKC,
case folding and whitespace. Future dates cannot be verified from an older snapshot.

A legal-name change preserves the Swedish ID. A merger retains predecessor and
successor IDs and a separate relationship. Parent or sibling links are never
followed for identity confirmation or liability attribution. `subject_role=issuer`
is retained separately from company identity and registration country. No case or
sanction attachment is performed by this phase.

## Freeze and export

```sh
python platform/compliance_intelligence/cli.py build --snapshot .research/compliance-intelligence/register-snapshot --cohort-id se-it-v1 --output .research/compliance-intelligence/se-it-v1
python platform/compliance_intelligence/cli.py verify --bundle .research/compliance-intelligence/se-it-v1
```

The builder requires reviewed source reuse, complete scope and at least 50 verified
eligible Swedish AB legal entities. It orders the known employee classes descending,
then organization numbers ascending. Conflicting register observations or unexpected
malformed rows block freezing because a held entity could change the selection
boundary. Natural-person identifiers and foreign legal persons without local registry
identity are excluded with provenance locators; inconsistent AB/person identifiers
block freezing. Exclusions and size-class boundary counts are reported.

The output is a size-class-based legal-entity sample. It does not establish the
50 largest companies by exact headcount, or represent 50 independent groups.
Qualifying subsidiaries can be selected separately; pure holding firms and foreign
parents do not qualify just because their groups operate in IT.

Each bundle contains `registry.duckdb`, `cohort.csv`, `cohort.json`, `methodology.json`,
`population-manifest.json`, `exclusions.json`, `identity-ambiguities.json`,
`aliases.json`, `relationships.json`, the full normalized `snapshot.json`, original
evidence blobs and `artifact-manifest.json`. The four requested identity/cohort
tables are materialized in `compliance_intelligence`; case/decision tables remain
empty. Original registry SNI/activity/class attributes remain in the full snapshot;
selection attributes remain in `compliance_cohort` and its original exports.

Methodology records actual population date, retrieval interval/limitations, codebook,
policy and code hashes, eligible/excluded counts, duplicate observations, tie-break,
boundary class, freeze time and membership hash. The population manifest binds all
source responses/documents and their request parameters, not just one API page.
The supported builder refuses existing output directories; corrections use a new
snapshot/cohort version. Read-only queries and manifest verification preserve the
original bundle. These hashes detect changes, but are not digital signatures or
protection against someone rewriting both data and manifests with filesystem access.

All output is private. Inside this repo only ignored `.research/` or `tmp/` output
is allowed; public/frontend/warehouse/source roots and configured backup roots are
rejected. An external directory must also be protected by the operator's filesystem
permissions. Raw SCB responses may include non-cohort/personal records and must not
be committed or placed in public R2. No exporter, schedule or deployment publishes
these bundles.

## Separate exploratory search

```sh
python platform/compliance_intelligence/cli.py search --snapshot .research/compliance-intelligence/register-snapshot --query "SEARCH TEXT" --cohort .research/compliance-intelligence/se-it-v1
```

Search returns registry candidates and optional original-cohort membership. It reads
the entire imported population, including companies outside the selected 50, and
never changes membership. A later register snapshot can be searched while labeling
membership from the original bundle through `--cohort`. Search results do not inherit
cases or sanctions through brands or group links.

## Remaining activation work

Provide the authorized key or actual CSV/Parquet and provenance, inspect the first
real snapshot's conflicts/exclusions, complete source reviews, then build and verify
the real cohort. Confirm actual API behavior under credentials and the population's
coverage before treating the 50 as selected. Existing Phase 0
[source limitations](source-feasibility.md) and [publication controls](risks.md)
still apply. Enforcement ingestion and dashboard construction remain out of scope.
