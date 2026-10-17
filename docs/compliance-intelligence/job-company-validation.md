# Job/company integration validation

Checked 2026-10-17. Implementation and a real observed batch are available in the
working tree. No deployment, Git push or external secret change was performed.

## Observed source coverage

The [machine-readable report](job-company-coverage.json) is generated from the
sealed source manifests and the public projection. It is a dated observation,
not a live national vacancy count.

| Measure | Observed result |
| --- | --- |
| Client publication query | 2026-10-10 13:19:44 through 2026-10-17 13:19:44, Europe/Stockholm wall clock; upstream offset semantics unspecified. |
| Job collection completed | 2026-10-17T11:19:52.190467+00:00. |
| Unique API records returned | 604. |
| Excluded removed/unconfirmed Data/IT records | 8, retained with reasons in the private collection. |
| Active confirmed Data/IT advertisements in this window | 596. |
| Verified advertised-entity links | 593, or 99.50%. |
| Ambiguous / unresolved / awaiting review | 1 / 2 / 0. |
| Published canonical company profiles | 247. |
| Validated legal-person SCB requests | 249; 248 normalized entities, no 404s, one held unsupported foreign-legal-person record. |
| Companies with reviewed financial facts | 0; the production context array is empty. |
| Company-scoped complete compliance coverage | Null / not assessed. |
| Public legal release | Unavailable; no unapproved finding is exposed. |
| Job freshness deadline | 2026-10-19T11:19:52.190467+00:00; stale records are withheld. |

The sealed input run is under the ignored private directory
`.research/job-company/20261017T111944617830Z/`. Its `production-validated`
resolution bundle contains registry DuckDB, Parquet relationships/marts,
review queue, audit, implementation hashes and public projection. No manual
identity approval was invented for the three remaining advertisements. One
verified register observation is not exposed as a matched job company because
the advertisement's identity remains ambiguous.

This lookup did not acquire a complete eligible industry population or freeze the
50-company cohort. It does not change any existing cohort membership. The job
population includes all employer industries advertising the selected IT jobs.

## Checks

| Check | Result |
| --- | --- |
| Full Python suite after delivery ownership fix | 625 passed, 2 skipped, 105.63 seconds. |
| Final job producer/resolution checks, including the subsequently added production-source guard | 10 passed, 3.29 seconds. |
| Frontend unit suite | 115 passed. |
| Full desktop/mobile Playwright suite | 157 passed, 2 skipped, 2.3 minutes. |
| Final job/company integration cases after recruiter-role and rooted-asset changes | 8 passed, 9.5 seconds. |
| Production CSP/XSS/browser checks | 3 passed, 4.6 seconds, explicit Playwright exit code 0. |
| npm dependency audit | Zero reported vulnerabilities at every severity; exit code 0. |
| TypeScript and production build | Passed, including compliance approval/presentation gate and job public-contract gate. |
| Python and Node public job-contract checks | Passed against the actual source projection. |
| Formatting and Git whitespace check | Passed. |
| Prose scanner on new UI and methodology | Zero findings. |
| SCB key isolation | Configured key absent from the public job payload and built JavaScript; key value was never logged. |

The full suites preserve existing intro-animation, homepage, job report and R2
delivery regression tests. Synthetic identities are confined to test fixtures and
private test bundles. Production publication additionally requires the official
live JobSearch provenance; a fixture/historical batch cannot replace the designated
public file. The final targeted producer tests cover that gate.

Tests exercise exact organization numbers, contradictory and similar names,
reviewed/historic brand aliases, group separation, invalid/unresolved identifiers,
recruiter/end-employer role review, duplicate and changing pagination, window
splitting, missing register/financial/legal data, source attribution, private
contacts, explicit financial context for an entity without current ads, stable
canonical navigation, deep-link reload, freshness and unsafe URLs. A reviewed
synthetic Gold release checks direct legal-ID joins, finality and exclusion of
another entity's decisions. The committed real projection is also exercised in
the browser while fresh, with an explicit hold assertion after expiry.

An initial full run found overlapping R2 ownership for the new file; excluding it
from `jobs-analysis` fixed the conflict. A later run hit Windows `WinError 5` during
an unrelated Riksdag test's atomic temporary-file replacement. That test area and
the subsequent complete suite passed without changing its implementation.

