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
| Delivery | `job-assistant/{ads,matches,texts,texts-remaining,demand}.json`, checked, then released as the group `job-assistant` | `export.py`, `configs/delivery/job-assistant.json` |
| Owner records | Profile drafts and versions, statuses, notes, labels | Worker and D1 (storage pull request) |

The subject `job_assistant` in `platform/pipeline.yml` runs these steps in order from
`.github/workflows/refresh-job-assistant.yml`, which is scheduled every hour. GitHub starts the
runs every few hours in practice (see Monitoring). The export runs only when every dbt test passed.

## Flow

1. The owner uploads a CV as PDF or DOCX. The Worker stores the file in D1, readable only with
   the owner token, and the next hourly run (or a manual run) reads it with `platform/job_assistant/cv.py` into a draft profile.
2. The owner reads the draft, corrects it and adds wishes (places, remote work, prioritised
   roles, interests, and optionally the seniority level: `junior`, the default, or `any`). `cv_profile.py` checks each correction, and approval freezes the draft as
   the next numbered version.
3. On an hourly schedule a GitHub Actions run reads JobTech's JobStream for the Data/IT occupation field
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
experience the CV lacks. The summary is checked the same way. `professional_years` stays empty
until the owner enters a documented number as a correction; `cv_profile.py` refuses a number that
no entry in `corrections` names, and internships are not turned into years of employment.

Each CV quote in a match also carries `source`, the kind of entry it comes from, read from the
profile entry its ref names:

| `source` | Ref | Rule |
| --- | --- | --- |
| `employment` | `experience-N`, `other-N` | the entry's `kind` is `employment` |
| `internship` | `experience-N`, `other-N` | the entry's `kind` is `internship` (LIA); still `practical` |
| `education` | `education-N`, `project-N` | an education entry, or a project whose `context` is `education` (the CV calls it a thesis) |
| `project` | `project-N` | any other project |
| `skills_list` | `skills` | the skills list |
| `summary` | `summary` | the summary |

`cv_profile.py` refuses a profile with a ref that names no entry or an experience `kind` other
than these two. The level rules above do not change.

