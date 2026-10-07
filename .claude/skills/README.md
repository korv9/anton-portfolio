# Skills

Agent skills this repository follows. `CLAUDE.md` at the root says when each applies. All
three that come from repositories are MIT-licensed and keep their upstream `LICENSE`.

| Skill | Source | Commit | Changes here |
|---|---|---|---|
| `ponytail` | [dietrichgebert/ponytail](https://github.com/dietrichgebert/ponytail) `skills/ponytail` | `552acd5` | Only the main skill; the hooks, status line and sub-skills are left out. |
| `frontend-design-principles` | [joshuadavidthomas/agent-skills](https://github.com/joshuadavidthomas/agent-skills) `frontend-design-principles` | `516dee7` | None. |
| `de-ai-writing` | Pasted by the owner (based on Wikipedia's *Signs of AI writing*, WikiProject AI Cleanup) | – | `scripts/check_ai_signs.py` was not included and is written here: it finds the pattern-matchable signs, numbered as in `references/signs.md`. |
| `diagram-design` | [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design) `skills/diagram-design` | `d137637` | `references/style-guide.md` uses the portfolio's tokens and type. The 200 `assets/example-*.html` files (4.3 MB) are left out; the templates and icons are kept, and the examples can be browsed upstream. |

To update one, copy the folder from upstream again, keep the changes listed above, and update
the commit.
