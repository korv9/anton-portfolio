# Idea Lineage

Data lineage explains where data came from. Idea Lineage explains why the system became what it
is: which ideas appeared, what was decided and why, what was tested, what was learned, what was
set aside and what is still open.

It records how thinking changes without slowing it down. An idea is material, not an obligation:
there are no due dates, streaks, completion rates or productivity scores, and none should be
added.

Three things with similar names do different jobs. Data Constellation shows how data moves through
the platform. Concept Constellation shows how ideas appear across corpora (stories, philosophy,
politics, law). Idea Lineage shows how the project's own ideas and decisions evolved over time.

## What is stored, and what never is

Stored: short structured events. Each has a title (at most 140 characters), an optional summary
of one to four sentences, an optional reason, project ids, tags, an importance, a certainty and
links to other events. It can also carry experiment fields (question, hypothesis, method,
result, interpretation, limitations) and implementation references (commit, PR, files, route,
artifact, run, dataset). A source note says whether the event was entered by hand or extracted
from an answer. For an extracted answer, the note keeps the SHA-256 of that answer and the date,
never the answer itself.

Never stored: prompts, user messages, full assistant answers, transcripts, hidden reasoning, tool
traces or scratchpads. The schema is a closed list of keys. Keys such as `prompt`,
`user_message`, `conversation`, `raw_response` and `chain_of_thought` are refused at any depth,
and every free-text field is capped at 600 characters. `platform/tests/idea_lineage` fails if
one slips through.

## Event model

```yaml
id: decision-2026-10-07-006 # <type>-<date recorded>-<NNN>, readable and unique
created_at: 2026-10-07T15:20:00+00:00
occurred_on: 2026-10-07 # optional: when it happened, if not when recorded
type:
  decision # idea | decision | hypothesis | experiment | finding | question
  # (also rejection | implementation | observation)
title: Open the concept layer with Concept Journey
summary: >
  Follow one concept at a time through stories, philosophy, Riksdag speeches and the AI Act.
reason: A reader can follow one idea more easily than read the whole constellation.
projects:
  [concept-constellation, symbolic-atlas, philosophy-atlas, politics, ai-act]
tags: [concepts]
importance: major # minor | normal (default) | major
status: active # as written; see "effective status" below
certainty: confirmed # proposed | tentative | confirmed
visibility: public # private (default) | public
relations: { supersedes: [idea-2026-10-04-003] }
inferred_relations: { related_to: [idea-2026-10-05-002] } # suggested, never presented as certain
implementation: { commit: 278a788 }
source: { kind: manual, session_date: 2026-10-07 }
```

Only `id`, `created_at`, `type` and `title` are required. Project ids are the ones in
`frontend/src/projects/projectRegistry.ts`, plus `portfolio` for work on the site as a whole.

A relation on event E reads "E _relation_ target", and new events point at older ones:
`inspired_by`, `evolved_from`, `supersedes`, `replaces`, `contradicts`, `tests`, `supports`,
`rejects`, `implements`, `answers`, `results_from`, `applies_to` and `related_to`. The passive
forms (`evolved_into`, `tested_by`, `supported_by`, `rejected_by`, `implemented_as`,
`resulted_in`) are accepted and read the other way. Links need not form a tree. Every target must
exist when the event is written.

## The journal is append-only

```
.idea-lineage/journal/2026-10-07.jsonl          private, git-ignored
.idea-lineage/public/journal/2026-10-07.jsonl   public, committed
```

One JSON line per event, one file per day. A line is never edited. When a direction changes, a
new event says so (`supersedes`, `rejects`, `answers`, `evolved_from`), and the views derive the
earlier event's _effective status_ from it: superseded, abandoned, answered or evolved. An append
writes nothing unless every event in the batch passes validation and has an unused id.

Because this repository is public, private events never enter it: `.idea-lineage/*` is
git-ignored except `public/`. Set `IDEA_LINEAGE_HOME` to keep the private journal somewhere
durable, such as a private repository. A cloud session's container is discarded, and the default
home goes with it.

## Capturing events

From a final answer, never a conversation:

```bash
npm run ideas:extract -- --input answer.txt          # review: shows candidates, writes nothing
npm run ideas:extract -- --input answer.txt --apply  # appends them
IDEA_LINEAGE_MODE=auto npm run ideas:extract < answer.txt
```

The extractor favours precision over recall and takes only what an answer marks itself:

- a fenced `idea-lineage` block holding JSON events;
- labelled lines: `Decision:`, `Idea:`, `Hypothesis:`, `Experiment:`, `Finding:`,
  `Open question:`, `Rejected:`, `Implementation:`, `Observation:`, with Swedish equivalents
  such as `Beslut:`, `Idé:`, `Fynd:`, `Öppen fråga:` and `Avfärdat:`;
- bullets under a heading with one of those names (`## Decisions`, `### Öppna frågor`).

It does not mine prose. It never makes a claim stronger than the wording:

- A "decision" with hedges ("could", "would", "maybe", "kanske", "skulle") is stored as an idea
  with certainty `proposed`.
- A finding without a number is `tentative`.
- Text after "because" or "eftersom" becomes the reason.

Projects are found by name, for example "Symbolic Atlas", "AI Act" or "Concept Journey". When an
item names none and the whole answer names exactly one, that project is used; `--project` sets it
explicitly.

It does not record every answer. An answer without marked items records nothing, so
confirmations, routine fixes and explanations leave no trace.

