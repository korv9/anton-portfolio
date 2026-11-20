---
name: project-memory
description: How a session starts, how decisions are recorded and how it hands over. Use at the start of any substantial task in this repository, when the owner changes a direction, scope, priority or earlier decision, and when finishing or handing over work.
---

# Project memory

Four files, one owner each. Facts live in one place; the others link to it.

| File | Owner | Holds | Changed by |
|---|---|---|---|
| `PROJECTS.md` | Anton | what each project is, its status, next step, blockers, delete zone | the agent, only when Anton asks in the conversation |
| `CONTINUITY.md` | the agent | where work stands now, under about 30 lines | the agent, at a handover; lines are replaced, not appended |
| `docs/decisions/DECISIONS.md`, `docs/decisions/DATA_DECISIONS.md`, `docs/idea-lineage/` | generated | decisions and history from the Idea Lineage journal | `npm run ideas:build`; never by hand |
| `docs/site/design-system.md` | Anton | the design rules in force | the agent, when a design decision is recorded in the journal |

## Start of a session

1. Read `PROJECTS.md` for the project the task concerns, then `CONTINUITY.md`.
2. Read `docs/idea-lineage/<project>.md` for its active decisions and open questions.
3. Verify the lines you rely on against the code (`git status`, the files named) before
   building on them. If `PROJECTS.md` and the code disagree, say so in the answer; do not
   edit the line.

## During work

When Anton changes a direction, scope, priority, model choice, data rule, design rule or an
earlier decision, end the answer with labelled lines that restate it, with Anton as the source:

```
Beslut (Anton): Symbol Lab is an experiment, not a flagship. Ersätter decision-2026-10-07-004.
Idé (Anton): Konstellationer can reuse the atlas renderer.
Fynd: The runner is deterministic; local versus runner is the drift.
Öppen fråga: Which machine decides champion promotion?
```

English labels work too (`Decision:`, `Idea:`, `Finding:`, `Open question:`, `Rejected:`,
`Implementation:`). Hedged wording is stored as an idea with certainty `proposed`. Name the
project in the line when the answer covers several. Routine fixes, confirmations and
explanations get no labelled line and leave no trace.

The Stop hook in `.claude/settings.json` runs `platform/idea_lineage/hook.py` on the final
answer: it appends the labelled items and rebuilds the generated views. It reads the assistant's
last message only, never the user's. Where hooks do not run, run `npm run ideas:extract --
--input answer.txt --apply` and `npm run ideas:build` yourself. If the hook reports a skipped
duplicate, repeat the item in the next answer with a `supersedes` reference if it is a change.

A change to `PROJECTS.md` happens only on Anton's request in the conversation ("uppdatera
projektläget", a new status or next step). Show the changed lines in the answer.

## Handover

Before stopping: replace the `Now`, `Uncommitted elsewhere` and `Blocked` lines of
`CONTINUITY.md` with the current state, dated, with a provenance tag (`[CODE]`, `[TOOL]`,
`[USER]`, `[USER-PENDING]`). Delete lines about finished work. Do not add history: a decision
belongs in the journal, a receipt in the implementation reference of its event.

If a save fails (the hook prints a failure, or `ideas:extract` refuses), say so in the answer
and leave the labelled lines in place so the next session can record them.

## What is recorded, and what is not

Recorded: decisions, ideas, hypotheses, experiments, findings, open questions, rejections and
implementations, as short events with a reason and a reference. Never: prompts, user messages,
transcripts, hidden reasoning, secrets, private profiles. The journal is public by default and
committed; `--private` keeps an event out of the repository.
