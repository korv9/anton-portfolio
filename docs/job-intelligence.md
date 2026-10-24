# Job Intelligence

Job Intelligence was withdrawn from the site on 2026-10-21 (35b90a67). Its source in `frontend/src/{job-intelligence,companies,compliance}` stays unrouted because the compliance release hash and the build checks read it; `#jobb-it` and `/companies/<id>` now redirect to `#what-does-it-even-mean`. The data refresh still runs every morning in the `market` subject. The retained workspace was a continuous job research view at `#jobb-it?job=JOB_ID`. The reader selects an advertisement once and reads its full wording, requirements, CV explanation and company evidence in one pane. Desktop uses a 22% list capped at 270px; both panes scroll independently. Mobile puts a searchable selector above the same continuous content. Company sections have no reveal buttons or tabs.

## Modes and user journeys

The release publishes the latest 50 unexpired advertisements in the observed JobSearch window, generic requirements and verified company context. No applicant profile or personalised recommendations are published.

Local personalisation is opt-in. A qualification-only profile in ignored `.research/` supplies documented CV facts. Location preferences, target-role weights, factor weights and the recommendation threshold are separate configuration. The browser ranks the complete fresh candidate set and displays up to 50 relevant jobs, best match first. Newest-first sorting remains available within these recommendations. Fewer than 50 qualifying ads is an explicit state.

Selected advertisements survive filters and browser history. A shared link on the public site opens the same advertisement with generic analysis. `/companies/:companyId` and `#compliance*` redirect to `#what-does-it-even-mean`; the Labour Market Observatory is withdrawn too.

## Repository audit and reuse

| Existing capability | Reuse / extension |
| --- | --- |
| `platform/ingest/jobtech/ingest_jobs.py`, `weekly_jobs.py` | Official JobSearch, bounded pagination, retry, window splitting and immutable `raw.job_ads` payload hashes |
| `platform/publish/job_companies.py` | Current job metadata, canonical links, privacy projection, SCB lookup and reviewed context; now also publishes text packages |
| `platform/compliance_intelligence/job_resolution.py`, `job_links.sql` | Exact organisation numbers, verified aliases, role-specific links, ambiguity and human review; unchanged identity namespace |
| SCB registry and frozen cohort | Job employers reuse canonical `company_id`; the frozen 50-company compliance cohort is unchanged |
| `frontend/src/companies/` | Shared data loader, identity, related jobs, source links and legal release checks; continuous company presentation |
| Compliance review, Gold, Explorer and exports | Reused intact. Added presentation files to the exact-artifact approval fingerprint |
| Historical Labour Market Observatory | Archive/stream models retained; pages withdrawn |
| `frontend/src/dataSource.ts`, delivery specs and R2 publishing | Integrity-checked, pinned releases; no new backend or company database |
| `tokens.css`, shared charts and native controls | Grey surfaces, Helvetica, muted violet, accessible chart labels and focus states; no new theme |

There was no CV matching engine. This implementation adds bounded deterministic matching; it does not claim to implement an employer ATS. Financial statements, historical workforce data, contracts, verified repository ownership, corporate events and issuer/price histories are not assumed to exist.

## Storage and delivery

`JobSearch → immutable raw.job_ads → existing company resolution → public metadata + text packages → pinned jobs R2 release → React`.

The canonical join remains `job_id → job_company_link → company_id`. Automatic resolution means advertised employer, with separate evidence required for recruiter and actual-employer roles. Names, brands, parents, subsidiaries and securities issuers are never substituted for one another.

When multiple legal entities have independently verified roles in one advertisement, their company sections render separately in the same pane, with a documented actual employer first. Evidence and legal records stay scoped to each canonical ID. An unverified advertiser remains explicitly withheld.

All three job JSON files share `generated_at`, `valid_until` and `registry_hash`. Fulltext entries additionally bind to the exact advertisement `document_hash`. The publisher validates the entire batch before replacing local public files. The existing R2 release system activates the complete version together. Both text files belong exclusively to the jobs group; jobs-analysis excludes them.

### Public data contracts

| File / entity | Grain and fields |
| --- | --- |
| `jobs/company-intelligence.json` | Existing schema v1: jobs, verified/unresolved links, companies, relationships, reviewed context, source coverage and reconciling metrics |
| Job metadata extensions | Optional `normalized_skills[]`, `seniority[]` (mentions), `remote_evidence[]`; original employer, workplace, location, timestamps, source URL and payload hash retained |
| `jobs/workspace.json` | Latest 50 at publication: schema v1, state, observation/expiry, registry hash, selection rule and `jobs[]` |
| `jobs/workspace-remaining.json` | Disjoint remainder of the observed active population; loaded only for older selected jobs or opt-in local ranking |
| Fulltext record | `job_id`, `document_hash`, `source_url`, `description_text`, `text_origin`, `contact_redactions`, safe `application_url` or null, employment type, working hours, duration, salary, salary type, remote wording, analysis |
| Analysis | Version, limitations and requirements with `label`, `category`, `strength` (`required`, `preferred`, `ambiguous`), `source_field`, line and exact quote |

