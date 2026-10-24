# Job assistant

The job assistant is the owner's own job search tool, and it is public. It starts from the CV
and treats job ads as the candidates under review. A recruiter can see which roles the owner is
looking for and how the documented experience compares with what ads ask for.

The match is decision support. It is not an estimate of the chance of being hired, and it never
gives a percentage. Every judgement points at the sentence in the ad and the line in the CV it
rests on.

## Architecture

The job assistant is built on the same platform as the rest of the site, so it can be traced the
same way: raw files with provenance, dbt layers with tests, versioned delivery to R2.

| Layer | What | Where |
| --- | --- | --- |
| Source | JobTech JobSearch (first run) and JobStream (every hour), CC0; the owner's CV | `platform/job_assistant/ads.py`, `cv.py` |
| Raw | Every answer as served with its provenance line; the ad store, match store and run log | `warehouse/raw/job_assistant/` |
| Matching | Rules, bge-m3 vectors and checked explanations, run before dbt | `rank.py`, `match.py`, `ai.py` |
| Bronze | Typed views of the stores: ads, ad events, matches, profile, runs | `platform/models/bronze/job_assistant/` |
| Silver | Judgements, quotes and conditions unpacked to one row each | `platform/models/silver/job_assistant/` |
| Gold | Nine tables with enforced contracts | `platform/models/gold/job_assistant/` |
| Delivery | `job-assistant/{ads,matches,texts,demand}.json`, checked, then released as the group `job-assistant` | `export.py`, `configs/delivery/job-assistant.json` |
| Owner records | Profile drafts and versions, statuses, notes, labels | Worker and D1 (storage pull request) |

The subject `job_assistant` in `platform/pipeline.yml` runs these steps in order every hour from
`.github/workflows/refresh-job-assistant.yml`. The export runs only when every dbt test passed.

## Flow

1. The owner uploads a CV as PDF or DOCX. The Worker stores the file in D1, readable only with
   the owner token, and the next hourly run (or a manual run) reads it with `platform/job_assistant/cv.py` into a draft profile.
2. The owner reads the draft, corrects it and adds wishes (places, remote work, prioritised
   roles, interests). `cv_profile.py` checks each correction, and approval freezes the draft as
   the next numbered version.
3. Every hour a GitHub Actions run reads JobTech's JobStream for the Data/IT occupation field
   and stores new, changed and removed ads.
4. Each new or changed ad is compared with the latest approved profile on tasks, technique,
   seniority and wishes.
5. Ads in the two upper match classes go to the review list. The owner reads the full ad there
   and sets a status.

## Evidence model

A CV fact has one of four levels. They are never merged into one number.

| Level | Where it comes from | Example |
| --- | --- | --- |
| `practical` | A line inside an employment or internship (LIA) entry | "Built a Python and PySpark pipeline …" under Fora AB |
| `education_or_project` | A line in an education entry or a project, including the thesis | Microsoft Fabric in the DiVA lakehouse project |
| `listed` | Named only in the skills list or the summary, with no line that says where it was used | Azure DevOps |
| `interest` | An owner wish with no documented experience; never read from the CV | a skill the owner wants to learn |

Each skill keeps every CV line that names it, with the entry it sits in. Its level is the
strongest of those lines. The level of a line follows from the CV section it sits in, and
`cv_profile.py` checks both: a row's ref must name a section whose text contains the quote, and its
level must be that section's level. A skills-list line therefore stays `listed` even when it is
paired with a real experience sentence. A correction may move, rename or delete facts. It cannot add a fact at
a level above `interest` unless the quote is found in the CV text, so the profile never states
experience the CV lacks. `professional_years` stays empty until the owner enters a documented
number; internships are not turned into years of employment.

Formal education requirements in ads are shown in their own row and never lower the match
class. Language, citizenship and security clearance conditions are listed the same way, as
conditions to check.

## Data model

Everything except the uploaded CV files and the owner's statuses, notes and labels is public. The pipeline's files sit under
`warehouse/raw/job_assistant/` and the released group `job-assistant` in the public R2 bucket. The
owner's own records sit in a D1 database behind the Worker. Uploaded CV files (drafts and older
versions included) never go to R2: they stay in D1 and only the owner token reads them. The
approved profile and the draft, with their CV quotes, are public by the owner's choice.

