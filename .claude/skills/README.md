# Skills

Skill catalog. `CLAUDE.md` defines which task loads each skill. Do not read the whole catalog as a mandatory checklist.

## In this repository

| Skill | Source | Changes here |
|---|---|---|
| `graph-first` | Written for this repository at the owner's request | Always consult the existing Graphify graph before source lookup; use bounded queries and verify relevant code. Has an "Exploring connections" section for cross-project reuse. |
| `project-memory` | Written for this repository at the owner's request | The four memory files, the start-of-session read, labelled decision lines and the handover. |
| `de-ai-writing` | Pasted by the owner (based on Wikipedia's *Signs of AI writing*, WikiProject AI Cleanup) | `scripts/check_ai_signs.py` was not included and is written here: it finds the pattern-matchable signs, numbered as in `references/signs.md`. |

## User-level (`~/.claude/skills/`)

The vendored third-party skills live in the owner's user-level skill directory, not in the
repository. They are MIT-licensed and keep their upstream `LICENSE`. A contributor without them
can copy the folder from upstream at the listed commit.

| Skill | Source | Commit | Changes |
|---|---|---|---|
| `ponytail` | [dietrichgebert/ponytail](https://github.com/dietrichgebert/ponytail) `skills/ponytail` | `552acd5` | Only the main skill; the hooks, status line and sub-skills are left out. |
| `frontend-design-principles` | [joshuadavidthomas/agent-skills](https://github.com/joshuadavidthomas/agent-skills) `frontend-design-principles` | `516dee7` | None. Not loaded by default since 2026-11-03: it restarts design discovery, and the direction is decided in `docs/site/design-system.md`. |
| `diagram-design` | [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design) `skills/diagram-design` | `d137637` | `references/style-guide.md` uses the portfolio's tokens and type. The 200 `assets/example-*.html` files (4.3 MB) are left out; the templates and icons are kept. |
| `taste-skill` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) `skills/taste-skill` (skill name `design-taste-frontend`) | `b482f7a` | None. Not loaded by default since 2026-11-03: its palette, typeface, eyebrow and em-dash rules conflict with `docs/site/design-system.md`; load it only when the owner asks for a critique. |
| `web-design-guidelines` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) `skills/web-design-guidelines` | `063bee9` | The rules are baked in: `references/guidelines.md` is `command.md` from [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) at `434b7f9`, and `SKILL.md` reads that file instead of fetching it. |
