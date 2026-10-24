# Data storytelling

The portfolio is an editorial data publication first and an analytical tool second. Every
flagship page answers in this order:

**question → answer → one main visual → interpretation → explore → method**

The first four are what everyone should read; the last two are there when someone asks for
them. Depth is never removed, only moved to the level where it belongs.

## Three levels

| Level | What | How it looks |
|---|---|---|
| 1. What everyone should understand | The question, the answer, why it matters | Large type, short paragraphs |
| 2. The evidence | One main chart, one comparison, one key number | `ChartSection`, `FindingHero` |
| 3. Depth | Filters, tables, diagnostics, downloads, method, quality, sources | `ExploreSection` (folded), `MethodSummary`, `.story-diagnostic` |

Level 3 never competes with level 1: no grid of key figures beside the answer, no filters
before the first chart, no model metrics beside a research conclusion.

## The pieces

`frontend/src/ui/Story.tsx`, styled in `frontend/src/ui/story.css`:

- **DataQuestion**: number or eyebrow, the question, one line of context.
- **FindingHero** (major finding): a number that tells the story on its own, one sentence,
  an optional comparison and source.
- **ChartSection** (supporting finding): question, a title that states the finding, a
  subtitle with definition and period, the chart, a one-line finding and its source.
- **Interpretation**: *What this means* in one to three short paragraphs, with an optional
  *What it does not mean*.
- **SourceCaption**: source · period · definition, quiet, under the figure.
- **ExploreSection**: folded until opened; its children render only then, so the overview
  stays light.
- **StoryNext**: where to go next, as editorial links rather than cards.
- **MethodSummary**: the lineage in one line and the one quality point that matters for the
  project, with optional links.

A project page shows one lineage line and one quality point, not the whole platform. The Data
Constellation and Quality pages that held the depth were retired; their addresses lead to
`#projekt`.

## Audit of the flagships

The audit originally also covered the Politics, AI Act, Job market and Welfare pages; those
pages were withdrawn on 2026-10-21.

| | Symbolic Atlas `#symbolic-atlas` |
|---|---|
| Kind | Research |
| Main question | Can recurring symbolic meaning emerge without predefined categories? |
| Main answer | The first model clustered books, not meaning (the baseline's largest-book share) |
| Main visual | The atlas map, read with a three-line key |
| Explore | Filters, cluster panels, corpus explorer, experiments |
| Method | Method with diagnostics (trustworthiness, silhouette, noise, membership) |
| Validity note | Good clusters did not at first mean symbolic meaning |

## Rules

- A large number only when the number tells the story; diagnostics go under Method.
- One question, one main visual; supporting charts go below, under Explore or on a deep-dive
  page.
- Chart titles state a finding; the subtitle gives definition, denominator and period.
- Every primary figure has its source, period and definition in a caption.
- Filters sit directly above the chart they change and every page has a meaningful default.
- Research pages (Symbolic Atlas, Philosophy Atlas, Concept Constellation) show question,
  experiment, finding, validity and limitations, negative findings included; information
  products show current state, navigation, exploration and source.
- Deep links keep working: earlier views become deep dives, never dead addresses.
