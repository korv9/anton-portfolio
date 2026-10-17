# Job Intelligence implementation report

Implementation date: 2026-10-18. Changes are local; no deployment, push or commit was performed.

## Delivered experience

`#jobb-it?job=JOB_ID` now opens a continuous research workspace. The desktop selector uses 22% of the layout, bounded to 220-270px; the selected advertisement uses the remaining width. Each pane scrolls independently. Mobile places the compact searchable selector above the same content. Selection stays in browser history and survives filtering, and the research pane resets to its top when switching jobs.

The right pane renders the full original advertisement, requirements, CV explanation and all nine company sections immediately. There are no mandatory tabs, expand controls or analysis buttons. Multiple independently verified employer roles produce separately attributed company sections. Unresolved identity never acquires another company's context.

Public visitors see generic analysis and newest-first jobs. Explicit local configuration enables private CV-based recommendations, best match first. The local qualification profile, evidence and recommendation export stay under ignored `.research/`; they are absent from public job payloads. The production application does not request the local profile endpoint.

## Architecture and reuse

The repository graph and repository instructions were consulted before source lookup. The graph did not cover several newer compliance/company modules, so targeted source inspection verified those relationships. The initial architecture plan was documented before implementation and is now maintained as [the architecture, contracts and methodology](job-intelligence.md).

Reused components and invariants:

- Official JobSearch ingestion, pagination/retries, time-window collection and immutable raw payload hashes.
- Existing canonical company registry, exact organisation-number/verified-alias resolution, separate recruiter/employer roles, SCB metadata and reviewed context datasets.
- Existing company loader, current jobs, source citations, Compliance Explorer, legal lifecycle and independent publication approval/expiry/withdrawal checks.
- Existing DuckDB/Parquet research outputs, versioned R2 delivery, Cloudflare infrastructure, React routing, shared chart components and grey/violet/Helvetica tokens.
- The frozen SCB 50-company compliance cohort and its sealed evidence. Its artifact manifest was verified unchanged.
- The separate Labour Market Observatory, legacy compliance links and canonical `/companies/:companyId` route.

Added fulltext publication packages, conservative requirement extraction, continuous presentation, a deterministic relevance engine, a local-only profile adapter and a reproducible private ranking CLI. Existing company evidence links, related-job cards and legal release rendering now have separate cohesive modules to respect the repository's code-file size rule, with their approval fingerprints retained. No backend framework, identity namespace or dependency was added.

The shared immutable staging helper now retries only bounded Windows access/sharing locks during atomic directory finalisation. Existing output is never replaced. Permanent failure and immutable-output tests remain enforced.

## Ranking methodology

The shared browser/CLI engine computes `round(100 * sum(weight * factor) / sum(assessed weights))`. Defaults are explicit-required skills 35%, preferred skills 10%, target role 20%, experience/seniority 15%, location 15% and education 5%. Configured but unassessed factors leave the denominator. An entirely unassessed weighting cannot recommend a job.

Each explicit requirement retains its original sentence, field and line. CV evidence is evidenced, partial or not evidenced; the last state does not mean the person lacks the skill. Ambiguous advertisement mentions do not become mandatory requirements. Professional years remain unknown unless explicitly documented; internships and projects are not converted into full-time years.

Unestablished required experience of at least three years, substantial required management and conflicting specified degrees cap the score at 39 and exclude automatic recommendation. Senior/lead/staff/principal and DBA/infrastructure-only roles cap it at 49. Alternative qualifications, unspecified seniority, supported remote arrangements and 0-2-year ranges are handled separately.

Recommendation requires direct target-role compatibility, the configurable threshold and no blocking experience/degree condition. Sorting prioritises suitability, then absence of potential required-condition uncertainty, score and stable job ID. Newest-first sorting remains available. This is an explainable research estimate, without ATS or calibrated hiring-probability claims.

The local profile separates documented qualification facts from location/role preferences. It records internships and projects without inventing professional years. The initial qualification file was checked against the supplied CV and excludes personal contact fields. Public visitors never receive that profile.

## Contracts and safety

