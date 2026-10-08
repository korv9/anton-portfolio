# Data storytelling

The portfolio is an editorial data publication first and an analytical tool second. Every
flagship page answers in this order:

**question → answer → one main visual → interpretation → explore → method**

The first four are what everyone should read; the last two are there when someone asks for
them. Depth is never removed, only moved to the level where it belongs.

## Three levels

| Level                              | What                                                              | How it looks                                                    |
| ---------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| 1. What everyone should understand | The question, the answer, why it matters                          | Large type, short paragraphs                                    |
| 2. The evidence                    | One main chart, one comparison, one key number                    | `ChartSection`, `FindingHero`                                   |
| 3. Depth                           | Filters, tables, diagnostics, downloads, method, quality, sources | `ExploreSection` (folded), `MethodSummary`, `.story-diagnostic` |

Level 3 never competes with level 1: no grid of key figures beside the answer, no filters
before the first chart, no model metrics beside a research conclusion.

## The pieces

`frontend/src/ui/Story.tsx`, styled in `frontend/src/ui/story.css`:

- **DataQuestion**: number or eyebrow, the question, one line of context.
- **FindingHero** (major finding): a number that tells the story on its own, one sentence,
  an optional comparison and source.
- **ChartSection** (supporting finding): question, a title that states the finding, a
  subtitle with definition and period, the chart, a one-line finding and its source.
- **Interpretation**: _What this means_ in one to three short paragraphs, with an optional
  _What it does not mean_.
- **SourceCaption**: source · period · definition, quiet, under the figure.
- **ExploreSection**: folded until opened; its children render only then, so the overview
  stays light.
- **StoryNext**: where to go next, as editorial links rather than cards.
- **MethodSummary**: the lineage in one line with a link to Data Constellation, the one quality
  point that matters for the project with a link to Quality & Validity.

Data Constellation carries the engineering depth and Quality & Validity the methodology, so a
project page shows one lineage line and one quality point, not the whole platform.

## Audit of the flagships

|               | Politics `#politik`                                                                 | AI Act `#ai-act`                                             | Job market `#jobb`                                           | Symbolic Atlas `#symbolic-atlas`                                                 | Welfare `#sweden`                                            |
| ------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Kind          | Information product                                                                 | Information product                                          | Market analysis                                              | Research                                                                         | Civic statistics                                             |
| Main question | What separates the parties in practice?                                             | What applies now, to whom, and when?                         | How is demand for labour changing?                           | Can recurring symbolic meaning emerge without predefined categories?             | Which parts of Sweden do well or poorly, measure by measure? |
| Main answer   | The most divided policy area and the most and least alike pair, from the roll calls | The latest application date, what it brings, and its article | The change in new ads against the same months a year earlier | The first model clustered books, not meaning (the baseline's largest-book share) | The highest and lowest county on the chosen measure          |
| Main visual   | Polarisation per policy area                                                        | What applies now, next and the latest change                 | Ads per month                                                | The atlas map, read with a three-line key                                        | The 21 counties as small multiples                           |
| Explore       | Who votes with whom; More analyses; the theme pages                                 | Roles, startup navigator, timeline, obligations              | Growing roles, the clustering, treemap, counties, terms      | Filters, cluster panels, corpus explorer, experiments                            | Headline values, county table, indicator explorer            |
| Method        | Sources, method and data quality (folded); `#politik-kallor`                        | `#ai-act-sources`                                            | `#jobb-kallor`                                               | Method with diagnostics (trustworthiness, silhouette, noise, membership)         | Data quality (folded), pipeline status, data model           |
| Validity note | Figures keep their source and definition                                            | Derived obligations stay traceable to the official text      | Ads are a proxy for demand, not the labour market            | Good clusters did not at first mean symbolic meaning                             | Relationships are descriptive only                           |

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
