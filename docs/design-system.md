# Portfolio design system v2

A warm-grey analytical workspace for recruiters, hiring managers and readers exploring the
projects. The interface provides structure; charts, networks and source material provide
meaning. The homepage retains its existing composition and palette, with Helvetica applied.

## Tokens and type

`frontend/src/tokens.css` is the only token definition file. `main.tsx` imports it after the
base and shared styles. Project styles reference these tokens, including when loaded lazily.
Semantic names are available to new code; existing aliases resolve to the same values.

| Role                             | Token                    | Value     | Existing aliases                  |
| -------------------------------- | ------------------------ | --------- | --------------------------------- |
| Canvas                           | `--color-canvas`         | `#F1EFE7` | `--page`, `--paper-strong`        |
| Navigation and secondary surface | `--color-surface`        | `#E2DFD6` | `--paper`, `--wash`, `--side`     |
| Panel and selected field         | `--color-panel`          | `#CECBC2` | `--surface`, `--select`           |
| Separator                        | `--color-border`         | `#A9A69D` | `--line`                          |
| Control edge                     | `--color-border-control` | `#858279` | `--line-strong`                   |
| Main text                        | `--color-ink`            | `#363636` | `--ink`, `--accent`, `--focus`    |
| Secondary text                   | `--color-ink-secondary`  | `#57554E` | `--muted`, `--ink-faded`          |
| Inverse text                     | `--color-ink-inverse`    | `#F1EFE7` | `--on-accent`                     |
| Neutral data                     | `--color-chart-neutral`  | `#484848` | `--ink-2`, `--info`, `--series-1` |
| Inactive data                    | `--color-chart-muted`    | `#96938C` | `--subtle`, `--stone`             |

Secondary text is darker than the initial reference `#66645F`: that reference fails 4.5:1
on the secondary surface. `#57554E` also passes on the darker panel. Inactive data and
separator colors are not body-text colors. Native control borders use the stronger edge.

Helvetica uses the system stack `"Helvetica Neue", Helvetica, Arial, sans-serif`.
There are no downloaded Helvetica files or Manrope font requests. Arial is the fallback
where Helvetica is unavailable. Body is regular, controls and chart titles medium, headings
selectively semibold. Metadata also uses Helvetica. Code uses the system monospace stack.
Charts, tables and metrics use tabular figures.

| Type role                   | Token                            |
| --------------------------- | -------------------------------- |
| Display, protected homepage | `--type-display`                 |
| Page title                  | `--type-page-title`              |
| Section title               | `--type-section-title`           |
| Chart title                 | `--type-chart-title`             |
| Body                        | `--type-body`                    |
| Label                       | `--type-label`                   |
| Caption                     | `--type-caption`                 |
| Metric                      | `--type-metric`                  |
| Technical metadata          | `--type-metadata`, `--font-meta` |
| Code                        | `--type-code`, `--font-mono`     |

The `--h*`, `--fs-*` and dashboard names remain compatibility roles. The display scale is
reserved for identity; analytical page titles use the smaller page scale.

## Composition and ownership

The existing React components form the system. Add a component only when the existing
primitive cannot express the interaction. Use native links, buttons, selects and disclosures.

| Responsibility                             | Existing implementation                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| App shell and workspace identity           | `App.tsx`, `.site-shell`, `data-workspace`                                    |
| Global header and project menu             | `site/SiteHeader.tsx`, `site/header.css`                                      |
| Breadcrumbs and project pager              | `site/Header.tsx`, `site/site.css`                                            |
| Project and section navigation             | `projects/ProjectStructure.tsx`, `projects/topics.ts`                         |
| Content and workspace alignment            | `site/editorial.css`, `.ds-container`                                         |
| Project header and section header          | `ui/Project.tsx`, `ProjectHero`, `ProjectSection`                             |
| Dashboard grid and panel                   | `ui/dash/Dash.tsx`, `DashGrid`, `ChartCard`                                   |
| Analytical chart, header, source and table | `charts/feature/Feature.tsx`, `Feature`                                       |
| Visualization stage                        | `ui/Stage.tsx`, `Stage`, `StageBlock`, `StageFacts`                           |
| Metrics and tables                         | `KpiRow`, `Feature` table alternatives and existing native `.dk-table` tables |
| Ranked comparison and time series          | `charts/RankBars.tsx`, `MultiLineChart.tsx`, `TimeSeriesChart.tsx`            |
| Filter bar and select                      | `Pick`, `report-chips`, `SlicerSelect` and existing project filters           |
| Disclosure                                 | `ui/Disclosure.tsx`, native `details` for local methodology                   |
| Loading, empty and error states            | Existing data-page states, `site/PageBoundary.tsx`                            |

Shared layout rules live in `site/editorial.css`. Chart and stage internals live in their
own stylesheets. `tokens.css` supplies tokens, shared control states and the scoped plate.
Do not add a second theme or an override sheet for individual projects.

