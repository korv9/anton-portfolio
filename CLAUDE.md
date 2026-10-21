# Working in this repository

Read `AGENTS.md`, `CONTINUITY.md` when present, and the relevant README sections.
Start source lookup with the existing Graphify graph, about 1,000 tokens. Follow
`.claude/skills/graph-first/SKILL.md`; if it has no relevant result, use a targeted
source search. Do not rebuild the graph unless requested.

## Implementation

Reuse existing code and native platform features. Make the smallest change that
fixes the cause. Keep inputs, outputs, provenance and failure states explicit.
Keep new or extracted code files within 300 executable lines. Split by responsibility
when touching a large file; avoid unrelated repository-wide splitting.
Write generated source as UTF-8 with LF line endings, including on Windows.
Data is real or absent. Never publish placeholder rows or private profiles.
Secrets stay in GitHub/Cloudflare secrets. An ignored local `.env` is allowed for
one-off Workers AI runs; never commit it. Do not print credential values.
Installing dependencies (`npm ci`, `npm install`, `pip install`) and uploading
open data to R2 through the repo's own tools (`pipeline.py push`, `warehouse_store.py`,
`upload.py`) need no separate approval. Do not commit, push or deploy without user
authorization.

## Verification and resources

Use `docs/development.md` for verification levels and workspace lifecycle.
Run `npm run verify:quick`, plus tests of the affected behavior, during development.
Run `npm run verify:full` for integration or shared frontend changes. Data publication
and delivery changes also require `npm run verify:delivery`. Required GitHub CI stays
complete before merge; quick verification is not evidence of complete coverage.
Run the preflight before expensive checks. Save full logs in ignored `tmp/` and
report exit status, elapsed time and a short failure excerpt. Avoid repeating checks
without a new change or unresolved failure. Poll remote CI at most once per minute.

## Conditional skills

Load only the skill sections needed for the current change; keep already-read
instructions in context instead of re-reading them. The catalog is `.claude/skills/README.md`.
- New UI or changed visual design: `frontend-design-principles`, the project's
  `docs/design-system.md` and `frontend/src/tokens.css`. Direction is already approved.
- Visual critique or a requested redesign: `taste-skill`, within the approved direction.
- UI behavior, controls or accessibility changes: `web-design-guidelines` and its local reference.
- New or changed chart encodings: `diagram-design`; use existing tokens and one focal accent.
- Published prose changes: `de-ai-writing`; scan changed copy with its bundled script.
- A behavior-preserving extraction needs type checks and the existing behavior tests;
  it does not restart visual design discovery. Preserve existing markup and styles.

For substantial product decisions, follow `docs/idea-lineage.md`; store labelled
findings and decisions, never prompts or transcripts. Update `CONTINUITY.md` only
for durable changes, with a date and provenance tag, within its stated limits.
