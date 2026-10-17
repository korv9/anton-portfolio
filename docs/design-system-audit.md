# Design system v2 migration audit

Audited 16 October 2026 against the existing working copy. Existing unrelated changes were
retained. This migration changes presentation and documentation; it adds no dependencies.

## Baseline and dependencies

The existing Graphify index was queried first with a 1,000-token budget. It identifies
`main.tsx` as the entry point importing shared styles but does not describe CSS selector
precedence. Source inspection and a scan of all 51 stylesheets supplied that detail.

| Area                | Before                                                                                                                           | Migration                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Entry point         | `styles.css`, `pages.css`, product styles, `design-system.css`, then `tokens.css`; project CSS loaded through lazy React modules | Import order retained; semantic tokens and compatibility aliases in the existing token file                                           |
| Color roles         | Ivory, white, pastel panels and olive selection; interface styles read cluster palette names                                     | Greige canvas, secondary surface and panel; neutral selection and chart defaults; categorical cluster palette kept separate           |
| Typography          | Two Manrope font faces and a preload, Helvetica identity, monospace metadata                                                     | System Helvetica throughout the interface and canvas labels; metadata in Helvetica, code in monospace; obsolete font requests removed |
| Global overrides    | `site/editorial.css` enlarges every project heading and removes dashboard panel styles                                           | Smaller shared heading roles, compact gutters and restored panel structure; workspace-specific open figures                           |
| Navigation          | Shared header, native project-menu disclosure, breadcrumbs, topics, report tabs and project pager                                | Existing components retained, project header compacted and neutralized; no duplicate sidebar                                          |
| Reports             | Shared `ReportShell`, project-specific chart frames and high-specificity long-read selectors                                     | Existing charts and topic ordering retained; common panel, tab and metadata roles                                                     |
| Visualization stage | Three-column stage CSS despite markup placing settings below the figure; duplicate editorial overrides                           | Stage stylesheet now describes the actual full-width figure and optional two-column settings disclosure                               |
| Dark visualization  | Component-scoped `.plate`, local aliases and a decorative radial gradient in Symbol Lab                                          | Local semantic palette and aliases; gradient removed; page and global header stay light                                               |
| Controls            | Native controls, shared button states, many local focus colors                                                                   | Neutral focus tokens, consistent foreground/background pairs and existing pressed/disabled behavior                                   |
| Charts              | Party and categorical colors plus hardcoded blue defaults, olive heatmaps and tinted state comparisons                           | Party and cluster identity retained; single-measure defaults and status comparisons neutral; heatmap text contrast corrected          |
| Responsive layout   | Component-specific 320-1100px rules; existing table and figure scroll wrappers                                                   | Local breakpoints retained; shared stacking at 760px and compact header layout at 760/360px                                           |
| Accessibility       | Skip link, focus outlines, reduced motion, chart keyboard navigation, table alternatives and axe tests                           | Existing conventions retained; regression checks cover route-to-route color inheritance and isolated dark plates                      |

The shared design ownership is documented in [design-system.md](design-system.md). Existing
`DashGrid`, `ChartCard`, `Feature`, `Stage`, `ProjectHero`, `ProjectStructure` and native
controls cover the requested primitives. No parallel component library was added.

## Project coverage

| Workspace                         | Existing implementation                                             | Visual result                                                                                                |
| --------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Political Observatory             | `politik/report`, `politik/themes`, `politik/board`, `politik/dash` | Compact analytical title, neutral tabs and filters, large party-colored charts and bounded comparisons       |
| Labour Market Observatory         | `jobb`, `jobs`, shared reports                                      | Neutral time-series and comparison marks, common panels, retained topic/filter state and clustering maps     |
| Wellbeing Observatory             | `welfare`, shared reports                                           | Shared surfaces, chart titles, table metadata and neutral reference styling                                  |
| EU AI Act Observatory             | `aiact`, shared reports                                             | Neutral applicability comparison, legal-text surface, tooltips and source links; existing article navigation |
| Symbol Lab                        | `symbolic`, shared reports and stage                                | Isolated dark projection, retained cluster palette, Helvetica canvas labels and neutral external controls    |
| Philosophy Lab                    | `philosophy`, shared reports                                        | Wide projection, common metadata/controls and retained categorical series                                    |
| Concept Lab                       | `concepts`, shared reports                                          | Existing network and interaction with neutral surrounding surfaces and semantic relation colors              |
| Drug Synergy Lab                  | `products/drugcomb.css`, `mlviz.css`, report components             | Common text, chart frame and legend treatment; analytical content unchanged                                  |
| IT Incident Clustering            | `products/CaseStudies.tsx` and engineering section styles           | Technical narrative and validation remain primary; aligned full-width figures and reading measure            |
| DiVA Thesis Lakehouse             | `products/LakehousePage.tsx`, shared stage and engineering styles   | Existing architecture, pipeline, implementation and source links retained                                    |
| Homie API                         | `products/CaseStudies.tsx`, `HomieFlow`, existing project content   | Shared engineering typography, technical figures and disclosures                                             |
| Cluster Visuals                   | `clusters`                                                          | Neutral controls and surroundings with retained categorical palettes                                         |
| Project index and technical views | `projects`, `tech`                                                  | Neutral navigation, inventories, pipeline controls and model diagrams                                        |

