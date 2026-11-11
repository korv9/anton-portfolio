# Working in this repository

Read `AGENTS.md`, then `PROJECTS.md` for the project the task concerns, `CONTINUITY.md`, and
the relevant README sections. `PROJECTS.md` is Anton's: it states what each project is for and
where it stands. Change it only when Anton asks for the change in the conversation; if the code
disagrees with it, report the difference and leave the line. The routine for reading, recording
and handing over is `.claude/skills/project-memory/SKILL.md`.
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

Use `docs/platform/development.md` for verification levels and workspace lifecycle.
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
- New UI or changed visual design: `docs/site/design-system.md` (rules, precedence, the eyebrow
  rule) and `frontend/src/tokens.css`. The direction is decided; do not restart design
  discovery. `frontend-design-principles` and `taste-skill` are not loaded unless Anton asks
  for a design exploration or a critique by name.
- UI behavior, controls or accessibility changes: `web-design-guidelines` and its local reference.
- Connections, reuse or duplication across projects: the "Exploring connections" section of
  `graph-first`.
- New or changed chart encodings: `diagram-design`; use existing tokens and one focal accent.
- Published prose changes: `de-ai-writing`; scan changed copy with its bundled script.
- A behavior-preserving extraction needs type checks and the existing behavior tests;
  it does not restart visual design discovery. Preserve existing markup and styles.

When Anton changes a direction, scope, priority, data rule, model choice or design rule, end
the answer with labelled lines (`Beslut (Anton): …`, `Fynd: …`, `Öppen fråga: …`); the Stop
hook records them in the Idea Lineage journal and rebuilds `docs/decisions/DECISIONS.md`,
`docs/decisions/DATA_DECISIONS.md` and `docs/idea-lineage/` (`docs/platform/idea-lineage.md`). Never store prompts
or transcripts. `CONTINUITY.md` holds only the current handover, under about 30 lines;
replace its lines at a handover, do not append history.