Desktop/mobile screenshots were inspected. Source hashes and long names wrap;
tables scroll within their own container. Axe checks passed on the company
profile, and real-source navigation has no horizontal overflow. The UI reuses the
existing report frame, Helvetica token, neutral surfaces, muted violet focus and
coverage accent, and shared bar chart. Swap/squint/signature/token review found
no new design-system divergence. Web-guidelines review has no outstanding finding.

## Files changed for this integration

Earlier compliance phases and unrelated work were already present in this dirty
worktree. Their changes are documented separately; this integration preserves
them. The relevant added/extended files are:

| Area | Files |
| --- | --- |
| Canonical identity and storage | `platform/compliance_intelligence/job_resolution.py`, `job_links.sql`, `sources.py`, `cohort.py`. |
| Current job collection and projection | `platform/ingest/jobtech/ingest_jobs.py`, `weekly_jobs.py`, `platform/publish/job_companies.py`. |
| Python tests | `platform/tests/compliance_intelligence/test_job_companies.py`. |
| Frontend profiles/list | `frontend/src/companies/CompanyIntelligence.tsx`, `model.ts`, `companies.css`. |
| Routes, navigation and rooted asset/data loading | `frontend/src/router.ts`, `App.tsx`, `dataSource.ts`, `content.ts`, `site/Header.tsx`, `projects/projectRegistry.ts`, `projects/topics.ts`, `jobb/JobsReport.tsx`, `frontend/index.html`, `frontend/vite.config.ts`, `wrangler.toml`. |
| Existing Explorer integration and review fingerprint | `frontend/src/compliance/ComplianceExplorer.tsx`, `platform/compliance_intelligence/explorer.py`, `scripts/check_compliance_release.mjs`. |
| Delivery and scheduling | `configs/delivery/jobs.json`, `jobs-analysis.json`, `schemas/company-intelligence.json`, `platform/pipeline.yml`, `.github/workflows/refresh-jobs.yml`. |
| Public observed data/build gate | `frontend/public/data/jobs/company-intelligence.json`, `scripts/check_job_companies.mjs`, `package.json`. |
| Frontend tests | `frontend/tests/fixtures/companies.ts`, `unit/companies.test.ts`, `companies.spec.ts`, `companies.policy.ts`, `frontend/security.playwright.config.ts`; formatting of the existing `compliance.policy.ts` and `security.policy.ts`. |
| Documentation | This report, `job-company-integration.md`, `job-company-coverage.json`, and links in `README.md`/`data-dictionary.md`. |

The existing `.env.example` already declares `SCB_API_KEY` and local-extract input
variables. No real credential is added. Rooted favicon/CV destinations and Vite's
rooted asset base support nested company URLs; the homepage's composition and
animation code were not changed for this integration.

## Deployment and remaining data work

1. Configure `SCB_API_KEY` in the existing `anton-portfolio` GitHub environment.
   The local ignored key has been verified, but does not configure the workflow.
2. Deploy the built static Worker with the updated SPA routing, then run the
   existing `market` pipeline/publish process to deliver the new `jobs` file through
   the versioned R2 manifest. An older manifest truthfully withholds the missing
   dataset. Run daily and monitor refresh failures; stale jobs expire after 48 hours.
3. Retain private sealed bundles in access-controlled storage if human reviews
   must survive CI runner disposal. Resolve the three held advertisements only
   with documented identity/role evidence and authorized human reviews.
4. Supply approved, directly attributed financial/workforce/contracts/events/
   repository/issuer observations through the documented context interface.
   They join by exact canonical ID and become visible without frontend name matching.
5. Complete the separate eligible-population/frozen-cohort work and human legal
   evidence/publication reviews before releasing company-level legal outcomes.
   No enforcement ingestion or legal ranking was added by this task.

The operation/API/table details and exact local commands are in the
[integration methodology](job-company-integration.md).

The required Idea Lineage capture was attempted. Existing journal records lack
`created_at`, causing `platform/idea_lineage/store.py:80` to raise `KeyError` before
capture. That separate journal was left unchanged; the failure log is in the
ignored `tmp/job-company-lineage.log`.
