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
Materialization prefers the current production releases, so bootstrap keeps
newer approved jobs/news/public-data instead of replacing them with older
committed exports. Groups are staged and verified before one activation.

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
