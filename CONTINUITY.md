# Continuity

The handover note for the next session: where work stands now, nothing older. Decisions and
their history are in `DECISIONS.md` and the Idea Lineage journal; project status and next steps
are in `PROJECTS.md`. Keep this under about 30 lines; replace lines, do not append history.
The version before 2026-11-03 is in Git history if an old receipt is needed.

## Now

- 2026-11-07 [CODE] Job assistant live: profile v1, engine `job-match-v4`, Airflow windows of
  230 min queued on `main` (`JOB_ADS_SCHEDULER=airflow`), Workers AI secrets passed (#253).
- 2026-11-07 [CODE] PR #255: each window restores the embedding cache, neuron ledger, stage
  state, matches and run log. Before it, every window re-embedded all ads (1,027 neurons).
- 2026-11-04 [TOOL] PR #248 (`korv9/bucket-hygiene`) open: records the owner's deletion of the
  raw job answers from the public bucket on 2026-11-04.

## Uncommitted elsewhere

- 2026-11-07 [TOOL] None known; check `git worktree list`.

## Open

- 2026-11-07 [TOOL] After #255: confirm the next window's first analyse embeds only new texts
  and that `ads.json` `pipeline.latency_minutes` keeps publications across windows.
- 2026-11-07 [USER-PENDING] Always-on Airflow host needs an approved budget
  (`docs/job-ads-airflow.md`, Proposed host and cost).
- 2026-11-07 [TOOL] Workers Builds previews fail: build token lacks preview permission.

## Start here

Read `PROJECTS.md`, then the project's page in `docs/idea-lineage/`. Verify branch state with
`git status` before trusting the lines above.