Ask the Law is not an active application in this working copy. The retired RAG route still
redirects to the project index. No route was added or restored.

## Remaining literal colors

Literal interface colors outside the token file were removed from project stylesheets.
The exceptions are the protected homepage and its legacy About/experience rules in
`styles.css`. The chat-window gradient is an overflow mask, not a decorative background.
Party identities, cluster palettes and reviewed/candidate marks retain their data meaning.

The old `--cv-*` palette remains in `tokens.css` for categorical renderers and the protected
homepage. Existing `--page`, `--paper`, `--ink`, `--line`, `--info`, `--negative`, `--teal`
and `--orange` names are compatibility aliases, not separate themes. `--negative` is neutral
for comparisons; actual error text can use `--color-error`.

## Review and validation

The visual review covers desktop project entry pages and mobile examples from each workspace.
Screenshots and the computed-style inventory are in `artifacts/design-v2/`. The existing
accessibility suite checks 320, 768 and 1440 pixel widths. The migration adds regression
checks for all workspace categories, header size and palette inheritance after navigation.
The existing Concept Lab interaction test also covers the SVG node hit area: a node link
now receives pointer events throughout its bounds, including the gap between its dot and label.

The homepage source hashes match the pre-migration working copy. At 1440 by 1000 pixels,
the homepage name has the same bounds, 112-pixel type, 103.04-pixel line height and color as
before. The backdrop bounds and non-font computed properties also match. Its existing
text sizing formula and animation code were not edited. Other text can reflow with the
required Helvetica fallback stack.

The swap review distinguishes compact analytical headings from the identity display scale.
The squint review checks that surfaces group the charts while data remains the strongest
color. The signature is the common question/filter/chart/source sequence with room for the
labs' projections and engineering diagrams. The token review separates greige UI roles from
categorical data colors. Native focus, readable control states and reduced motion were
checked through the existing browser tests.

Backend tests need a writable pytest temporary directory on this Windows host. The default
system pytest folder rejects access; the suite passes with a workspace-local `--basetemp`.
Live-delivery tests remain opt-in and do not validate production endpoints in the default run.

Open analytical questions in [chart-review.md](chart-review.md), including chart-form and
keyboard improvements outside this visual migration, remain separate work.

## Completed checks

| Check                                                                         | Result                                           |
| ----------------------------------------------------------------------------- | ------------------------------------------------ |
| `npm run check`                                                               | Passed                                           |
| `npm run build`                                                               | Passed                                           |
| `npm run format:check`                                                        | Passed                                           |
| `npm run test:unit`                                                           | 99 passed                                        |
| Playwright suite, isolated port 5187                                          | 134 passed, 2 opt-in live-delivery tests skipped |
| `python -m pytest platform/tests -q --basetemp=artifacts/design-v2/pytest-v2` | 441 passed, 2 skipped                            |
| `git diff --check`                                                            | Passed                                           |
| Documentation prose scan                                                      | New design-system and audit copy: zero findings  |

The prose scan retains one pre-existing title-case heading in the historical chart review.
Visual artifacts and command logs remain under `artifacts/design-v2/`. Automatic approval
review rejected cleanup of the generated pytest fixtures with ?blocked by policy?; those
fixtures remain in `artifacts/design-v2/pytest-v2`.

Idea Lineage extraction was attempted as required by the repository instructions. It could
not read an existing journal entry without `created_at`; no journal entries were changed.