Input that looks like a conversation export (speaker turns, or a JSON `messages` or `role`
array) is refused.

Duplicates:

- The answer's SHA-256 stops the same answer being extracted twice.
- An item that matches an event of the same type from the last 30 days is skipped. The match is
  a token Jaccard of at least 0.8 over title and summary.
- A near match (0.5 to 0.8) is kept and linked to the earlier event as an inferred `related_to`.

History is never merged.

By hand:

```bash
npm run ideas:add -- --type idea --project symbolic-atlas --title "Test translator centring"
npm run ideas:add -- --type finding --project symbolic-atlas --title "…" --results-from experiment-2026-10-07-002 --commit efe3595
```

`add.py` suggests earlier events with similar titles but never blocks saving. `--public` writes
to the public journal.

## Views (derived, rebuilt whole)

`npm run ideas:build` rebuilds every view from the journal. `ideas:state`, `ideas:diary` and
`ideas:export` rebuild one each. Each Markdown file begins with "Generated from the Idea Lineage
journal. Do not edit".

| File                                            | What it holds                                                                                                                                                                                                                |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state/<project>.md`                            | Current direction (the latest of the project's own decisions, a major one first), active decisions, hypotheses, experiments, latest findings, open questions, ideas, and what was superseded or set aside and by which event |
| `state/portfolio.md`                            | Portfolio-wide direction, projects with lineage, themes shared by tag across projects, recent major decisions, cross-project connections, open cross-project questions                                                       |
| `context.json`                                  | Per project: active decisions, hypotheses, open questions and recent findings (ids and titles), for an agent to read before substantial work                                                                                 |
| `diary/<date>.md`                               | One readable page per day an event happened (`occurred_on`, else recorded)                                                                                                                                                   |
| `digests/<year>-W<week>.md`                     | The same for a week                                                                                                                                                                                                          |
| `idea_lineage.duckdb`                           | `dim_event`, `dim_project`, `dim_tag`, `fact_relation`, `bridge_event_project`, `bridge_event_tag` for descriptive analysis                                                                                                  |
| `frontend/public/data/idea-lineage/events.json` | Public events only, publishable fields only, links only between public events                                                                                                                                                |

## Questions

```bash
npm run ideas:search -- "construct validity"     # TF-IDF over title, summary, reason, tags
npm run ideas:history -- symbolic-atlas          # dated, with linked events
npm run ideas:why -- "book centring"             # walks the links back to the origin
```

```
WHY (book centring)
  2026-10-05  Finding: Book-centring cut the largest-book share from 74 % to 57 %
  ↓ results from
  2026-10-05  Experiment: Four deconfounding variants on one shared sample
  ↓ implements
  2026-10-05  Decision: Centre the embeddings by book before clustering
  ↓ inspired by
  2026-10-05  Hypothesis: Book identity confounds the representation
  ↓ inspired by
  2026-10-05  Finding: The baseline clusters followed books, not symbols
  ↓ results from
  2026-10-05  Idea: Map symbol words in myth and folklore without predefined meanings
```

## Public and private

Every event is private unless written with `--public` or `visibility: public`. The exporter
reads only public events and drops `visibility` and `source`. It also drops any link to a
private event, so a public page cannot reveal that a private one exists. The public journal in
this repository holds the Symbolic Atlas lineage from its published results (research history,
commits 5 to 7 October 2026), the Concept Journey decision and the decision to keep this journal.

## The page

`#idea-lineage` (experimental, linked from the footer under the hood) reads only
`idea-lineage/events.json` and shows one view at a time:

- The timeline puts events by date on a thin thread, one shape per kind (an open circle for an idea, a
  filled square for a decision, a diamond for a hypothesis, a triangle for an experiment, a
  filled circle for a finding, a dashed circle for a question). Each event lists its stored
  links. "Why does this exist?" keeps only the events it came from, following those links back
  to the origin. Filters: project and kind.
- Projects now gives the current direction, active decisions, latest findings and open
  questions per project, derived the same way as the state files (`frontend/src/lineage/logic.ts`).
- Set aside lists the ideas and decisions a later event superseded or rejected, with that event's
  reason.

There are no counters, scores or due dates.

## For agents

Before substantial work on a project, read `.idea-lineage/state/<project>.md` or `context.json`.
After substantial conceptual work, write the answer's decisions, ideas, findings and open
questions as labelled lines, then run `npm run ideas:extract` on that final answer. Tiny fixes
need neither. Nothing runs automatically; extraction is something you do, so it is always
visible.

## Relation to Allegoria

The design borrows from Allegoria's own records. Like `DATA_DECISIONS.md`, decisions are
append-only and a change is a new entry that supersedes the old one. Like its `predictions/`,
expectations are written as hypotheses before results. Its `[inferred]` labels become inferred
relations. No Allegoria file is moved or read automatically; an Allegoria decision can be
recorded here as an event with `--project allegoria` and a reference.

## Known limitations

- The extractor relies on answers marking their items. Unmarked prose records nothing, by design.
- Duplicate detection is lexical; two phrasings of one idea can both be kept, linked as related
  at best.
- Project detection is by name and alias, so an unnamed project needs `--project`.
- An event cannot change visibility after it is written. To publish a private idea, write a new
  public event; the private one stays where it is.
- In a cloud session the private journal is lost with the container unless `IDEA_LINEAGE_HOME`
  points somewhere durable.
