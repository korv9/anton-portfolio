# Continuity

The handover for the next session, nothing older. Decisions: `docs/decisions/DECISIONS.md`;
status and next steps: `PROJECTS.md`. Under 30 lines; replace lines, do not append history.

## Now
- 2026-11-19 [CODE] Branch `korv9/outdoor` (worktree `tmp/wt-outdoor`, not pushed): new subject
  `dooh` (renamed from `outdoor` on the owner's word), Labs page `#publiken`, pre-registration
  committed before the fit (ec7633e8, file keeps the name `outdoor`). Release `dooh` 832b8a68 is
  active in R2; the earlier `outdoor` group (e3ced3c9) is still in the manifest until the owner
  removes it. Raw pushed, fact-book PDFs kept local. The new-station model missed the
  pre-registered 25 % (23.7 %): label `not_better_than_median`. No `PROJECTS.md` entry yet.
- 2026-11-17 [CODE] PR #270 (`korv9/jobs-archive-tls`) merged: repairs refresh-jobs (Telia chain for
  data.arbetsformedlingen.se, failing since 2026-11-13; running month in the market export, since
  2026-11-01), refresh-welfare and build-warehouse (validator import under `-m`, since 2026-11-03;
  SCB test table TAB2216 without a domain, 2026-11-15). After merge, dispatch refresh-jobs and
  refresh-welfare on `main`; the jobs group's last release is 2026-10-31, so `market-weekly.json`
  and the weekly card wait for it. Close #221, #222, #229, #241 and #265 when the runs pass.
- 2026-11-17 [TOOL] Dependabot held: #212 duckdb 2.0 (storage format shared through R2, needs a
  migration), #220 TypeScript 7 (knip 5.88.1 peer). #224, #254, #263, #264, #211 pass apart from
  the Workers Builds preview.

## Uncommitted elsewhere
- 2026-11-17 [TOOL] Main checkout (old branch `korv9/allegora-stream`): `.claude/launch.json`,
  `.impeccable/`, journal `2026-11-17.jsonl` and private diary pages; the 11-17 journal entries are
  in no PR yet. Switch it to `main` once these PRs are merged. 2026-11-19: its
  `.claude/launch.json` also gained the `outdoor` preview entry (port 5191).

## Open
- 2026-11-17 [TOOL] `job_cluster_candidate` has never run: no workflow trains it on a runner, and
  `warehouse/jobtech/history.duckdb` is only on the owner's machine when built.
- 2026-11-07 [USER-PENDING] Always-on Airflow host needs an approved budget
  (`docs/products/jobs/job-ads-airflow.md`, Proposed host and cost); the owner closed the goal.
- 2026-11-07 [TOOL] Workers Builds previews fail: build token lacks preview permission.

Start with `PROJECTS.md`, then the project's page in `docs/idea-lineage/`; check `git status`.
