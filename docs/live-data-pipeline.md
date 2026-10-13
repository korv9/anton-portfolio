# Live data pipeline

The 13 October 2026 public-data run stopped while reading 16 documents from
2014/15. Riksdagen returned their identity and committee links but no embedded
HTML. The separate text endpoint also returned metadata. The identified main
PDFs were available from Riksdagen's file service.

`studies_ingest.py` now reads those official PDFs when embedded text is absent.
It requires matching document identity/title, one main PDF and the official
file host. Empty or invalid PDF text remains a failure. The downloaded bytes,
source URL and hash are preserved; preparation rows link to that provenance.
Pypdf 6.20.0 is pinned to the version tested locally. Existing HTML parsing,
attachment coverage, partial checkpoints and tax ancestry checks remain intact.

All 16 documents from the failed run were successfully parsed against their
actual PDF sources. Local checks passed: 426 platform tests (two skipped),
90 frontend unit tests, type checking, formatting and the production build.

## Bootstrap and activation

`publish-r2.yml` accepts `manifest_key`. Use
`manifests/pipeline-smoke.json` to verify the complete bundle separately from
the production pointer, then `manifests/current.json` for production.
Bootstrap reads existing approved group manifests with `release.py current`
and reuses those exact release ids. It seeds only missing groups from verified
exports, so newer jobs/news/public-data and their schema samples stay together.
Every supplied release is read back and verified before one activation.
Materialization and immutable object verification use four independent
operations at a time; queued work is cancelled on failure. Hash checks and the
single final pointer write remain required.

Required groups are baseline, jobs, jobs-analysis, news and public-data. DiVA
is added only when a real export or catalogue entry exists. Shared raw
checkpoint writes and publication retain the existing data-refresh lock.

The production data domain is `https://data.antonernstsson.com/`.
`R2_PUBLIC_BASE` is configured as a repository Actions variable. GET and Range
preflight were verified with the site's Origin. Secrets remain in the existing
GitHub environment.

The frontend connection must be enabled only after the complete bundle is
verified. Use `manifest_url` in the site's delivery file or the existing
`VITE_R2_MANIFEST_URL` build setting. Code deployment enables that connection
once; daily data publications then update the manifest without a code deploy.

## Verification record

The source fix, isolated bootstrap, public-data refresh and frontend activation
are separate checks. Live workflow links and final results are recorded below
as each completes.

- [PR47](https://github.com/korv9/anton-portfolio/pull/47) merged as `27b15c2`.
  GitHub CI and the production Cloudflare build passed.
- [The first corrected live run](https://github.com/korv9/anton-portfolio/actions/runs/38412230320)
  completed welfare and parliament. Taxes then rejected the valid historical
  filename `19992000.csv.gz`. Its guard now accepts consecutive session years
  with either two- or four-digit endings and still requires verified seals.
- [The isolated bootstrap](https://github.com/korv9/anton-portfolio/actions/runs/38414411711)
  stopped before activation on a V1 Parquet size check. The real object has
  329,302 bytes, its CRLF-normalised form has 329,300 bytes, and the normalised
  hash matches the historical catalogue exactly. Materialization now checks
  binary sizes against raw bytes while preserving the historical hash policy.
  Legacy text-size compatibility and corruption rejection remain tested.
- Follow-up local checks: 429 platform tests passed (two skipped), 90 unit
  tests passed, and tax bootstrap still verifies 62 decisions through 37 dbt
  nodes/tests. The isolated browser run passed all 126 existing tests; the two
  live acceptance tests are opt-in and run against actual approved releases.

`build_catalog.py` retains an explicitly configured live manifest URL on
rebuild. UI checks pin the committed snapshots; live acceptance separately
checks group/file hashes and the browser's versioned reads. A custom
`PLAYWRIGHT_PORT` starts an isolated server, with unique output directories.
Offloaded UI fixtures use API-backed reads from nonstandard local ports;
live browser checks use the production Origin and its actual CORS policy.

- [The corrected public-data run](https://github.com/korv9/anton-portfolio/actions/runs/38418822351)
  passed ingestion, dbt builds, data contracts, R2 publication and the run record.
  It activated public-data release
  `75b52503c551cd7b934d6f5891ab8d45cce6d5ec84f8bcfc42d11a4e21010586`
  from code `3c2f48c`, with 156 files. No stale schema samples from other dbt
  subjects are added to that approved group during bootstrap.
