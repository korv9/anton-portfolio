# Job ads near real time with Airflow

The job assistant (`#jobs`, [job-assistant.md](job-assistant.md)) gets new, changed and removed Data/IT
ads by polling JobStream every ten minutes. Airflow schedules the flow; the work is done by the
existing modules. This is near real time by polling, not streaming: an ad changed at the source
reaches the publication files within one or two polling intervals plus the run time.

Start and stop instructions: [infra/airflow/README.md](../infra/airflow/README.md).

## Flow

`infra/airflow/dags/job_ads_near_realtime.py` runs four tasks every ten minutes. Each task is one
stage of `platform/job_assistant/realtime.py`:

| Stage | Reuses | Writes |
|---|---|---|
| `collect` | `ads.py` (JobStream, raw store with provenance, id plus hash store) | `ads.json`, `state.json`, `raw/stream-*.json.gz` (local only, never pushed), `_manifest.jsonl`, `runs.jsonl` |
| `analyse` | `ml/jobs/assign.py`, run as a command, with `ml/jobs/embeddings.embed` (cache by text hash), `ml/jobs/registry.py` (current model), `rank.py` (matches, Workers AI cache and budget) | `clusters.json`, `matches.json`, the embedding cache |
| `build` | dbt `tag:job_assistant`, `export.py`, `export.py --check` | `frontend/public/data/job-assistant/*.json` (ignored by Git) |
| `publish` | `release.py publish --group job-assistant` with `JOB_ADS_PUBLISH=r2`; otherwise the delivery check only | nothing in Git; no site build |

Every stage records itself in `warehouse/raw/job_assistant/pipeline.json` (`last` and `ok` per
stage) and appends one line to `realtime_runs.jsonl` with its duration, outcome and counts.
Nothing reads `clusters.json` except the per-cluster signal counts that `analyse` writes into
`pipeline.json`; a failed assignment still stops the run before `build` and `publish`.

The page's last fetch is the last successful run in `runs.jsonl`, which both the hourly GitHub flow
and `collect` write. Its median delay counts only publications uploaded to R2
(`JOB_ADS_PUBLISH=r2`); local checks are left out.

`python platform/job_assistant/realtime.py push` stores the ad store in R2 (`pipeline.py push
job_assistant`) under the same lock as the stages, so the store is never uploaded mid-write.

## JobStream contract (checked 2026-11-02)

- OpenAPI `JobStream` 2.1.1 at `https://jobstream.api.jobtechdev.se/swagger.json`. `/stream` takes
  `date` (required), `updated-before-date`, `occupation-concept-id` and `location-concept-id`. A
  `/v2/stream` with `updated-after` and `updated-before` exists; the flow stays on `/stream`, which
  `ads.py` already used.
- One request a minute. A ten-minute run normally makes one request. After a pause the run reads
  six-hour windows and waits 61 seconds between them (`ads.SPACING`).
- Status 400, 429 or 500 on error. `rawstore.session()` retries 429 and 5xx with backoff;
  anything still failing is logged in `_manifest.jsonl` and stops the run before the cursor moves.
- An answer is a JSON list of events. New and changed ads look the same. A removal is
  `{"id", "removed": true, "removed_date", ...}`. The guide shows the occupation fields of a
  removal as plain ids; the live service sends `{"concept_id": ...}`. Both forms are read.
- An empty list is a valid answer with no changes; it moves the cursor. A 200 whose body is not a
  list is an error.
- Removal events disappear after 90 days, so a stopped flow must restart within that period.

## Correctness rules

| Rule | How |
|---|---|
| Overlap | Each run reads from `JOB_STREAM_OVERLAP_MINUTES` (default 10) before the stored cursor, so an event the source indexes late is still read. The cursor itself never moves back. |
| Idempotence | An ad is keyed by its JobTech id. Its row changes only when the content hash changes, so overlapping windows and duplicate events count as `unchanged`. |
| Order | Each event has a source time: the ad's `timestamp`, or `removed_date`. An event older than the ad's stored `source_updated` is counted as `stale` and skipped, so a late older version or an old removal never overwrites a newer state. |
| Checkpoint | `ads.json` is written atomically before `state.json` moves. A run stopped halfway repeats only the window it did not finish. |
| Stages | The collect cursor is separate from analysis and publication state. `analyse` records the cursor and model it consumed, `build` the cursor it built from, and `publish` the build it shipped. A stage whose input is unchanged reports `skipped`; `build` refuses to run on a store the analysis has not caught up with. A failed stage is retried by Airflow or picked up by the next run. |
| Overlapping runs | The DAG allows one active run and does not catch up. `realtime.py` also holds `warehouse/raw/job_assistant.lock.tmp`, beside the store; whole-tree pushes skip `.tmp` files. The next stage takes it over when the process that holds it has gone (a task killed on timeout), or after 45 minutes. |

