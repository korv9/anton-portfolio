# Idea Lineage

Data lineage says where data came from; Idea Lineage says why the system became what it is: the
ideas, decisions, tests, findings, rejections and open questions, as short dated events. There
are no due dates, streaks or scores, and none should be added.

**Stored:** a title (at most 140 characters), an optional summary, reason, project ids, tags,
importance, certainty, links to other events and implementation references (commit, PR, files,
run). An extracted event keeps the SHA-256 of the answer it came from, never the answer.
**Never stored:** prompts, user messages, full answers, transcripts, hidden reasoning or tool
traces. The schema (`platform/idea_lineage/schema.py`) is a closed list of keys, free text is
capped at 600 characters, and `platform/tests/idea_lineage` fails if a forbidden key slips in.

**The journal is append-only.** One JSON line per event, one file per day: public events in
`.idea-lineage/public/journal/` (committed, the default since 2026-11-03), private ones in the
git-ignored `.idea-lineage/journal/` (`--private`; `IDEA_LINEAGE_HOME` moves it). A line is never
edited. A change is a new event that `supersedes`, `rejects`, `answers` or `evolved_from` an
older one, and the views derive the older event's effective status from it.

**Capture.** The Stop hook (`.claude/settings.json` → `platform/idea_lineage/hook.py`) reads only
the final assistant message, passes it to `extract.py` in auto mode with UTF-8 pipes and rebuilds
the committed views. The extractor takes only marked items: an `idea-lineage` JSON block,
labelled lines (`Decision:`, `Finding:`, `Open question:`, `Beslut (Anton):`, `Fynd:`,
`Öppen fråga:` …) or bullets under such a heading. Hedged decisions become proposed ideas; a
finding without a number is tentative. Repeats within 30 days (token Jaccard ≥ 0.8) are skipped;
conversation exports are refused.

| Command | Does |
|---|---|
| `npm run ideas:extract -- --input answer.txt [--apply]` | Review, then append, the marked items of one answer |
| `npm run ideas:add -- --type idea --project <id> --title "…"` | Add one event by hand (`--by-owner`, `--private`) |
| `npm run ideas:build` | Rebuild every view from the journal |
| `npm run ideas:search -- "…"`, `ideas:history -- <project>`, `ideas:why -- "…"` | Search, a project's history, the links back to an origin |

**Views.** From public events only: `docs/decisions/DECISIONS.md` (decisions in force with the
steps decided → implemented → verified), `docs/decisions/DATA_DECISIONS.md` (those tagged data,
data-quality, validity or lineage) and `docs/idea-lineage/<project>.md`. The private home holds
the full state per project, `context.json` for agents, a diary per day (`npm run ideas:diary`),
weekly digests and a DuckDB model. `frontend/public/data/idea-lineage/events.json` carries public
events and the links between them only.

**Limits.** Unmarked prose records nothing, duplicate detection is lexical, projects are found by
name, and an event cannot change visibility after it is written.
