# Continuity

The handover note for the next session: where work stands now, nothing older. Decisions and
their history are in `DECISIONS.md` and the Idea Lineage journal; project status and next steps
are in `PROJECTS.md`. Keep this under about 30 lines; replace lines, do not append history.
The version before 2026-11-03 is in Git history if an old receipt is needed.

## Now

- 2026-11-07 [CODE] Branch `korv9/allegora-stream`, uncommitted, awaiting Anton's review: Allegora
  streams `/api/ask` (draft, check, fable after), paragraph search with at most four laws, a
  threshold before Claude, follow-ups, sources panel. Numbers in `docs/allegora-gcp.md`. The
  search service's new image is not deployed (`deploy.sh build` and `serve` need Anton's yes).
- 2026-11-04 [TOOL] PR #248 (`korv9/bucket-hygiene`) open: records the owner's deletion of the
  raw job answers from the public bucket on 2026-11-04.

## Uncommitted elsewhere

- 2026-11-04 [TOOL] None: `korv9/backend-trim`, `backend-cleanup`, `experiments-cv-separation` merged.

## Blocked

- 2026-10-27 [USER-PENDING] Job assistant live owner functions: Cloudflare token needs
  Account > D1 > Edit (setup run 40580520662 failed on it), then setup workflow, D1 id in
  `wrangler.toml`, secret `JOB_ASSIST_TOKEN`, CV upload and approval.

## Start here

Read `PROJECTS.md`, then the project's page in `docs/idea-lineage/`. Verify branch state with
`git status` before trusting the lines above.
