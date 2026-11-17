<!-- Generated from the Idea Lineage journal. Do not edit; run npm run ideas:build. -->

# Jobs

## Current direction
Airflow-målet stängs utan värd dygnet runt; förslaget med kostnad räcker.

## Active decisions
- Withdraw the observatories from the site — 2026-10-21, `decision-2026-11-03-003`
  Politics, the labour market, Job Intelligence, wellbeing, the AI Act and the statute book are off the site. Every old address and /companies/* redirects to #what-does-it-even-mean. frontend/src/{compliance,companies,job-intelligence} stay unrouted because compliance:check and jobs:check read them.
- The job assistant is the second flagship, refreshed hourly with an 8 h SLA — 2026-11-01, `decision-2026-11-03-017`
  Subject job_assistant in pipeline.yml. Live owner functions wait on the D1 token permission.
- Keep the hourly GitHub refresh as the production scheduler until an always-on Airflow host exists — 2026-11-02, `decision-2026-11-03-018`
  Then set JOB_ADS_SCHEDULER=airflow and JOB_ADS_PUBLISH=r2. A host budget is not approved.
- Raw job-ad answers are LOCAL_ONLY, and push refuses to overwrite keys changed in the bucket — 2026-11-02, `decision-2026-11-03-019`
- Airflow-målet stängs utan värd dygnet runt; förslaget med kostnad räcker. — 2026-11-14, `decision-2026-11-14-006`

## Latest findings
- Raw JobStream and JobSearch answers with recruiters' contact details had been pushed to the public bucket — 2026-11-02, `finding-2026-11-03-007`
  warehouse/raw/job_assistant/raw/ and warehouse/raw/jobtech/stream/raw/. The stored objects await the owner's deletion (docs/storage-and-serving.md).
- Klustermodellens CPU-cache (`warehouse/ml/jobs`) ligger inte i R2. — 2026-11-08, `finding-2026-11-08-002`
  Klustermodellens CPU-cache (`warehouse/ml/jobs`) ligger inte i R2. Varje fönster lägger därför 606–631 s på att embedda om cirka 2435 texter vid starten. Det kostar inget, och på en värd som alltid är på ligger cachen kvar på disk.
- #259 är live — 2026-11-08, `finding-2026-11-08-003`
  #259 är live: sidan visar 100 körningar, 0 misslyckade steg, 36 ändringar, 30 s per körning och 1188 neurons för senaste dygnet.
- Sajten läser jobs/* från incheckade kopior; bara job-assistant/ och schema/ läses live från R2, så nya releasefiler syntes inte förrän de… — 2026-11-14, `finding-2026-11-14-005`
- Marknadsvyn visar arkivdata live efter #269; veckokortet och tid-till-stängning väntar på nästa jobs-release respektive… — 2026-11-14, `finding-2026-11-14-006`

## Open questions
- Får `ml/jobs` migreras till `ml/experiments`, trots att det ändrar live-tilldelningarna? — 2026-11-11, `question-2026-11-11-001`
- Ska #269 mergas så att marknadsvyns arkivkort visas live? — 2026-11-14, `question-2026-11-14-005`