Primary text is about 380 KB and the remainder about 4.3 MB for the measured batch. Metadata and canonical company summaries are fetched once. Switching jobs belonging to the same entity reuses loaded company data. Full source text is rendered as React text with an empty HTML allowlist; it is never passed to `dangerouslySetInnerHTML`. Formatted-only source text is converted to text. Original wording and whitespace remain except disclosed email, phone and known contact-name redactions. Dedicated contact fields are excluded. Original raw payloads stay private.

JobSearch is listed as CC0 in the [official data-service catalogue](https://data.jobtechdev.se/dataservice). This does not remove privacy obligations. Expiry/removal signals are applied when collecting/projecting, deadlines are checked again in the browser, and releases expire after at most two days. Withdrawals between refreshes remain a live-source limitation. Source timestamps without offsets use the documented Stockholm client interpretation; original timestamps remain available.

### Private qualification contract

`SearchProfile` schema v1 is defined and validated in `frontend/src/job-intelligence/profile.ts`:

- `source`: `kind=candidate_supplied_cv`, SHA-256 of the reference CV.
- `facts.skills[]`: canonical skill, `evidenced` or `partial`, source reference and exact qualification excerpt.
- `facts.experience[]`: internship/project kind, label, evidenced skills, source reference and excerpt.
- `facts.professional_years`: documented number or null. Internships/projects never become invented full-time years.
- `facts.education`: documented level, credits, completion date, reference and excerpt.
- `preferences`: ordered locations, remote preference, target-role weights, six factor weights and minimum score.

Unexpected fields and email/phone patterns are rejected. The initial local profile was checked against the supplied CV and excludes contact details. There is no new CV upload, applicant database, external model call or public recommendation export. The portfolio's pre-existing CV download remains outside this feature.

### Local API and ranking result

`GET /__local/job-intelligence-profile` exists only in Vite development. It requires an explicit `JOB_INTELLIGENCE_PRIVATE_PROFILE`, loopback connection and host, same origin, GET method and a real JSON path under `.research/`. Responses are private/no-store. Remote and cross-origin requests receive 403; disabled configuration receives 404; invalid configuration receives 422 without logging its contents. Vite denies direct filesystem access to `.research/`, environment files and private lineage files. Production and preview do not install this endpoint; production JavaScript does not request it.

`Relevance` v1 contains `job_id`, bounded score, suitability, potential blockers with advertisement quotes, each explicit requirement's evidence state, six factor values/weights/explanations, matched role and version. Browser calculation is in memory. The private CLI adds source file hashes, profile configuration hash, engine hash, as-of time, original advertisement hashes/URLs/timestamps and verified canonical company IDs. Its output is restricted to `.research/`.

## Relevance methodology

The estimate is `round(100 × Σ(weight × factor) / Σ(assessed weights))`. It is a reproducible research heuristic, not a calibrated hiring probability. Missing assessed factors are excluded from the denominator. An entirely unassessed configured weighting returns zero and no recommendation.

| Factor | Initial weight | Rule |
| --- | --- | --- |
| Required skill evidence | .35 | Unique explicit required skills: evidenced = 1, partial = .5, not evidenced = 0 |
| Preferred skill evidence | .10 | Same calculation for preferred skills |
| Role | .20 | Configured target-role title compatibility; indirect body-only signal is insufficient for recommendation |
| Experience / seniority | .15 | Explicit junior signal = 1; unspecified seniority = .75; senior title = .15; conflicting stated experience lowers it further |
| Location | .15 | First preferred location = 1; configured nearby location = .85; supported remote/hybrid mention = .8; outside preference = .35; unspecified = .5 |
| Education | .05 | Source requirements compared with documented qualification; equivalent-experience alternatives remain uncertain, not automatically satisfied |

Required skills not evidenced by the CV, citizenship/security/language conditions, degree equivalence and stated professional years appear separately as conditions to verify. They do not prove the person lacks the competence. Required experience of three or more years not established by the CV, substantial required management experience and specific incompatible degree requirements cap the estimate at 39 and exclude automatic recommendation. Senior/lead/staff/principal titles and DBA/infrastructure-only roles cap it at 49. A role without "junior" is eligible; unspecified working arrangements do not exclude it. Explicit alternative qualifications and 0–2-year ranges are handled separately.

Recommendation requires direct configured role compatibility of at least .5, the configured score threshold (initially 50) and no blocking experience/degree condition. Sorting uses suitability, absence/presence of potential hard-condition uncertainty, score descending, then stable job ID. Consequently required-condition evidence takes precedence over a small weighted-score difference. Preferred-role weights and locations are editable locally. Unknown and inferred advertisement mentions never become explicit requirements.

The vocabulary and sentence rules are bounded. Number words, ranges and negations have tests, but indirect wording, equivalent degrees and nuanced seniority still require reading the original advertisement. The model does not infer a company's ethics, legal risk or hiring decision.

## Current data and missing sources

The measured official collection was observed 2026-10-17T21:53:55Z: 601 active Data/IT source records, 600 Swedish eligible ads after excluding an explicitly Swiss workplace, 246 verified company profiles, 590 verified advertised-entity links, one ambiguous and nine unresolved links. One advertisement subsequently reached its deadline, leaving 599 current candidates at the local check. The latest 50 have readable source text; 41 have a separate validated HTTPS application URL, with original advertisement links for the others. Twenty contain disclosed contact redactions. These counts describe this snapshot and are not a permanent benchmark.

The local run selected 25 suitable advertisements from those 599, all with verified advertised-entity links. Three carry explicit conditions requiring further verification. This is intentionally fewer than 50. Named recommendations and qualification evidence remain in the private report, not in public datasets.

Missing reviewed enrichment: company financial history/ratios, exact historical employee counts, long hiring history, procurement/client evidence, verified repository ownership, corporate events and stock/issuer series. Existing context rows can render automatically when approved and directly attributed; five-year financial and workforce charts need real compatible observations first. Current hiring counts by publication day are shown where multiple days support comparison. They are observed postings, not confirmed hires or causal evidence.

`new_output` in `platform/compliance_intelligence/sources.py` retries only bounded Windows access and sharing locks (WinError 5 and 32) while it finalises a staged directory; it never replaces existing output.

Compliance remains independently gated. The current public release is unavailable pending human review. No unapproved named findings are published; missing coverage is never shown as zero violations. KKV coverage limitations and ranking holds remain. The frozen SCB compliance cohort is unchanged and independent of both the job population and private recommendations.

## Run locally

From the repository root in PowerShell, using the existing installed dependencies:

```powershell
$env:VITE_DELIVERY_MODE = 'local'
Remove-Item Env:JOB_INTELLIGENCE_PRIVATE_PROFILE -ErrorAction SilentlyContinue
npm.cmd run dev
# #jobb-it redirects while the workspace is unrouted, even in dev; add a route first.
```

Stop that server, then enable the prepared ignored qualification profile:

```powershell
$env:VITE_DELIVERY_MODE = 'local'
$env:JOB_INTELLIGENCE_PRIVATE_PROFILE = '.research/job-intelligence/profile.json'
npm.cmd run dev
# Same: #jobb-it redirects until a route is added.
```

Edit that private JSON to change preferences or replace documented qualifications, then reload. Keep the source references/excerpts and actual CV hash; do not add contact fields. Unset the variable to disable personalisation. The profile is intentionally not committed, so another checkout must create its own validated qualification file. CV parsing/upload UI and a production access-controlled applicant service are not implemented.

Reproduce a private selection into a new filename:

```powershell
node --experimental-strip-types scripts/rank_local_jobs.mjs --profile .research/job-intelligence/profile.json --output .research/job-intelligence/next-ranking.json
# Optional: --as-of ISO_UTC_TIME within the still-fresh source observation period.
```

Refresh the existing official job pipeline, optionally using its existing SCB key or registry fallback:

```powershell
python platform/publish/job_companies.py refresh --output .research/NEXT_UNIQUE_JOB_RUN --days 7 --publish
```

Here `--publish` writes local public JSON only. It does not deploy or send data to R2. Use unique output directories and never place private profiles/reviews in `frontend/public/`.

## Deployment and validation

No deployment is automatic. Publish the complete validated jobs R2 group (market, company metadata and both text packages), preserving exclusive group ownership, before a frontend release expects these files. Use existing Workers/static assets and delivery activation. Keep `SCB_API_KEY` backend-only. Deploy public generic behaviour; local personalisation requires a separate authorised access-controlled design before any production use. Any change to the company/workspace presentation requires a new exact-artifact compliance publication approval.
