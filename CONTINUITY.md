# Continuity

The handover for the next session, nothing older. Decisions: `docs/decisions/DECISIONS.md`;
status and next steps: `PROJECTS.md`. Under 30 lines; replace lines, do not append history.

## Now
- 2026-11-17 [CODE] PR #270 (`korv9/jobs-archive-tls`) merged: repairs refresh-jobs (Telia chain for
  data.arbetsformedlingen.se, failing since 2026-11-13; running month in the market export, since
  2026-11-01), refresh-welfare and build-warehouse (validator import under `-m`, since 2026-11-03;
  SCB test table TAB2216 without a domain, 2026-11-15). After merge, dispatch refresh-jobs and
  refresh-welfare on `main`; the jobs group's last release is 2026-10-31, so `market-weekly.json`
  and the weekly card wait for it. Close #221, #222, #229, #241 and #265 when the runs pass.
- 2026-11-17 [CODE] PR #271 (`korv9/python-deps`) merged: pandas, boto3, setuptools and
  sentence-transformers with recompiled locks; replaces Dependabot #213, #214, #216, #219.
- 2026-11-17 [TOOL] Dependabot held: #212 duckdb 2.0 (storage format shared through R2, needs a
  migration), #220 TypeScript 7 (knip 5.88.1 peer). #224, #254, #263, #264, #211 pass apart from
  the Workers Builds preview.
- 2026-11-17 [CODE] PR #248 (`korv9/bucket-hygiene`) merged.
- 2026-11-17 [CODE] PR #273 (`korv9/allegora-prod-timing`) merged: Allegora in production, 1.52 s to
  draft, 4.3 s to the checked answer (median, 8 questions).

## Uncommitted elsewhere
- 2026-11-17 [TOOL] Main checkout (old branch `korv9/allegora-stream`): `.claude/launch.json`,
  `.impeccable/`, journal `2026-11-17.jsonl` and private diary pages; the 11-17 journal entries are
  in no PR yet. Switch it to `main` once these PRs are merged.

## Open
- 2026-11-17 [TOOL] `job_cluster_candidate` has never run: no workflow trains it on a runner, and
  `warehouse/jobtech/history.duckdb` is only on the owner's machine when built.
- 2026-11-07 [USER-PENDING] Always-on Airflow host needs an approved budget
  (`docs/products/jobs/job-ads-airflow.md`, Proposed host and cost); the owner closed the goal.
- 2026-11-07 [TOOL] Workers Builds previews fail: build token lacks preview permission.

Start with `PROJECTS.md`, then the project's page in `docs/idea-lineage/`; check `git status`.