| Record | Store | Grain and main fields |
| --- | --- | --- |
| CV file | D1 `cv`, owner-only | One file per uploaded version: name, media type, size and the file itself; never published |
| Draft profile | D1 `profile_draft` | One row: profile JSON (schema v1 in `cv_profile.py`), CV hash, updated time |
| Approved profile | D1 `profile_version` | One row per version: version, profile JSON, `profile_sha256`, CV hash, approved time |
| Ad store | R2 `warehouse/raw/job_assistant/ads.json` | One row per JobTech ad id: headline, employer, place, full public text, source and application links, published, last changed, first seen, removed time, content hash, duplicate group, and its history of new, changed and removed events |
| Ad list | gold `mart_job_assistant_ads`; `job-assistant/ads.json` | Current ads and those removed in the last 30 days, without the text, with an `expired` flag (the deadline, a Stockholm local timestamp, has passed) |
| Ad events | bronze `stg_job_assistant_ad_events` | One row per new, changed or removed event of an ad |
| Match store | R2 `warehouse/raw/job_assistant/matches.json` | One row per current ad: role category, match class, reasons, skill judgements, gaps, conditions, similarity, explanation (optional), `profile_version`, CV hash, engine version, the ad's content hash |
| Match | gold `mart_job_assistant_matches`; `job-assistant/matches.json` | One row per matched ad that is neither removed nor expired, in rank order: class, role, reasons, gaps, similarity, checked explanation, profile version and CV hash, and whether it is detailed (strong, possible, stretch or in the 30-ad evaluation sample) |
| Judgement and evidence | gold `mart_job_assistant_judgements`, `mart_job_assistant_evidence` | One row per detailed ad and skill (strength, CV level), and one per quote behind it, from the ad or the CV |
| Condition | gold `mart_job_assistant_checks` | Education and conditions a detailed ad states, with the sentence |
| Ad text | gold `mart_job_assistant_texts`; `job-assistant/texts.json` | The full public text of exactly the detailed ads |
| Skill demand | gold `mart_job_assistant_skill_demand`; `job-assistant/demand.json` | Per skill: matched ads that require, prefer or name it, and the CV's level for it |
| Profile used | gold `mart_job_assistant_profile` | The profile version, CV hash and the last run's Workers AI use |
| Review status | D1 `review` | One row per ad: status, note, updated time |
| Relevance label | D1 `label` | One row per labelled ad: relevant, maybe or not relevant, note, the class shown when labelled |
| Run record | raw `runs.jsonl`; gold `mart_job_assistant_runs_daily` | One row per hourly run, and per UTC day: runs, failures, new, changed and removed ads |

Statuses are `new`, `review`, `interesting` (shown as Saved), `pass`, `applied`, `interview`,
`offer`, `rejected` and `closed`. Saved, applied, interview, offer and rejected form the
application pipeline. An ad without a review row is `new`. An ad that JobTech removes is shown as closed, but a status the owner set,
such as `applied`, is kept and shown next to it.

A requirement judgement holds the ad's requirement (label, required or preferred, the exact
sentence and its line) and the CV side (the level and the CV quotes, or "not in the CV").

## Ingestion, duplicates and removal

`platform/job_assistant/ads.py` runs every hour in `refresh-job-assistant.yml`, as the
`job_assistant` subject of `platform/pipeline.yml`. The first run reads every current Data/IT ad
from JobSearch, one publication day at a time over the last 60 days, with the client in
`platform/ingest/jobtech/ingest_jobs.py`. An ad published earlier that is still open is missed
until it changes and the stream brings it in; most Platsbanken ads close within that time. JobStream's snapshot is not used: it ignores the
occupation filter and returns about 40,000 ads. Later runs ask JobStream for every change since
the stored cursor, in windows of at most six hours, as `ingest_stream.py` does. Each answer is
stored with its provenance line (`platform/lib/rawstore.py`) under its own source,
`job_assistant`, so its fetch log never mixes with the market subject's. The text projection and
contact redaction come from `platform/publish/job_content.py`.

- The key is the JobTech ad id. A changed ad replaces its row when its content hash differs, and
  the old version is noted in the row's history. An unchanged repeat does nothing.
- Ads with the same employer, title and text hash under different ids form one duplicate group;
  the list shows the group once.
- A `removed` record sets the removed time. So does a change that moves the ad out of the Data/IT
  occupation field (history event `left_field`). The row stays so the owner's status and labels
  still have something to point at. An ad that comes back after removal is reopened.
- A passed application deadline sets `expired` in the list. JobTech gives the deadline as a
  Stockholm local timestamp, usually 23:59:59, and the ad expires when that moment has passed.
  `rank.py` does not match an expired ad, and the match mart drops matches of ads that were
  removed or expired after the last match run.
- The store is written atomically before the cursor moves. A run that stops halfway asks for the
  same window again, and the id plus hash rule makes that harmless.

## Matching