CV quotes are the CV's own words: only whitespace differs from the extracted text. Line-end
commas are kept, and a short line without end punctuation (an entry's subtitle) is a quote of its
own (`cv-rules-v2`).

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
| Ad text | gold `mart_job_assistant_texts`; `job-assistant/texts.json`, `job-assistant/texts-remaining.json` | The full public text (contact details redacted) of the detailed ads in `texts.json`, loaded with the page, and of every other open, non-duplicate ad in `texts-remaining.json`, loaded when such an ad is opened. Both are `{schema_version, generated_at, texts: {ad id: {description, text_origin, contact_redactions, content_hash}}}` |
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

`platform/job_assistant/ads.py` is scheduled every hour in `refresh-job-assistant.yml`, as the
`job_assistant` subject of `platform/pipeline.yml`. The first run reads every current Data/IT ad
from JobSearch, one publication day at a time over the last 60 days, with the client in
`platform/ingest/jobtech/ingest_jobs.py`. An ad published earlier that is still open is missed
until it changes and the stream brings it in; most Platsbanken ads close within that time. JobStream's snapshot is not used: it ignores the
occupation filter and returns about 40,000 ads. Later runs ask JobStream for every change since
the stored cursor, in windows of at most six hours, as `ingest_stream.py` does. Each answer is
stored with its provenance line (`platform/lib/rawstore.py`) under its own source,
`job_assistant`, so its fetch log never mixes with the market subject's. The text projection and
contact redaction come from `platform/publish/job_content.py`: e-mail addresses, contact names and
phone numbers ("070 123 45 67", "070.123.45.67", "08-788 00 00", "+46 (0)70 123 45 67") become
"[kontaktuppgift utelämnad]". Each run applies the current redaction to stored texts as well, so
a wider pattern covers ads stored before it, and the export refuses `texts.json` or
`texts-remaining.json` with an e-mail address or phone number left.

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
| Role category | Title patterns for Data Engineering, Analytics Engineering, Python Backend, Applied AI, BI, Frontend, Full stack, Data Analysis and ML Engineering ("deep learning" and "computer vision" count as ML); a body-only signal is marked as uncertain. "Analytiker"/"analyst" (also compounds) is Data Analysis only with data wording in the ad (SQL, BI, statistics, datasets); "backend" is Python Backend only when the title names Python or the ad requires it; a generic developer title ("Systemutvecklare", "Mjukvaruutvecklare", "Utvecklare", "Software Engineer/Developer") is Python Backend, read from the title, when the ad names Python; a bare "AI" in the body names no role |
| Technique | Each required and preferred skill sentence against the profile level of that skill. Strength comes from `job_content.py` (`job-requirements-v5`): "Det är ett plus om …" and lines under a "Meriterande:" heading are preferred even when they say "du har"; lines under "Krav:", "Skallkrav", "Kvalifikationer", "Vi söker dig som har:" or "We believe you have:" are required. The job assistant reads the vocabulary of `skills.py`, which adds graph databases, Neo4j, knowledge graphs, ontologies and RDF/SPARQL. A spoken language other than Swedish and English ("Fluent Spanish …") is listed as a condition |
| Seniority | Senior, lead and principal titles; senior wording in the text ("med din expertis och erfarenhet", "gedigen erfarenhet", "lång erfarenhet", "technical leadership", "as a lead", "som senior"), but not "erfarenhet av X" on its own; stated years of experience ("4+ years of professional … experience", "minst fem år", "flera (5+) års", "Minst 4 års arbete"; "flerårig", "flera års" and "several years" count as three; over 15 is read as a company's age), with the experience wording that lifted the senior/junior AUC by 0.15 in the feature study (`ml/feature_study/job_ads.py`, branch `korv9/ml-feature-engineering`) |
| Wishes | Place, full-remote wording, the owner's role order and the seniority wish |

`platform/job_assistant/match.py` sets one of four classes. "Practical" means the profile has the
skill at `practical`; "shown" adds `education_or_project`. Only practical skills can make an ad
strong or possible; skills shown only in projects or education are counted and reported apart. The
shares count required skills, or every named skill when the ad marks none as required.

| Class | Rule |
| --- | --- |
| `strong` | A wished role read from the title, in a wished place, not senior; at least three skills named and at least 60 % practical |
| `possible` | A wished role read from the title, in a wished place, not senior, and at least 30 % of the named skills practical or no skill from the vocabulary named (noted as uncertain); or a strong case that names fewer than three skills or states no place |
| `stretch` | A wished role in a wished place with at least 30 % shown (or no skill named, or a title-read role in an ad with a junior ask: "junior", "blivande", at most one year), but senior, three or more years of experience asked, under 30 % practical, or a role read only from the ad text |
| `outside` | Another role, another place without full-remote wording, or under 30 % shown |

"Senior" lowers the class only under the default wish `seniority: junior`. With `seniority: any`
a senior title or years asked keep the class; the reasons still name them and `uncertain` says
the wish kept them from lowering it.

Hybrid work counts as work at the ad's own office, so only full-remote wording widens the place:
"helt på distans", "100 % remote", "fully remote", "remote-first", "Tjänsten utförs på distans".
A sentence with partial or negated wording ("en dag i veckan", "delvis", "hybrid", "Remote work
is not available") does not count. An ad with no municipality or region is not outside on place
alone; it is at most possible and `uncertain` says "The ad states no place." Each
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
outside ads are support, Java or other roles outside the wishes. A manual evaluation of 30 ads on
2026-10-27 (`job-match-v3` before its rule fixes: 4 strong, 32 possible, 145 stretch, 2,015 outside
of 2,196) found missed years, hybrid wording read as remote and roles read from company
boilerplate. With those fixed (`job-match-v3`, `job-requirements-v5`, profile version 2 of the
public CV with Stockholm, Solna and Sundbyberg, remote, eight roles) the same store gives 2
strong, 11 possible, 96 stretch and 2,087 outside. A second round (generic developer titles with
Python, graph and ontology terms in the vocabulary, bracketed years, senior wording in the text,
deep learning, ads without a place; `job-match-v4`) gives 1 strong, 18 possible, 109 stretch and
2,068 outside. These counts come from one test
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
step of `data-subject.yml` before the build.

The hourly run gets the token through the `workers-ai` input of `data-subject.yml`; without it
the run uses rules and cached vectors only.

`rank.py` reads the approved profile from `/api/jobs/profile`. What it does without one depends
on the answer, and the reason, the HTTP status (null when unreachable) and the time go into the
match store's note and on to `matches.json` as `status`:

| Answer | Match store | Exit |
| --- | --- | --- |
| 200 with `approved: null` | emptied: `profile: null`, no matches, `note.skipped` | 0 |
| 403, 404 or 503 (503: D1 not set up), or the route cannot be reached | the last matches stand, with `note.kept`; without any, an empty store with `note.skipped` | 0 |
| any other status, or a 200 that is not a JSON object | as above, and a `::error::` line | 1 |
| an approved profile that fails the schema check | unchanged | 1 |

dbt builds every model and test on zero matches, and the export publishes `ads.json`,
`demand.json` and the other files with empty match lists, so the ad list is published without a
profile. The step allows exit 1 (`ok_exit` in `platform/pipeline.yml`), so an unexpected answer
shows as an error annotation while the run still publishes the ads. A red run would skip the
publication, and a Worker fault would then hold back ads that do not depend on it. Kept matches
belong to the last run that read the profile; the match mart drops those of ads that have closed
since, and `#jobs` says that the matches were kept and why.

From GitHub's runners the route answered 403 in every run from 2026-10-23 to 25 (log line:
`requests.exceptions.HTTPError: 403 Client Error: Forbidden for url:
https://antonernstsson.com/api/jobs/profile`), while a laptop got the Worker's 503 at the same
time. `worker/` has no route that answers 403, so the inference is that something in front of the
Worker, probably Cloudflare's bot protection or a WAF rule, refuses the runner. The logs do not
show which. The same Worker answers on `anton-portfolio.anton-ernstson.workers.dev`, which the zone's
security settings do not cover, so `data-subject.yml` sets `JOB_ASSIST_API` to that address and the
runners no longer go through the zone.

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

Nothing here is applied by the agent. Every secret lives in the GitHub environment
`anton-portfolio`; nothing is set from a laptop.

| Secret | Used by | Token permissions |
| --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | `setup-job-assistant.yml`, the hourly run (`rank.py`) | none; it is the account id (a repository variable of the same name also works) |
| `CLOUDFLARE_API_TOKEN` | `setup-job-assistant.yml`; the hourly run when there is no `CLOUDFLARE_AI_TOKEN` | Account > D1 > Edit, Account > Workers Scripts > Edit and Account > Workers AI > Read and Edit, on this account only |
| `CLOUDFLARE_AI_TOKEN` (optional) | `rank.py` in the hourly run, through `data-subject.yml`, in place of `CLOUDFLARE_API_TOKEN` | Account > Workers AI > Read and Edit, nothing else |
| `JOB_ASSIST_TOKEN` | copied into the Worker by `setup-job-assistant.yml`; `sync.py` | none; a long random value the owner chooses and pastes on the review page |

The owner chose one Cloudflare token (2026-10-25), so the hourly run uses `CLOUDFLARE_API_TOKEN`
for Workers AI. That token also has D1 Edit and Workers Scripts Edit, which an unattended scheduled
run does not need. Adding a Workers-AI-only `CLOUDFLARE_AI_TOKEN` narrows the hourly run to that
token without any code change.

The R2 secrets the other subjects use are already in the environment. In this order:

1. Add `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` to the environment.
2. Run the workflow "Set up the job assistant" from `main`. It finds or creates the D1 database
   `job-assistant`, applies `worker/migrations`, and prints the database id in the run summary.
   It is safe to run again: an existing database is reused and applied migrations are skipped.
   A missing secret or a missing token permission fails the step and names it.
3. Commit the printed id into the `[[d1_databases]]` block of `wrangler.toml` and uncomment the
   block. Workers Builds deploys from that file, and the id is not a secret, so a committed id is
   simpler to review than one looked up at deploy time.
4. Add `JOB_ASSIST_TOKEN` and run the workflow again. It pipes the value into
   `wrangler secret put` through stdin; without the secret the step is skipped with a notice.
5. Upload the CV on the review page, correct the draft, and ask for approval.

Without `JOB_ASSIST_TOKEN` the public part runs: the ad list, `demand.json` and the market data
are published every run, and with D1 in place the profile route answers with no profile instead
of 503. CV upload, the draft, profile approval, statuses and notes wait for the token, and
matching waits for the first approved profile. Before step 3 `/api/jobs/*` answers 503 and the
run publishes the ads with no matches.

From GitHub's runners `/api/jobs/profile` answered 403 on 2026-10-23 to 25. The Worker never
answers 403, so probably Cloudflare's edge in front of it refuses the runner. Actions now reach the
Worker through its workers.dev address (`JOB_ASSIST_API` in `data-subject.yml`), so no WAF or bot
rule is needed.

The Terraform workflow cannot plan while the repository variable `TF_WORKER_DOMAIN_IDS` is unset,
and there is no `terraform` environment, so the setup workflow creates the database instead of
`cloudflare_d1_database.job_assistant`. Bringing it under Terraform later is optional:

    terraform -chdir=infra/cloudflare import cloudflare_d1_database.job_assistant '<account id>/<database id>'

## Monitoring

The run is a subject in `platform/pipeline.yml` with `sla.fresh_within: 8h`, so the existing
data heartbeat opens an issue when it stops. `runs.jsonl` keeps one row per run, which is the
record for the seven days of scheduled operation after the merge.

The cron is `7 * * * *`, but GitHub does not start every scheduled run. The ten runs from
2026-10-23 23:04 to 2026-10-25 11:12 UTC began 2.4 to 5.7 hours apart, each created hours after
its slot. They did not wait in the `data-refresh` concurrency queue: each run was created and
started in the same second, and no other refresh was running at those times. The data heartbeat
(`41 * * * *`, its own concurrency group) ran just as sparsely, every 2.4 to 5.6 hours. The cause is
GitHub's scheduler, which delays and drops scheduled runs under load, so a separate concurrency
group would not help. The SLA is 8 hours for that reason, and the page calls the ads stale after
8 hours.

## Evaluation

The owner labels at least 50 ads as relevant, maybe or not relevant. Half come from the review
list and half are a random sample of ads outside it, so missed jobs can be found too. The page
reports precision of the list, the share of relevant ads in the outside sample, and each ad whose
class and label disagree. The labels are the owner's and the counts are small, so the numbers
describe this search, not matching in general.

## Review page

`#jobs` (`frontend/src/job-assistant/`) is the work tool and the public page in one. The production
build shows it, as it shows every other page.

- The header says what the page is. A status line below it gives the ads in the store, the ads
  published today, the strong matches, the applications per pipeline status and the time of the
  last sync. When that sync is more than eight hours old, a notice says so.
- Three tabs: Jobs, Applications and How it works. The Applications tab is a read-only board of
  the pipeline, from Saved to Rejected, built from the review rows.
- When nothing is matched, the Jobs tab lists the open ads (not removed, not expired, not a
  duplicate), newest first, with title, employer, place, dates and a link to the ad on
  Platsbanken. There are no classes, skills or filters. The note above the list gives the reason
  from `status`: "matching starts when the CV profile is approved" only when the Worker answered
  without one, otherwise that the profile store is not set up (503) or that the profile could
  not be read or reached, with the time. When the last matches were kept, the status line says
  so.
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
  its CV section and the kind of entry (employment, internship, education, project, skills list).
  Under 760 px each requirement is one block. Gaps, education and conditions, uncertainty, a
  trace of the files, models and tests behind the match, the full text, links and dates come
  after.
- The full text of a detailed ad comes from `texts.json`. Any other open ad's text comes from
  `texts-remaining.json`, fetched once, only when such an ad is opened (`?ad=` in the address);
  the preview beside the list offers a button instead. If that file fails, the ad links to
  Platsbanken.
- With the owner token the open ad has buttons for every status and a private note. Statuses
  are stored in D1 and survive reloads and new sessions.
- How it works: the method, the approved CV profile (skills by level, each with its CV line and
  entry; never the draft, the file or the summary), what the ads ask for against the CV
  (`demand.json` against the approved profile), the label counts, the runs of the last seven
  days, and the owner's tools (token, CV upload, draft editor with fields for roles, places,
  remote work and seniority, approval request).
- Only `ads.json` is required. When matches, texts or demand fail to load, or the owner routes
  answer 401, 503 or not at all, the page says which and keeps the ad list working.

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
  judgement carrying both quotes. Each answer of the profile route in the table under Workers AI
  budget (`platform/tests/job_assistant/test_rank_profile.py`). The 2026-10-27 evaluation's ad
  wording for years, remote, role context and requirement headings
  (`platform/tests/job_assistant/test_match_rules.py`); the seniority wish, each CV quote's
  `source`, and every CV quote found word for word in the CV text.
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
- 2026-10-25: without an approved profile the run publishes the ad list with an empty match
  store, and the SLA is 8 hours, which matches how often GitHub starts the scheduled runs.
