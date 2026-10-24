# Job Intelligence: compliance subsystem

The compliance pages were withdrawn from the site on 2026-10-21. `#compliance*`, `#jobb*`
and `/companies/*` redirect to `#what-does-it-even-mean` (`frontend/src/router.ts`). The
source in `frontend/src/{compliance,companies,job-intelligence}` stays unrouted, because
`npm run build` runs `scripts/check_compliance_release.mjs` against
`frontend/public/data/compliance/release.json` and `progress.json`. The job side is
documented in [Job Intelligence](../job-intelligence.md).

The module describes documented proceedings and outcomes for a frozen cohort of 50
Swedish IT legal entities. Every published statement must identify its source, the
entity concerned, its legal category and the date through which it was verified. An
administrative sanction is not a criminal conviction. Missing records mean unknown
coverage, never a clean bill of health.

## Status, checked 2026-10-17

| Phase | Implemented and exercised | Open |
| --- | --- | --- |
| 1, cohort and identity | Authenticated SCB acquisition, complete six-segment traversal, canonical registry, conservative resolution and a verified frozen 50-company export. | Human clearance of source reuse and publication. Historical aliases, ownership and foreign parents are absent unless separately evidenced. |
| 2, source ingestion | IMY scan and an incremental repeat bound to the real cohort, with URL, version and hash provenance, reference-only retention and failure reporting. | KKV returns HTTP 403. Two unique PDFs have no extractable text. Source-population coverage is unknown. |
| 3, evidence and review | 53 schema-validated private candidates, queue, identity holds, exact excerpts, audit chain and pending review templates. | Zero evidence-complete records and zero human actions. |
| 4, analytics | Six datasets built against the real cohort and the empty approved Gold: 50 unassessed company rows and 18 authority/year coverage rows. | Case, decision, amount and ranking tables have no rows. Financial history is unavailable. |
| 5, explorer and export | Four views, SVG/PNG/CSV/Markdown export, an independent final-review gate and an aggregate progress panel. | The private stage awaits human review. The public legal release is `unavailable`. |

No company outcome has been approved by a human reviewer. The audit has 113 verified
entries; human actions, publication-eligible records and approved Gold decisions are all
zero. That is workflow status, not evidence of zero sanctions.

The IMY run `82f07b44-b305-4e88-8ee9-7fdeb6399484` (finished 2026-10-17 14:15 UTC) read
1 list, 45 record pages and 73 documents with no HTTP or extraction failures. Its 55
distinct PDF versions gave 53 candidates and two `no_text_ocr_not_run` holds, in 19
provisional case groups. Coverage is `bounded_partial` for IMY and `blocked_access` for
KKV. KKV-dependent and combined-source rankings are disabled.

## Cohort

SCB retrieval ran on 2026-10-17 (source as-of date 2026-10-17). The private snapshot has
62,113 rows, 47,080 normalized legal entities and 15,033 excluded rows (natural persons and
foreign legal persons without a local registration). 43,836 active Swedish ABs are eligible.

| Primary SNI 2025 | Segment | Received rows | Pages |
| --- | --- | ---: | ---: |
| 58290 | Other software publishing | 4,277 | 1 |
| 62100 | Computer programming | 31,623 | 7 |
| 62201 | Computer consultancy | 21,492 | 5 |
| 62202 | Computer facilities management | 1,440 | 1 |
| 62900 | Other IT and computer services | 1,031 | 1 |
| 63100 | Data infrastructure, processing and hosting | 2,250 | 1 |

Selection sorts by employee size class descending, then organization number ascending.
Twenty-five entities are above class 8; the other 25 come from the 72 eligible entities in
class 8 (200–499 employees). This is a size-class sample with a fixed tie rule, not a
ranking by headcount, revenue or group size.

- Cohort ID: `se-it-50-2026-10-17`.
- Membership SHA-256: `f0866d8ad65709168017e8cdaf0e2e19b772c6bfaeeb908eb187233f96d8b3d5`.
- Population manifest SHA-256: `95af1fe6480472f95f70d639df32e3e15eb7ad04de583a7c75198054ee47f8cd`.
- Private bundle: `.research/compliance-intelligence/cohort-se-it-50-2026-10-17-v2`
  (version 2 keeps the membership hash and marks DuckDB source reuse flags `unverified`).

## Documents

| Document | Covers |
| --- | --- |
| [Architecture](architecture.md) | Storage boundaries, entity identity, cohort design and lifecycle |
| [Data dictionary](data-dictionary.md) | Table grain, fields, enums, the extraction contract and the job/company tables |
| [Risks](risks.md) | Publication controls, source access and reuse, privacy and ranking safeguards |
| [Phase 1 operation](phase-1.md) | SCB access, CSV/Parquet fallback, identity matching and cohort commands |
| [Phase 4 methodology](phase-4-methodology.md) | Public metric definitions, comparison limits and missingness; the explorer embeds this file |
| [Phase 5 operation](phase-5.md) | The four explorer views, the public review gate and research export |

## Operator commands

Run from the repository root with `python -X utf8`. Keep `SCB_API_KEY` in the ignored local
environment or a GitHub environment secret. Every command writes to private paths under
`.research/`, never to R2.

| Script in `platform/compliance_intelligence/` | Subcommands |
| --- | --- |
| `cli.py` | `status`, `ingest`, `build`, `verify`, `search`, `resolve` |
| `decision_ingest.py` | `--source imy\|kkv\|all`: collect authority documents |
| `public_documents.py` | `plan`, `fetch`, `import-local`, `coverage`: the independent court-PDF supplement |
| `review_cli.py` | `extract`, `import-proposal`, `schema`, `queue`, `summary`, `show`, `review`, `verify-audit`, `export-gold`, `validate-release` |
| `analytics.py` | `status`, `build`, `query`, `validate` |
| `completion.py` | `prepare` (review handoff), `publish-progress` (writes `frontend/public/data/compliance/progress.json`, never the legal release) |
| `explorer.py` | `stage`, `promote`, `withdraw` ([Phase 5](phase-5.md)) |

Each subcommand prints its options with `--help`. A completed review request is applied with
`review_cli.py --root PRIVATE_ROOT review --request REQUEST.json --reviewers ROSTER.json`;
the publication reviewer for a negative record must differ from its preparer.

Domstolsverket, individual courts, FI and Bolagsverket were assessed but have no connector
yet ([source access](risks.md#source-access-and-reuse)).

## Code and tests

The schema is [`schema.sql`](../../platform/compliance_intelligence/schema.sql) with
[`contracts.py`](../../platform/compliance_intelligence/contracts.py). Test records are
synthetic and use temporary directories:

```sh
python -m pytest platform/tests/compliance_intelligence -q
```
