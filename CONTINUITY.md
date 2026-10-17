# Continuity

## Snapshot

- 2026-10-18 [USER] Job Intelligence is a compact continuous research terminal; all job, CV and company sections render without reveal controls.
- 2026-10-18 [CODE] Public mode uses generic newest-first jobs. Personalisation requires an explicit loopback-only local qualification profile; no candidate facts enter public releases.
- 2026-10-18 [CODE] Canonical job/company resolution, the frozen SCB compliance cohort and independent legal publication gates remain in use.
- 2026-10-18 [TOOL] Current observed source projection contains 600 Swedish ads; 599 were unexpired at the latest local check, with 25 local recommendations.

## Done / current / next

- 2026-10-18 [CODE] Added fulltext delivery, conservative extraction, deterministic local ranking, continuous company sections and private development access controls.
- 2026-10-18 [TOOL] Python: 662 passed, two skipped. Frontend: 129 unit tests; Playwright: 173 passed, two skipped; security: three passed. Build, format, TypeScript and publication checks passed after module split.
- 2026-10-18 [USER] No automatic deployment. Missing financial/workforce/contracts/repository/issuer data must remain absent; named legal findings still require human approval.

## Working set

- 2026-10-18 [CODE] `frontend/src/job-intelligence/`, `frontend/src/companies/`, `frontend/jobProfilePlugin.ts`
- 2026-10-18 [CODE] `platform/publish/job_content.py`, `platform/publish/job_companies.py`, `platform/compliance_intelligence/sources.py`
- 2026-10-18 [CODE] `configs/delivery/jobs.json`, `scripts/rank_local_jobs.mjs`, `docs/job-intelligence.md`

## Receipts

- 2026-10-18 [TOOL] Private real-data browser check: 25 ads, nine company sections, full source text, no render errors; public build contains no private profile fingerprint.
- 2026-10-18 [TOOL] Earlier complete test attempts encountered disk exhaustion and transient Windows directory locks; disk space was recovered with non-destructive test-artifact compression.

- 2026-10-18 [TOOL] Final receipts and task file inventory: `docs/job-intelligence-report.md`. Idea Lineage extraction failed on the existing journal missing `created_at`; no entries were written.

- 2026-10-18 [USER] Explicitly authorised committing the Job Intelligence work, merging with latest main and pushing to main. Other dirty workspace changes remain separate.
- 2026-10-18 [TOOL] A 54-file feature branch merged without conflicts into an isolated checkout of latest origin/main; upstream projects were retained. Merged verification passed: 680 Python tests, 141 unit tests, 180 browser tests and three security tests; type, format, build and publication checks passed.
