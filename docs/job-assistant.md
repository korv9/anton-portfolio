# Job assistant

The job assistant is the owner's own job search tool, and it is public. It starts from the CV
and treats job ads as the candidates under review. A recruiter can see which roles the owner is
looking for and how the documented experience compares with what ads ask for.

The match is decision support. It is not an estimate of the chance of being hired, and it never
gives a percentage. Every judgement points at the sentence in the ad and the line in the CV it
rests on.

## Flow

1. The owner uploads a CV as PDF or DOCX. The Worker stores the file in R2, and the next hourly
   run (or a manual run) reads it with `platform/job_assistant/cv.py` into a draft profile.
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
strongest of those lines. A correction may move, rename or delete facts. It cannot add a fact at
a level above `interest` unless the quote is found in the CV text, so the profile never states
experience the CV lacks. `professional_years` stays empty until the owner enters a documented
number; internships are not turned into years of employment.

Formal education requirements in ads are shown in their own row and never lower the match
class. Language, citizenship and security clearance conditions are listed the same way, as
conditions to check.

## Data model

All of it is public. The pipeline outputs sit under `job-assistant/` in the public R2 bucket.
The owner's own records sit in a D1 database behind the Worker.

| Record | Store | Grain and main fields |
| --- | --- | --- |
| CV file | R2 `job-assistant/cv/<sha256>.<ext>` | One file per uploaded version; the current CV is already public |
| Draft profile | D1 `profile_draft` | One row: profile JSON (schema v1 in `cv_profile.py`), CV hash, updated time |
| Approved profile | D1 `profile_version` | One row per version: version, profile JSON, `profile_sha256`, CV hash, approved time |
| Ad store | R2 `warehouse/raw/job_assistant/ads.json` | One row per JobTech ad id: headline, employer, place, full public text, source and application links, published, last changed, first seen, removed time, content hash, duplicate group, and its history of new, changed and removed events |
| Ad list | delivery group `job-assistant`, `job-assistant/ads.json` | The store's current ads and those removed in the last 30 days, without the text, plus the last week of runs |
| Match store | R2 `warehouse/raw/job_assistant/matches.json` | One row per current ad: role category, match class, reasons, skill judgements, gaps, conditions, similarity, explanation (optional), `profile_version`, CV hash, engine version, the ad's content hash |
| Match list | delivery group, `job-assistant/matches.json` and `texts.json` | Every current ad's class, role and reasons; the full judgements and the ad text for the review list, stretch ads and the evaluation sample |
| Review status | D1 `review` | One row per ad: status, note, updated time |
| Relevance label | D1 `label` | One row per labelled ad: relevant, maybe or not relevant, note, the class shown when labelled |
| Run record | R2 `warehouse/raw/job_assistant/runs.jsonl` | One row per hourly run: windows, counts, outcome (neurons spent are added with the matching) |

Statuses are `new`, `review`, `interesting`, `pass`, `applied` and `closed`. An ad without a
review row is `new`. An ad that JobTech removes is shown as closed, but a status the owner set,
such as `applied`, is kept and shown next to it.

A requirement judgement holds the ad's requirement (label, required or preferred, the exact
sentence and its line) and the CV side (the level and the CV quotes, or "not in the CV").

## Ingestion, duplicates and removal

`platform/job_assistant/ads.py` runs every hour in `refresh-job-assistant.yml`, as the
`job_assistant` subject of `platform/pipeline.yml`. The first run reads every current Data/IT ad
from JobSearch, one publication day at a time over the last 60 days, with the client in
`platform/ingest/jobtech/ingest_jobs.py`. JobStream's snapshot is not used: it ignores the
occupation filter and returns about 40,000 ads. Later runs ask JobStream for every change since
the stored cursor, in windows of at most six hours, as `ingest_stream.py` does. Each answer is
stored with its provenance line (`platform/lib/rawstore.py`) under its own source,
`job_assistant`, so its fetch log never mixes with the market subject's. The text projection and
contact redaction come from `platform/publish/job_content.py`.

- The key is the JobTech ad id. A changed ad replaces its row when its content hash differs, and
  the old version is noted in the row's history. An unchanged repeat does nothing.
- Ads with the same employer, title and text hash under different ids form one duplicate group;
  the list shows the group once.
- A `removed` record sets the removed time, and a passed application deadline sets `expired` in
  the list. The row stays so the owner's status and labels still have something to point at. An
  ad that comes back after removal is reopened.
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

`platform/job_assistant/match.py` sets one of four classes. "Shown" means the profile has the skill
at `practical` or `education_or_project`. The share counts required skills, or every named skill
when the ad marks none as required.

| Class | Rule |
| --- | --- |
| `strong` | A wished role read from the title, in a wished place, not senior; at least three skills named and at least 60 % shown |
| `possible` | A wished role in a wished place, not senior, at least 30 % shown or no skill named; or a strong case whose role is only in the ad text or that names fewer than three skills |
| `stretch` | A wished role in a wished place with at least 30 % shown, but a senior, lead or architect title, or three or more years of experience asked |
| `outside` | Another role, another place without remote wording, or under 30 % shown |

Hybrid work counts as work at the ad's own office, so only remote wording widens the place. Each
match lists its reasons in plain words, for example "data engineering (from the title); 5 of 8
named skills shown in practical work or projects; Stockholm". `strong` and `possible` make the
review list. Within a class, ads are sorted by the owner's role order, then by the bge-m3 cosine
between the ad and the profile, then newest first. A match is redone only when the ad's content
hash, the profile version or the engine version changes.

On the 2,233 current, non-duplicate ads of the local run, with Stockholm and Solna as places and
nine wished roles, the rules gave 15 strong, 93 possible, 115 stretch and 2,010 outside. Most
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
embedded once per text. When the project cap or the account quota is reached, rules and cached
embeddings still rank every ad, and the explanations wait for the next day. An explanation is kept
only if every quote in it is found in the ad or the CV lines, the same rule as the Worker's quote
check for `/api/answer`; otherwise it is marked unverified and not shown. The hourly run gets the
token through the `workers-ai` input of `data-subject.yml`; without it the run uses rules and
cached vectors only.

## Security of writes

Reads are public. Every write route (status, note, label, profile correction, approval and CV
upload) requires a Worker secret, `JOB_ASSIST_TOKEN`, sent as a bearer token. The Worker compares
it in constant time, accepts writes only from the site's own origin or without an `Origin` header
(the Actions run), and keeps the existing rate limit. A missing or wrong token gets 401 and
changes nothing. There is no open write endpoint.

A secret token was chosen over Cloudflare Access because one person writes, Access would need a
Zero Trust application and policy for a few routes, and the token works the same for the browser
and for the Actions run. The owner pastes the token once per device; the page keeps it in
`localStorage` and never sends it to any other host.

## What the owner applies

Nothing here is applied by the agent. When the storage pull request lands, the owner:

1. applies the Terraform in `infra/cloudflare` that adds the D1 database;
2. puts its id in the `[[d1_databases]]` block of `wrangler.toml`;
3. runs `npx wrangler secret put JOB_ASSIST_TOKEN` and sets the same value as the GitHub secret
   `JOB_ASSIST_TOKEN`;
4. sets the GitHub secret `CLOUDFLARE_AI_TOKEN`, a token limited to Workers AI, for the hourly
   run.

The hourly workflow must live on `main`, so it goes in its own small pull request.

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
