<!-- Generated from the Idea Lineage journal. Do not edit; run npm run ideas:build. -->

# Jobs

## Current direction
Raw job-ad answers are LOCAL_ONLY, and push refuses to overwrite keys changed in the bucket

## Active decisions
- Withdraw the observatories from the site — 2026-10-21, `decision-2026-11-03-003`
  Politics, the labour market, Job Intelligence, wellbeing, the AI Act and the statute book are off the site. Every old address and /companies/* redirects to #what-does-it-even-mean. frontend/src/{compliance,companies,job-intelligence} stay unrouted because compliance:check and jobs:check read them.
- The job assistant is the second flagship, refreshed hourly with an 8 h SLA — 2026-11-01, `decision-2026-11-03-017`
  Subject job_assistant in pipeline.yml. Live owner functions wait on the D1 token permission.
- Keep the hourly GitHub refresh as the production scheduler until an always-on Airflow host exists — 2026-11-02, `decision-2026-11-03-018`
  Then set JOB_ADS_SCHEDULER=airflow and JOB_ADS_PUBLISH=r2. A host budget is not approved.
- Raw job-ad answers are LOCAL_ONLY, and push refuses to overwrite keys changed in the bucket — 2026-11-02, `decision-2026-11-03-019`

## Latest findings
- Raw JobStream and JobSearch answers with recruiters' contact details had been pushed to the public bucket — 2026-11-02, `finding-2026-11-03-007`
  warehouse/raw/job_assistant/raw/ and warehouse/raw/jobtech/stream/raw/. The stored objects await the owner's deletion (docs/storage-and-serving.md).

## Open questions
None recorded.