Matching is rules first. `platform/job_assistant/skills.py` holds one vocabulary for CVs and
ads: the requirement taxonomy from `job_content.py` plus a few CV terms.

| Aspect | Rule |
| --- | --- |
| Role category | Title patterns for Data Engineering, Analytics Engineering, Python Backend, Applied AI, BI, Frontend, Full stack, Data Analysis and ML Engineering; a body-only signal is marked as uncertain |
| Technique | Each required and preferred skill sentence against the profile level of that skill |
| Seniority | Senior, lead and principal titles and stated years of experience, with the experience wording that lifted the senior/junior AUC by 0.15 in the feature study (`ml/feature_study/job_ads.py`, branch `korv9/ml-feature-engineering`) |
| Wishes | Place, remote wording and the owner's role order |

`platform/job_assistant/match.py` sets one of four classes. "Practical" means the profile has the
skill at `practical`; "shown" adds `education_or_project`. Only practical skills can make an ad
strong or possible; skills shown only in projects or education are counted and reported apart. The
shares count required skills, or every named skill when the ad marks none as required.

| Class | Rule |
| --- | --- |
| `strong` | A wished role read from the title, in a wished place, not senior; at least three skills named and at least 60 % practical |
| `possible` | A wished role in a wished place, not senior, at least one skill named and at least 30 % practical; or a strong case whose role is only in the ad text or that names fewer than three skills |
| `stretch` | A wished role in a wished place with at least 30 % shown (or no skill named), but a senior, lead or architect title, three or more years of experience asked, or under 30 % practical |
| `outside` | Another role, another place without remote wording, or under 30 % shown |

Hybrid work counts as work at the ad's own office, so only remote wording widens the place. Each
match lists its reasons in plain words, for example "data engineering (from the title); 3 of 8
named skills shown in practical work; 2 more only in projects or education; Stockholm". `strong` and `possible` make the
review list. Within a class, ads are sorted by the owner's role order, then by the bge-m3 cosine
between the ad and the profile, then newest first. A match is redone only when the ad's content
hash, the profile version or the engine version changes.

On the 2,233 current, non-duplicate ads of the local run, with Stockholm and Solna as places and
nine wished roles, the earlier rules (which counted project skills toward strong and possible)
gave 15 strong, 93 possible, 115 stretch and 2,010 outside. The current rules (`job-match-v2`),
on 2,239 current, unexpired ads of a later local store, give 4 strong, 35 possible, 186 stretch and
2,014 outside: the test profile shows SQL and dbt only in projects and education. Most
outside ads are support, Java or other roles outside the wishes. These counts come from one test
profile; the owner's labels measure whether the rules are right.

## Workers AI budget

The project stays on the free tier at 0 kr. The free day is 10,000 neurons, shared with other
experiments. `platform/job_assistant/ai.py` uses the REST call and ledger of
`platform/nlp/workers_ai.py` (`spent_today`, `append_ledger`) with the agent name `job-assistant`
and its own ledger, `warehouse/raw/job_assistant/ledger.jsonl`, so the project cap of 1,500
neurons per UTC day counts only this project. The Cloudflare quota error (4006) stops the AI part
of a run the same way.

| Use | Model | Estimate |
| --- | --- | --- |
| Embeddings of all new and changed ads | `@cf/baai/bge-m3`, 1,075 neurons per million tokens | about 200 ads a day at 500 tokens (headline and the first 1,500 characters), roughly 110 neurons; the first 2,200 ads take about a day of the cap |
| Explanations for the top new candidates | `@cf/google/gemma-4-26b-a4b-it` | 30 to 80 neurons each; at most 12 a day |

Vectors are cached per text hash in `warehouse/raw/job_assistant/vectors.sqlite`, so an ad is
embedded once per text. When the project cap or the account quota is reached, or a call fails
with a server or connection error (`stopped: "error"` in the run note), rules and cached embeddings
still rank every ad, and the missing vectors and explanations wait for a later run. An explanation
is kept only if every sentence in it quotes the ad or the CV lines and every quote is found there;
otherwise it is marked unverified and not shown. Checked or not, each explanation counts toward the
12 a day. The Workers AI token reaches only the `rank.py` step (the `secrets` step option in
`platform/pipeline.yml`). The owner token reaches only `sync.py`, which runs in its own workflow
step of `data-subject.yml` before the build. A failed `rank.py` does not stop
the run: dbt keeps the last matches and the ad list is still published. The hourly run gets the
token through the `workers-ai` input of `data-subject.yml`; without it the run uses rules and
cached vectors only.

## Security of writes