## Analysis with the current model

- Only new and changed ads are embedded. Their text is `ml.jobs.prepare.semantic_text` (title,
  description, skills) and goes through `embed`, whose Parquet cache is keyed by text hash; a text
  seen before costs nothing.
- The current model is `current` in `ml/jobs/registry.json`: the published clustering run
  `efd2e318dc1621b2`, MiniLM at revision `e8f8c21`. Its reference vectors
  (`warehouse/features/job_clusters/reference-efd2e318dc1621b2.npz`) were taken from the first
  cached text version of each ad, which need not be the version the run was fitted on. New runs
  record that version in `runs/<id>/inputs.parquet`, and `registry.reference` uses it (without it,
  ads with several cached versions are left out). The live artefact stays as it is until the owner
  promotes a refit. An ad is assigned to the cluster that most of its
  five nearest reference ads belong to. This approximates the run's UMAP and HDBSCAN fit without
  refitting it.
- The change signals per cluster are the open ads and the ads new, changed and removed in the pass.
  `rank.py` redoes a match only when the ad's hash, the profile or the engine changes, as before.
- The model is never retrained by this flow. `job_cluster_candidate` trains a candidate weekly
  and runs the gate. Promotion and rollback are manual commands, and every one is recorded in the
  register.

**Gate.** The vote is checked on a stable 30 % of the reference ads (hash split). It must agree
with the run's own labels at least 65 % of the time, and every cluster must keep 20 reference
ads. The published run scored 0.685 on 1,586 held-out ads; 5,287 of its 35,861 ads have a cached
embedding locally. Nearest centroid scored 0.647 on the same kind of split, so the five-neighbour
vote was chosen.

## Measurements

Real runs on 2026-11-02 against the live JobStream, on a Windows 10 laptop (Python 3.12, CPU only),
`JOB_ADS_PUBLISH=local`. The stages ran in the DAG's order through `tmp/cycle.py`, which samples the
peak memory of each stage and its children. Airflow does not run natively on Windows and the laptop
has no Docker, so the scheduled runs above were made on a GitHub runner.

