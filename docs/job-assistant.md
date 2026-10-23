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
| Ad | R2 `job-assistant/ads.json` | One row per JobTech ad id: title, employer, place, full text, source URL, published, last changed, removed time, content hash, duplicate group |
| Ad history | R2 `job-assistant/changes/<day>.jsonl` | One row per observed change: ad id, time, old and new content hash, removed flag |
| Match | R2 `job-assistant/matches.json` | One row per ad and profile version: role category, match class, reasons, requirement judgements, gaps, explanation (optional), `profile_version`, CV hash, engine version |
| Review status | D1 `review` | One row per ad: status, note, updated time |
| Relevance label | D1 `label` | One row per labelled ad: relevant, maybe or not relevant, note, the class shown when labelled |
| Run record | R2 `job-assistant/runs.jsonl` | One row per hourly run: window, counts, neurons spent, outcome |

Statuses are `new`, `review`, `interesting`, `pass`, `applied` and `closed`. An ad without a
review row is `new`. An ad that JobTech removes is shown as closed, but a status the owner set,
such as `applied`, is kept and shown next to it.

A requirement judgement holds the ad's requirement (label, required or preferred, the exact
sentence and its line) and the CV side (the level and the CV quotes, or "not in the CV").

## Ingestion, duplicates and removal

The hourly run reuses the JobStream client in `platform/ingest/jobtech/ingest_stream.py`: it asks
for every change since the stored cursor, in windows of at most six hours, and stores each answer
with its provenance line (`platform/lib/rawstore.py`). The text projection, contact redaction and
requirement sentences come from `platform/publish/job_content.py`.

- The key is the JobTech ad id. A changed ad replaces its row when its content hash differs, and
  the change is written to the history. An unchanged repeat does nothing.
- Ads with the same employer, title and text hash under different ids form one duplicate group;
  the list shows the group once.
- A `removed` record, or a passed application deadline, sets the removed time. The row stays so
  the owner's status and labels still have something to point at.
- The cursor moves only after the outputs for its window are stored. A run that stops halfway
  asks for the same window again, and the id plus hash rule makes that harmless.

## Matching

Matching is rules first. `platform/job_assistant/skills.py` holds one vocabulary for CVs and
ads: the requirement taxonomy from `job_content.py` plus a few CV terms.

| Aspect | Rule |
| --- | --- |
| Role category | Title patterns for Data Engineering, Analytics Engineering, Python Backend, Applied AI, BI, Frontend, Full stack, Data Analysis and ML Engineering; a body-only signal is marked as uncertain |
| Technique | Each required and preferred skill sentence against the profile level of that skill |
| Seniority | Senior, lead and principal titles and stated years of experience, with the experience wording that lifted the senior/junior AUC by 0.15 in the feature study (`ml/feature_study/job_ads.py`, branch `korv9/ml-feature-engineering`) |
| Wishes | Place, remote wording and the owner's role order |

The classes are `strong`, `possible`, `stretch` and `outside`. Each comes with the rule that set
it in plain words, for example "4 of 5 required skills in practical work; title is senior".
Within a class, ads are sorted by role priority, then by the bge-m3 cosine between the ad and
the profile, then by date. The cosine also flags ads that resemble the profile but name no
taxonomy skill, so they can be checked for a missed match.

## Workers AI budget

The project stays on the free tier at 0 kr. The free day is 10,000 neurons, shared with other
experiments. The ledger in `platform/nlp/workers_ai.py` (`spent_today`, `append_ledger`) gets
the agent name `job-assistant` and a project cap of 1,500 neurons per UTC day.

| Use | Model | Estimate |
| --- | --- | --- |
| Embeddings of all new and changed ads | `@cf/baai/bge-m3`, 1,075 neurons per million tokens | about 200 ads a day at 600 tokens, roughly 130 neurons |
| Explanations for the top new candidates | `@cf/google/gemma-4-26b-a4b-it` | 30 to 80 neurons each; at most 12 a day |

Vectors are cached per text hash, so an ad is embedded once per text. When the project cap or the
account quota is reached, rules and cached embeddings still rank every ad, and the explanations
wait for the next day. An explanation is kept only if its quotes are found in the ad or the CV,
with the quote check the Worker already uses for `/api/answer`.

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

The hourly run is a subject in `platform/pipeline.yml` with `sla.fresh_within: 2h`, so the
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