Reads are public, except the CV files, the unapproved draft and the owner's statuses, notes and
labels, which sit next to named employers. Every write route, both CV routes
and the draft require a Worker secret, `JOB_ASSIST_TOKEN`, sent as a bearer token: status, note, label, profile draft, profile
version, CV upload, the list of uploads and the files, which are served with `no-store`. The routes are in
`worker/jobs.ts` under `/api/jobs/`. The Worker compares the token in constant time, as SHA-256
digests, and refuses a write whose `Origin` header names another site. Writes without an `Origin`
come from the Actions run. A missing or wrong token gets 401 and changes nothing. All job routes
use the rate limit of 20 requests a minute per visitor, counted apart for reads and writes so
public reads cannot use up the write budget; without the limiter binding the routes answer 503.
A body whose declared length is over the limit is refused before it is read. Two approvals of the
same version number cannot both be stored: the second gets 409. There is no open write endpoint.

| Route | Read | Write (token) |
| --- | --- | --- |
| `/api/jobs/profile` | latest approved profile, list of versions; the draft only with the token | |
| `/api/jobs/profile/draft` | | `PUT {profile, approval_requested, problems}`; schema v1, status draft, no contact details (e-mail, phone, personnummer, street address) |
| `/api/jobs/profile/versions` | | `POST` the next approved version only (the hourly run) |
| `/api/jobs/cv`, `/api/jobs/cv/<sha256>` | owner only: list of uploads, the file | `POST` a PDF or DOCX up to 1.4 MB, checked by its first bytes; D1 holds at most 2 MB per value and base64 adds a third |
| `/api/jobs/reviews`, `/reviews/<ad id>` | owner only: every status and note | `PUT {status, note}` |
| `/api/jobs/labels`, `/labels/<ad id>` | owner only: every label | `PUT {label, note, shown_class}` |

D1 holds one table, `records(kind, key, value, updated_at)` (`worker/migrations/0001_job_assistant.sql`).
The Worker cannot read a PDF, so it never approves a profile. The owner asks for approval. The next
hourly run (`platform/job_assistant/sync.py`) checks the draft against the text of its own CV file
and stores it as the next version, or writes the problems back to the draft. The same run parses
a newly uploaded CV into a fresh draft and keeps the owner's wishes.

A secret token was chosen over Cloudflare Access because one person writes, Access would need a
Zero Trust application and policy for a few routes, and the token works the same for the browser
and for the Actions run. The owner pastes the token once per device; the page keeps it in
`localStorage` and sends it only to the site's own `/api/jobs/` routes.

## What the owner applies

Nothing here is applied by the agent. In this order:

1. Run the Terraform workflow for `infra/cloudflare` from `main`, which adds
   `cloudflare_d1_database.job_assistant`. The API token needs D1 Edit as well.
2. Copy the output `job_assistant_d1_id` into the commented `[[d1_databases]]` block of
   `wrangler.toml` and uncomment it.
3. Run `npx wrangler d1 migrations apply job-assistant --remote`.
4. Run `npx wrangler secret put JOB_ASSIST_TOKEN` with a long random value. Set the same value as
   the secret `JOB_ASSIST_TOKEN` of the GitHub environment `anton-portfolio`.
5. Set the secret `CLOUDFLARE_AI_TOKEN` (Workers AI Read and Edit only) in the same environment.
6. Upload the CV on the review page, correct the draft, and ask for approval.

Until step 4, `/api/jobs/*` answers 503 and the hourly run fetches ads but matches nothing. The
hourly workflow reaches `main` with the next merge from `loop`.

## Monitoring

The hourly run is a subject in `platform/pipeline.yml` with `sla.fresh_within: 3h`, so the
existing data heartbeat opens an issue when it stops. `runs.jsonl` keeps one row per run, which
is the record for the seven days of scheduled operation after the merge.

## Evaluation

The owner labels at least 50 ads as relevant, maybe or not relevant. Half come from the review
list and half are a random sample of ads outside it, so missed jobs can be found too. The page
reports precision of the list, the share of relevant ads in the outside sample, and each ad whose
class and label disagree. The labels are the owner's and the counts are small, so the numbers
describe this search, not matching in general.

## Review page

`#jobs` (`frontend/src/job-assistant/`) is the work tool and the public page in one. The production
build still shows only the start page, as for every other product, until the owner opens it.

- The header says what the page is. A status line below it gives the ads in the store, the ads
  published today, the strong matches, the applications per pipeline status and the time of the
  last hourly sync. When that sync is more than three hours old, a notice says so.
- Three tabs: Jobs, Applications and How it works. The Applications tab is a read-only board of
  the pipeline, from Saved to Rejected, built from the review rows.