**Airflow scheduling the flow in Docker.** The workflow `.github/workflows/airflow-job-ads-check.yml`
(run [41461235380](https://github.com/korv9/anton-portfolio/actions/runs/41461235380), 2026-11-02)
started `infra/airflow/docker-compose.yml` on a GitHub runner (4 vCPU, 16 GB), unpaused the DAG,
let it schedule for 25 minutes, restarted the stack and waited for one more run. It restored the
ad store and the model's reference vectors from the public bucket and published nothing.

| Scheduled run (UTC) | Started | Ended | Tasks | collect | analyse | Changes, delay to validated result |
|---|---|---|---|---|---|---|
| 14:20 | 14:26 | 14:38 | 4 of 4 success | 169 events, 68 s | 2,224 texts embedded, 622 s (cold cache) | 142, 17.5 to 425.1 min |
| 14:30 | 14:38 | 14:39 | 4 of 4 success | 9 events, 8 s | 2 embedded, 9 s | 4, 2.0 to 8.8 min |
| 14:40 | 14:40 | 14:40 | 4 of 4 success | 4 events, 4 s | nothing new, 1 s | 0 |
| 14:50 | 14:50 | 14:51 | 4 of 4 success | 8 events, 5 s | 4 embedded, 10 s | 4, 1.7 to 5.4 min |
| 15:00 (after the restart) | 15:00 | 15:01 | 4 of 4 success | 11 events, 4 s | 3 embedded, 10 s | 8, 1.7 to 10.3 min |

The 14:30 run waited until the 14:20 run had finished (one active run), so the two never overlapped.
The four runs listed before `docker compose down` were all listed after `up`, with the 15:00 run
added: the metadata persisted on the `airflow-db` volume. No event was stale. While idle between
runs the stack used about 1.3 GB: scheduler 793 MB, API server 276 MB, DAG processor 175 MB,
Postgres 45 MB. `infra/airflow/check_runs.py` checks these properties from the CLI's JSON.

**Publication to R2.** On 2026-11-02 at 15:05 UTC a full local cycle ran with `JOB_ADS_PUBLISH=r2`:
54 events (21 new, 4 changed, 22 removed), 25 ads assigned, and `release.py` checked and activated
release `4796a58a6ae2` of the `job-assistant` group in 11.8 s. The 47 changes reached the live site
4.8 to 73.3 minutes after their source times (the longest had waited since the last local run). The
live page then read: "Last fetch 16:04. Last publication 16:05. Median delay … 16 min". Until
Airflow is the scheduler, the next hourly GitHub run replaces that release with its own.

**Airflow publishing to R2.** On 2026-11-02 Airflow was the flow's scheduler for a window: the
workflow ran on `main` with `publish=true` (run
[41509796639](https://github.com/korv9/anton-portfolio/actions/runs/41509796639)), the repository
variable `JOB_ADS_SCHEDULER=airflow` kept the hourly refresh out, and the owner stopped the run at
21:20 UTC. Twelve consecutive ten-minute runs each activated a validated `job-assistant` release in
R2, read back from `manifests/current.json` and the release's `ads.json`:

| Published (UTC) | Last fetch | Median delay, source to publication | Publications with changes |
|---|---|---|---|
| 19:41:27 | 19:30 | none yet | 0 |
| 19:42:17 | 19:41 | 97.9 min (catch-up after the failed run below) | 1 |
| 19:50:40 | 19:50 | 97.9 min | 2 |
| 20:00:43 | 20:00 | 6.8 min | 3 |
| 20:10:32 | 20:10 | 11.7 min | 4 |
| 20:20:30, 20:30:31 | 20:20, 20:30 | 11.7 min | 4 |
| 20:40:41 | 20:40 | 11.4 min | 5 |
| 20:50:31 to 21:10:36 | each run | 11.4 min | 6 |
| 21:20:31 | 21:20 | 7.9 min | 7 |

A run with no source change still publishes a release, because the build records a new fetch time.
The median is over the publications that carried changes. When the run was cancelled the workflow
paused the DAG, waited for the stage lock and stored the ad store in R2, so the hourly refresh
continued from Airflow's cursor; `JOB_ADS_SCHEDULER` was then removed.

The first publish run (41488252418) failed: `release.py` starts `export.py` as `python`, which in the
Airflow image is Airflow's interpreter without `duckdb`, and the store upload ran while a stage still
held its lock. `realtime.run` now puts its own interpreter first on `PATH` (tested), and the workflow
pauses the DAG and waits for the lock before the upload.

**Catch-up** from the cursor 2026-10-30 16:44 local time: 12 six-hour windows in 11 min 19 s (one
request a minute), 490 events, 2 empty answers, 121 new, 16 changed, 287 removed, 0 stale. The first
analysis embedded 2,210 texts (45 came from the cache) in 88 s, peak 1.8 GB. The build took 28 s.

**Two consecutive ten-minute runs** (UTC start time):

| Run | Stage | Wall | Peak RSS | Result |
|---|---|---|---|---|
| 13:40 | collect | 4.1 s | 132 MB | 13 events: 2 new, 2 removed, 7 unchanged from the overlap, 0 stale |
| | analyse | 23.8 s | 1,709 MB | 2 texts embedded, 2 ads assigned; profile route answered 503, no matches |
| | build | 17.1 s | 560 MB | 2,254 open ads, 46 duplicates, 849 removed; delivery check passed |
| | publish | 4.1 s | 129 MB | 4 changes; source to validated result 1.9 to 16.0 min |
| 13:50 | collect | 7.6 s | 128 MB | 9 events: 4 new, 2 changed, 1 removed, 1 unchanged, 0 stale |
| | analyse | 23.3 s | 1,733 MB | 6 texts embedded, 6 ads assigned |
| | build | 16.9 s | 653 MB | 2,257 open ads; delivery check passed |
| | publish | 4.1 s | 132 MB | 7 changes; source to validated result 2.1 to 10.9 min |

A run takes about 50 s, so the ten-minute interval leaves a wide margin. The delay is measured
from the source's own change time (`timestamp` or `removed_date`) to the end of `publish`, so it
includes JobStream's indexing lag and the wait for the next poll.

**Restart after a partial failure.** At 13:51 a real `collect` stored one new ad (cursor 14:50 local
time). `analyse` was then killed by force six seconds in, leaving the lock file (then `pipeline.lock` inside the store) and an unchanged
analysis state. The next `analyse` took over the lock because its process was gone, assigned the
ad, and `build` and `publish` followed. The change was published 3.2 min after its source time.
Afterwards the store held 3,109 ads under 3,109 ids, the published `ads.json` 3,109 under 3,109
ids, and all 2,259 open ads had a cluster.

**Embedding use.** Local MiniLM on CPU, no fees: 2 to 6 texts a run. Of the 18 to 19 s, nearly all
is loading the model; that load also sets the 1.7 GB peak. Workers AI used 0 neurons in these runs
because the profile route answered 503 (D1 is not set up), so `rank.py` matched nothing.

**Storage.** One answer is about 15 KB gzipped (about 2 MB a day at 144 runs). `ads.json` is
rewritten each run (16 MB). The embedding cache is 30 MB.

## What continuous operation needs

1. **A host that is always on.** The laptop sleeps. Any Linux machine with Docker can run
   `infra/airflow/docker-compose.yml` unchanged.
2. **One scheduler.** Set the repository variable `JOB_ADS_SCHEDULER=airflow`, so the hourly GitHub
   workflow stands down, and only then set `JOB_ADS_PUBLISH=r2` with the R2 secrets in
   `infra/airflow/.env`. Until a host exists, the check workflow runs Airflow on free runners, in windows
   queued one behind another. Each publishing window starts the next at its own start
   (`workflow_dispatch`), the concurrency group holds it until the window before has pushed the
   store, and a cron schedule every five hours stays as a backup, since GitHub started only two of
   its slots between 00:23 and 13:23 UTC on 2026-11-04. A window schedules the DAG for 230 minutes;
   a 270-minute window was stopped after four hours by a runner shutdown (run 41748877006), which
   cost its store upload, not data: the next window reads again from the last stored cursor. Each
   change of window leaves a gap of about 15 to 25 minutes (image build, restore and a cold
   embedding of the open ads). With the variable removed no new window is queued and the hourly
   refresh takes over again.
3. **The raw store in R2.** The GitHub flow restores and saves `warehouse/raw/job_assistant` in R2
   each run; the Airflow host keeps it on local disk. Schedule `realtime.py push` daily, or keep a
   disk backup, so a lost host does not lose the history.
4. **Alerts.** Failed tasks are visible only in the Airflow UI. Add a failure callback or an
   external check on `ads.json` `pipeline.last_fetch` (the page already warns after eight hours).
5. **Memory.** The idle stack uses about 1.3 GB and loading the model in a run about 1.7 GB more,
   so a 4 GB host is enough. A cold embedding cache costs about ten minutes once (2,224 texts). A model kept
   loaded in a long-running worker, or Workers AI embeddings, would cut both the peak and the 18 s.
6. **The job history warehouse** (`warehouse/jobtech/history.duckdb`) on the host before
   `job_cluster_candidate` can train. It is absent on this laptop, so the weekly DAG is untested.
7. **Secrets** for Workers AI and the owner profile (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`),
   and the owner functions in [job-assistant.md](job-assistant.md), before matches are made.

## Proposed host and cost

Not created; a budget has to be approved first. Prices were checked on 2026-11-02 and vary between
sources, so check them on the provider's page before ordering.

| Option | Size | Approx. per month | Comment |
|---|---|---|---|
| Hetzner Cloud CX23 (recommended) | 2 vCPU, 4 GB, 40 GB | €5.49 + €0.50 IPv4 | Enough for one 50 s run every ten minutes and Postgres. Reported as hard to order in some EU locations in October 2026. |
| Hetzner Cloud CPX22 | 2 vCPU, 4 GB, 80 GB | about €19.49 | Fallback when CX23 cannot be ordered. |
| Managed Airflow (AWS MWAA, Google Cloud Composer) | smallest class | hundreds of dollars | The smallest MWAA class lists 2.10 CNY an hour in AWS China; AWS's own example prices a large environment at $0.99 an hour. Too much for one DAG. |

The recommended host adds R2 traffic only for the published group; at about 50 s a run, compute is
under 15 % of one core.
