# Continuity

The handover for the next session, nothing older. Decisions: `docs/decisions/DECISIONS.md`;
status and next steps: `PROJECTS.md`. Under 30 lines; replace lines, do not append history.

## Now
- 2026-11-08 [CODE] PR #261 (`korv9/allegora-stream`) open: Allegora streams `/api/ask` (draft,
  check, fable after), paragraph search with at most four laws, threshold before Claude,
  follow-ups, sources panel, `/api/warm`. Search revision `allegora-search-00006-jsr` is live;
  the Worker deploys on merge. Then measure in production (`docs/products/allegora/allegora-gcp.md`).
- 2026-11-07 [CODE] Job assistant live: profile v1, engine `job-match-v4`, Airflow windows of
  230 min queued on `main` (`JOB_ADS_SCHEDULER=airflow`), Workers AI secrets passed (#253).
- 2026-11-07 [CODE] #255 merged and verified in window 42391845674: no re-embedding at the
  window change, latency median kept (5.5 min over 9 publications on 2026-11-07 23:50 UTC).
- 2026-11-08 [CODE] #257 merged: explanations that quote the rules' labels pass the quote check;
  unverified ones are retried a later day. Next: confirm verified explanations in a release.
- 2026-11-04 [TOOL] PR #248 (`korv9/bucket-hygiene`) open: records the owner's deletion of the
  raw job answers from the public bucket on 2026-11-04.

## Uncommitted elsewhere
- 2026-11-07 [TOOL] None known; check `git worktree list`.

## Open
- 2026-11-07 [USER-PENDING] Always-on Airflow host needs an approved budget
  (`docs/products/jobs/job-ads-airflow.md`, Proposed host and cost).
- 2026-11-07 [TOOL] Workers Builds previews fail: build token lacks preview permission.

Start with `PROJECTS.md`, then the project's page in `docs/idea-lineage/`; check `git status`.