- Jobs: a free-text search over title, employer, occupation and the skills the ad names, and
  filters for match class (strong and possible by default, or one class, or the evaluation
  sample), place or remote, employment type, role, publication date, deadline and seniority. Each
  option shows how many ads it would leave; active filters are chips that remove themselves.
  Sorting is by best match, newest or deadline. Search, filters, sort, tab and the open ad are in
  the address (`#jobs?q=dbt&place=Solna&ad=<id>`), so a link shares the view and the back button
  closes an opened ad. Filtering runs in the browser over the released JSON.
- Result cards show title, employer, place, days since publication, the days left to apply, the
  class, up to four skills the CV shows in work or projects, and up to two it does not. Twenty
  cards are shown at a time, with "Show more". The arrow keys (or `j`/`k`) move between cards and
  Enter opens one; `/` searches and Escape clears it or closes the ad. With the owner token, `1`
  to `5` set the pipeline status: saved, applied, interview, offer, rejected.
- The open ad sits beside the list on wide screens; under 760 px it replaces the list and has a
  back button. It shows the class with the reasons, the checked explanation, and a table of
  requirements: skill, how the ad asks for it, the ad sentence, the CV level and the CV line with
  its CV section. Gaps, education and conditions, uncertainty, a trace of the files, models and
  tests behind the match, the full text, links and dates come after.
- How it works: the method, what the ads ask for against the CV (`demand.json` against the
  approved profile), the label counts, the runs of the last seven days, and the owner's tools
  (token, CV upload, draft editor, approval request).

The home page entry described below is not built in this task: the task brief keeps
`frontend/src/home/` untouched while the owner works there.

## Home page entry (planned)

The owner's decision of 2026-10-23 puts the job assistant high on the home page, right after the
platform section, as the second flagship: the platform's own output. The entry is built with the
review UI and stays small:

- one line on what it is: the CV matched hourly with current Data/IT ads, decision support only;
- the latest three strong or possible matches, each with title, employer, place, class and its
  first reason, read from `matches.json` and `ads.json` at load, without blocking first paint;
- when the data was fetched and how many ads were read, from `ads.json`;
- one link to the full review list and one to this method.

With no approved profile or no match, the entry says so and shows no rows.

## Case study outline

This document becomes the case study once the scheduled week has run: problem (a CV-first search
instead of a keyword search), architecture (the table above), decisions (rules before a model,
evidence levels, a token instead of Access, JobSearch for the first read), and the measured
numbers (ads per day, duplicates, removals, neurons per day, runs that failed, and the precision
and misses from the owner's labels).

## Test plan

- CV parsing: the public PDF, a DOCX with Swedish headings, a file that is neither, a CV without
  sections, contact lines left out (`platform/tests/job_assistant/test_cv.py`).
- Profile: a correction that invents experience is refused, wishes are accepted, approval numbers
  versions and refuses an unchanged draft.
- Ingestion: new, changed and repeated ads; a removed ad; duplicates under two ids; a run stopped
  between fetch and store, then resumed.
- Matching: each class rule, education requirements never lowering the class, and every
  judgement carrying both quotes.
- Budget: the cap is reached mid-run and the run still ranks every ad.
- Worker: writes without the token, with a wrong token and from another origin are refused.
- Review UI: filter, sort, keyboard status changes and the full ad text.

## What v1 leaves out

- Occupation fields other than Data/IT.
- More than one user, accounts or Cloudflare Access.
- Cover letters, automatic applications and any chance-of-hire figure.
- An LLM reading the CV; parsing is rules, and the owner corrects the draft.
- E-mail or push alerts.
- Ads from sources other than JobTech.

## Status

- 2026-10-23: plan, CV parser, profile schema and checks (`platform/job_assistant/`), tests.
- 2026-10-23: hourly ad store, list export and delivery group. A local run read 2,263 current
  Data/IT ads in 41 seconds, 30 of them duplicates of another id.
- 2026-10-23: matching, embeddings and checked explanations within the budget, and the public
  match and text files.
- 2026-10-23: dbt bronze, silver and gold models with contracts (66 tests pass on the local run of
  2,269 ads), and the export reads gold.
- 2026-10-23: owner records in D1 behind token-protected Worker routes, the hourly CV and approval
  sync, and the D1 Terraform.
- 2026-10-23: the review page `#jobs` with the method, demand, evaluation and owner sections.
- 2026-10-23: `#jobs` as a job board: search, counted filters with chips, sort and the open ad in
  the address, result cards, the split detail view, the application pipeline and the status line.
