# Continuity

The handover note for the next session: where work stands now, nothing older. Decisions and
their history are in `DECISIONS.md` and the Idea Lineage journal; project status and next steps
are in `PROJECTS.md`. Keep this under about 30 lines; replace lines, do not append history.
The version before 2026-11-03 is in Git history if an old receipt is needed.

## Now

- 2026-11-03 [CODE] Branch `korv9/project-memory`, uncommitted: Idea Lineage public by default,
  `DECISIONS.md`, `DATA_DECISIONS.md` and `docs/idea-lineage/` generated, 29 events migrated
  from the old `CONTINUITY.md`, `PROJECTS.md` written and reviewed by Anton, Stop hook
  (`.claude/settings.json` → `platform/idea_lineage/hook.py`), skill `project-memory`,
  design-system precedence and eyebrow rule, `taste-skill` and `frontend-design-principles`
  off by default. Awaiting Anton's authorisation to commit.
- 2026-11-03 [TOOL] `verify:quick` passed (36 s); platform pytest 974 passed, 2 skipped
  (architecture tests excluded, they expect a Windows bash path); idea_lineage 29 passed.

## Uncommitted elsewhere

- 2026-11-01 [CODE] `korv9/experiments-cv-separation`: audit fixes (government_defeat off Cluster
  Visuals, 30 % row-drop gate, worker origin check, `frontend/src/{hub,tech,ask}` trimmed).
- 2026-11-02 [CODE] `korv9/backend-trim`: raw job-ad answers LOCAL_ONLY, docs checked against code.

## Blocked

- 2026-10-27 [USER-PENDING] Job assistant live owner functions: Cloudflare token needs
  Account > D1 > Edit (setup run 40580520662 failed on it), then setup workflow, D1 id in
  `wrangler.toml`, secret `JOB_ASSIST_TOKEN`, CV upload and approval.
- 2026-11-02 [USER-PENDING] Raw JobStream/JobSearch objects with contact details still in the
  public bucket await the owner's deletion (`docs/storage-and-serving.md`).

## Start here

Read `PROJECTS.md`, then the project's page in `docs/idea-lineage/`. Verify branch state with
`git status` before trusting the lines above.