Complete field contracts, source interpretation, privacy rules and API responses are documented in [job-intelligence.md](job-intelligence.md#public-data-contracts). Executable contracts are in `configs/delivery/schemas/job-workspace.json`, `model.ts`, `profile.ts` and `ranking.ts`.

- `job_id -> job_company_link -> company_id` remains the only company join. Parent/subsidiary findings are not transferred.
- Metadata, latest-50 fulltext and disjoint remaining fulltext share release timestamps and registry identity. Each text record is bound to its original payload hash. Quotes are validated against source lines.
- Text is rendered through React as text, with no active HTML. HTTPS links reject unsafe schemes, credentials, local/private addresses, unsafe ports and malformed URLs. Dedicated contact fields are excluded; known contact names, emails and phone numbers are redacted with a disclosed count.
- Current expiry/removal signals are applied during projection and rendering. Original source wording and whitespace are preserved apart from disclosed contact redactions.
- Local profile access requires explicit non-VITE configuration, a loopback connection/host and same origin. Responses are private/no-store. There is no production/preview endpoint, upload flow, applicant persistence or external CV transmission.
- Public negative legal records still require exact attribution, review, Gold approval and independent current publication approval. New presentation files enter the publication fingerprint. Old approvals require fresh staging/review before a changed legal presentation can publish.

## Measured real data coverage

Official observation: **2026-10-17T21:53:55.613961Z**, using the existing seven-day Data/IT collection. This snapshot expires **2026-10-19T21:53:55.613961Z**; refresh is required after that time.

| Measure | Observed result |
| --- | ---: |
| Active source records collected | 601 |
| Swedish eligible advertisements | 600 |
| Excluded explicitly Swiss workplace | 1 |
| Current candidates at final local ranking | 599 |
| Verified advertised-entity links in the 600-ad release | 590 (98.33%) |
| Ambiguous / unresolved links | 1 / 9 |
| Canonical company profiles | 246 |
| Public latest-at-publication fulltext package | 50 ads; 380,280 bytes |
| Separate remaining fulltext package | 550 ads; 4,337,068 bytes |
| Latest 50 with a separate validated application URL | 41 |
| Latest 50 containing contact redactions | 20 |
| Suitable private recommendations | 25, all with verified company IDs |
| Recommended ads with conditions to verify | 3 |
| Reviewed financial observations | 0 |
| Public compliance release | Unavailable: human review pending |

All 600 original payload hashes were reconciled. Of their projected descriptions, 403 exactly equal the original text; 197 differ only through permitted contact redactions. The latest published text packages were compared with that reconciled projection. No synthetic production advertisements or enrichment values were introduced.

The private ranking report records input, engine, profile configuration and source-CV hashes, as-of time and per-ad evidence. It stays private. Public documentation contains aggregate counts only. The measured 25 recommendations are intentionally not described as the 50 newest jobs.

## Validation receipts

| Check | Result / local receipt |
| --- | --- |
| Complete Python platform suite | 662 passed, 2 skipped; `tmp/job-intelligence-modules-python.log` |
| Complete frontend unit suite | 129 passed; `tmp/job-intelligence-modules-unit.log` |
| Complete Playwright suite | 173 passed, 2 skipped; `tmp/job-intelligence-modules-browser.log` |
| Production CSP/security suite | 3 passed after module split; `tmp/job-intelligence-modules-security.log` |
| TypeScript, production build, company/compliance publication checks | Passed; `tmp/job-intelligence-final-types.log` and `tmp/job-intelligence-modules-security.log` |
| Original-text/hash and frozen-cohort reconciliation | Passed; `tmp/job-intelligence-source-reconciliation-final.log` and `tmp/job-intelligence-final-integrity.log` |
| Real private browser smoke | 25 ads, nine company sections, full text, 270px selector, no render errors |
| Private profile fingerprint in production output | Absent |

Tests cover latest-50 ordering, timezone/ties, filtering and stable URL selection, browser history, expiry, text fidelity, contact boundaries, active-content removal, unsafe URLs, exact evidence quotes, deterministic ranking, senior hard requirements, degree alternatives, unknown experience, private-access failures, production privacy, canonical company scopes, related jobs, missing enrichment and legal withdrawal/expiry.

Earlier full-suite attempts exposed disk exhaustion and transient Windows staging locks. Completed test artifacts were compressed without deleting evidence; bounded lock retries were regression-tested. A simultaneous browser/security run also collided in Playwright's shared artifact directory; the final full browser run uses a separate output directory. Test assertions and publication safeguards were retained.

Repository-required Idea Lineage extraction was attempted. It failed while reading the existing journal with `KeyError: created_at` in `platform/idea_lineage/store.py`, before writing new entries. The labelled decision summary and failure receipt remain in `tmp/job-intelligence-lineage.txt` and `tmp/job-intelligence-final-lineage.log`. Repairing that unrelated journal remains outside this task.

## Exact task file inventory

The workspace already contained unrelated changes from earlier work. The list below identifies files created or extended for this Job Intelligence task; it is not the entire repository's dirty status.

Configuration and documentation:

```text
.env.example
README.md
CONTINUITY.md
configs/delivery/jobs.json
configs/delivery/jobs-analysis.json
configs/delivery/schemas/job-workspace.json
docs/job-intelligence.md
docs/job-intelligence-report.md
docs/compliance-intelligence/README.md
```

Frontend integration and public data:

```text
frontend/vite.config.ts
frontend/jobProfilePlugin.ts
frontend/src/App.tsx
frontend/src/projects/projectRegistry.ts
frontend/src/projects/topics.ts
frontend/src/site/Header.tsx
frontend/src/jobb/JobsReport.tsx
frontend/src/compliance/ComplianceExplorer.tsx
frontend/src/companies/CompanyIntelligence.tsx
frontend/src/companies/CompanyDeepDive.tsx
frontend/src/companies/CompanyEvidence.tsx
frontend/src/companies/CompanyJobCard.tsx
frontend/src/companies/CompanyCompliance.tsx
frontend/src/companies/model.ts
frontend/src/companies/companies.css
frontend/src/job-intelligence/JobIntelligence.tsx
frontend/src/job-intelligence/JobResearch.tsx
frontend/src/job-intelligence/JobFilters.tsx
frontend/src/job-intelligence/Requirements.tsx
frontend/src/job-intelligence/CvMatch.tsx
frontend/src/job-intelligence/useWorkspace.ts
frontend/src/job-intelligence/model.ts
frontend/src/job-intelligence/profile.ts
frontend/src/job-intelligence/ranking.ts
frontend/src/job-intelligence/workspace.css
frontend/public/data/jobs/company-intelligence.json
frontend/public/data/jobs/workspace.json
frontend/public/data/jobs/workspace-remaining.json
```

Pipeline and executable checks:

```text
platform/publish/job_companies.py
platform/publish/job_content.py
platform/compliance_intelligence/explorer.py
platform/compliance_intelligence/sources.py
scripts/check_job_companies.mjs
scripts/check_compliance_release.mjs
scripts/rank_local_jobs.mjs
```

Tests:

```text
platform/tests/compliance_intelligence/test_job_content.py
frontend/tests/job-intelligence.spec.ts
frontend/tests/job-profile-access.spec.ts
frontend/tests/fixtures/job-intelligence.ts
frontend/tests/fixtures/job-profile.ts
frontend/tests/unit/job-intelligence.test.ts
frontend/tests/unit/job-ranking.test.ts
frontend/tests/companies.spec.ts
frontend/tests/companies.policy.ts
frontend/tests/routes.spec.ts
```

Re-run the verification commands from the repository root. Browser and production-security commands run sequentially, or must use separate result directories:

```powershell
npm.cmd run check
npm.cmd run format:check
npm.cmd run test:unit
# Use a new, workspace-local temporary root for Python on this Windows checkout.
$jobTempDir = Join-Path (Get-Location) 'tmp/next-python-system-temp'
New-Item -ItemType Directory -Path $jobTempDir -Force | Out-Null
$env:TEMP = $jobTempDir
$env:TMP = $jobTempDir
python -m pytest platform/tests -q --basetemp tmp/next-python-results
npm.cmd run test:e2e -- --workers 4 --output tmp/next-browser-results
npm.cmd run test:security
```

`test:security` includes the production build, TypeScript and existing compliance/company publication checks. Keep temporary names unique if preserving earlier receipts.

Raw source collections, resolution snapshots, the local qualification file and private ranking/browser receipts remain ignored research artifacts. Homepage animation files and unrelated project designs were not edited by this task. No dependency installation or new framework was needed.

## Remaining work and deployment readiness

Missing sources remain explicitly unavailable: reviewed financial statements and ratios, historical exact workforce observations, procurement/client evidence, verified repository ownership, corporate-event evidence and verified securities/price history. Current SCB workforce intervals are not historical exact counts. Observed job postings are not confirmed hires. Long-run hiring charts require a consistent historical dataset.

CV upload/parsing and a production access-controlled applicant experience are not implemented. The local qualification JSON is replaceable and configurable. Relevance needs independent evaluation against a labelled representative job sample before treating its weights as calibrated. Nuanced degree equivalence and indirect language remain limitations.

Public job delivery is implemented and validated locally. Before an authorised deployment, refresh the source window, publish/activate the complete jobs R2 release, then release the frontend. Keep local personalisation disabled in production. Existing legal publication stays unavailable until human review and independent approval of the exact new presentation. KKV restrictions and dependent ranking holds remain unchanged.

Exact PowerShell commands for generic/private use, fresh official ingestion and private reproducible ranking are in [Run locally](job-intelligence.md#run-locally). The next engineering phase should prioritise reviewed financial/workforce source ingestion and an independently evaluated relevance test set.