Dashboard grids have twelve columns; a full-width chart spans all twelve. Gutters are fluid
between 16 and 28 pixels. Project sections use `--sp-section`; local gaps use `--sp-1`
through `--sp-7`. Charts have no global maximum width. Prose keeps a 68-character measure.
Panels use thin borders, a 2-pixel radius and no elevation shadow. Navigation is compact.

## Four workspace patterns

`App` derives `data-workspace` from the existing registry groups. Changing visual layout
does not change routes, analytical calculations, topic order or data loading.

| Pattern          | Projects                                                 | Composition                                                                                                                       |
| ---------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Observatory      | Political, Labour Market, Wellbeing, EU AI Act           | `ReportShell` and existing deep views; compact question, topic tabs, contextual filters, wide primary chart and supporting panels |
| Lab              | Symbol, Philosophy, Concept, Drug Synergy                | Report tabs where already present; full-width maps, compact controls, legends and optional method/settings disclosures            |
| Engineering      | IT Incident Clustering, DiVA Thesis Lakehouse, Homie API | `ProjectHero`, project sections, architecture and pipeline figures, validation, results and code links                            |
| Interactive tool | Cluster Visuals                                          | Primary visualization and its controls; no added metric row                                                                       |

Ask the Law has no active route in the current site. The retired RAG address redirects to
the project index. A future focused application can use the tool pattern without restoring
retired functionality as part of this migration.

The existing section-navigation model replaces a sidebar. Do not introduce a second global
navigation hierarchy. Engineering content keeps its existing structure; metrics appear only
where the report already uses them.

## Data color and dark plates

Party identities remain in `parties/identity.tsx` and render without an interface color tint.
Categorical cluster palettes retain their values. The `--cv-*` names now belong to the
cluster palette and the protected homepage, not the project interface. Other categorical
series use `--series-1` through `--series-5` with labels and existing marks or legends.

Single-measure charts use neutral ink. Changes, vote kinds and applicability states do not
imply green or red success. Source labels, selected controls and chart defaults use neutral
tokens. Actual error messages can use `--color-error` and must include readable text.

Heatmaps retain their values, order and scales. Pale ramps stop before dark text loses
contrast; dark cells use inverse text. The technical stage inventory uses the same principle.
Existing analytical review items remain in [chart-review.md](chart-review.md).

`.plate` provides a component-scoped dark canvas (`#242422`) and locally rebinds semantic
colors, compatibility aliases and chart aliases. It does not change the page or navigation.
Canvas renderers read the local computed typography and colors. Symbol Lab retains its dark
projection; surrounding controls and content follow the warm-grey page. No decorative
radial gradient remains. Meaningful architecture-layer colors are not interface accents.

## Controls, accessibility and responsiveness

Use `.btn` for the primary action, `.btn-quiet` for an outlined action and `.btn-text` for a
text action. Existing filter groups share hover, pressed, disabled and focus states. A
selected text filter uses weight and an underline; a segmented control can use ink fill.
The dark foreground and light inverse text must travel together on filled controls.

Inputs have explicit foreground and background colors. Focus has a visible 2-pixel outline.
Existing skip links, chart keyboard navigation, table alternatives, accessible labels and
native disclosures are retained. Reduced motion disables transitions and reveal animations.

At 760 pixels shared workspace panels stack; component-specific chart breakpoints retain
local scrolling where detail cannot shrink. The header condenses at 760 pixels and stacks
its links at 360 pixels. Project topic links wrap. Wide tables scroll inside their wrappers.
No page-level horizontal overflow is allowed at 320, 768 or 1440 pixels.

## SWEDEN

The SWEDEN pages are one exception to the single token file. Their tokens are scoped to
`.sweden` in `frontend/src/sweden/sweden.css`, they follow `prefers-color-scheme`, and their
scene panels may use translucency. Nothing in that file reaches `.home-shell` or the other
projects. [sweden-design.md](sweden-design.md) is the reference for these pages.

## Protected homepage

`:root:has(.home-shell)` in `tokens.css` retains the homepage's original legacy token values,
including its palette, heading scales, section spacing and weights. The sans stack changes
to Helvetica. Project header changes are scoped to `.project-shell`. No homepage source,
text positioning, sizing formula or animation timing is changed by this migration.

## Validation

`frontend/tests/design-system.spec.ts` checks navigation through every workspace type,
Helvetica, page and header colors, header height, the protected homepage name composition
and the boundary around a dark plate. Existing accessibility tests run axe on the main
pages, check overflow at three widths, keyboard focus and reduced motion. The broader
Playwright suite checks the retained interactions and analytical contracts.

See [design-system-audit.md](design-system-audit.md) for the migration inventory and review.

## Political workspace integration

Political Observatory v2 reuses this token system and existing `Feature`, chart, control
and party-identity components. `politik/workspace/workspace.css` owns its twelve-column
layout, neutral position symbols, compact navigation and local matrix scrolling. No new
global tokens or homepage styles were introduced. See [workspace implementation](political-observatory-v2.md).
