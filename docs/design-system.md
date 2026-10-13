# Design system

An ivory editorial canvas outside, focused analytical worlds inside. The page background
is #F4F0E6, sampled from the supplied reference. Butter yellow, pistachio, oat, powder pink
and muted apricot distinguish panels; deep olive marks selected controls. Text stays
near-black. Party identity colours are preserved, and large maps can use a dark plate.

`frontend/src/tokens.css` is the one place the tokens are defined. It loads after every
other stylesheet, so a component that reads a token follows it everywhere. There is no
second theme file.

## Type

- **Manrope** for body text, navigation and section headings, self-hosted as variable WOFF2 (`/fonts/manrope-latin.woff2`, 29 kB, preloaded, with
  `manrope-variable.woff2` for any other character;
  weights 200–800). The SIL Open Font License is kept at `frontend/public/fonts/Manrope-OFL.txt`.
- **Helvetica Neue / Helvetica** (`--font-identity`, weight 700) for the homepage name,
  with Arial as the fallback on devices without Helvetica installed.
- **System monospace** (`--font-mono`) for figures, metadata, eyebrows and code.
- Weights: body 470, interface 560, headings 700.
- Scale: `--display-xl`, `--display-l`, `--h1`, `--h2`, `--h3`, `--body-large`, `--body`,
  `--small`, `--caption`; reading measure `--measure: 68ch`. The older `--fs-*` names map
  onto the same scale.
- Figures are tabular everywhere.

The homepage name uses Helvetica; project introductions use Manrope. Project
pages use open chart surfaces with generous section spacing. A shared header contains
the project menu; topics and section links sit inside the selected project. Inventory
counts belong with their dataset, and are not repeated as a KPI row on every view.

## Colour

| Token                        | Light page            | Plate                    | Use                         |
| ---------------------------- | --------------------- | ------------------------ | --------------------------- |
| `--page`                     | `#F4F0E6`             | `#0F0F10`                | the background              |
| `--paper` / `--paper-strong` | `#F4F0E6` / `#FFFFFF` | `#1A1A1C` / `#232326`    | surfaces, inputs            |
| `--ink`                      | `#0F0F10`             | `#F2EFE9`                | text                        |
| `--muted`                    | `#4A4A4D`             | `#A8A49B`                | secondary text              |
| `--subtle`                   | `#6B6B6E`             | `#8A8A8D`                | rules and marks, never text |
| `--line` / `--line-strong`   | ink at 16 % / 42 %    | off-white at 16 % / 38 % | rules, control edges        |
| `--accent` / `--on-accent`   | `#555B45` / ivory     | off-white / ink          | what is chosen or current   |
| `--info`, `--negative`       | `#555B45`, `#8F3424`  | `#8BBDE3`, `#EC8A74`     | meaning, never decoration   |
| `--series-1` … `--series-5`  | five series hues      | same                     | charts with categories only |

Pale chart fills keep labels and values alongside them. Every main page is checked by
axe in `frontend/tests/accessibility.spec.ts`.

Party colours are unchanged and come from `frontend/src/parties/identity.tsx`.

### Dark plates

`.plate` redefines the same tokens for its subtree, so a component inside reads its colours
from the tokens and needs no theme of its own. `Stage` is light unless it is given `dark`;
only the Symbolic Atlas map asks for it. Component aliases such as `--stage-ink` or `--c-muted` are declared
again inside `.plate`, because a custom property set on an outer element keeps the outer
value.

On the Symbolic Atlas the clusters are muted hues on the plate. In the book views, other
clusters are grey, cross-book candidates stone (`#C9C2B6`) and reviewed clusters off-white,
with a key beside the map. The Data Constellation sits on the light page. It keeps bronze, silver and gold tones for
the medallion layers and draws everything else in greys; each layer also has its own mark
shape, so colour is never the only cue.

## Shape and space

Corners are 0–4 px (`--radius: 2px`); circles stay circles. There are no decorative shadows,
gradients or blur; an inset rule may mark a party or a current item. Space follows
`--sp-1` … `--sp-7` and the fluid `--gutter`; `--sp-section` is the gap between the start
page's screens and a project's sections.

Pages, sections and dashboards fill the screen; only running text keeps a measure:

| Token              | Width | Use                                          |
| ------------------ | ----- | -------------------------------------------- |
| `--layout-wide`    | none  | the page frame, charts and maps              |
| `--layout-content` | none  | a section's content, the project hero        |
| `--layout-reading` | 68ch  | running text, the hero's summary and finding |

## Page primitives

The header groups projects into Observatories, Labs and Engineering. Cluster Visuals is
a separate tool. Observatory overviews link to themed analysis pages. Labs keep related
material in a continuous report with section addresses; readers for individual passages,
debates and articles remain separate.

- `ProjectsPage` (`#projekt`) lists every project on one screen in three rows, Engineering,
  Observatories and Labs; the start page keeps its own text list of the same groups. A card is a picture, the name and the kind of work; a project
  without an `image` in the registry shows its group's colour panel.
- `ProjectStructure` owns topic navigation and section scrolling after data arrives.
- `ProjectHero` introduces a project with its name, question and short description.
- `ProjectDepth` contains method, sources and documentation rather than repeated copy.
- Charts use open page surfaces. Native disclosures contain optional technical detail.
- `Stage` gives a projection its reading key and groups data/settings below the figure.

See [project-restructure.md](project-restructure.md) for retained and removed views.

## Charts

A few forms, used everywhere, so a reader learns them once (`frontend/src/charts/`):

- `RankBars`: the one bar chart. Categories ranked as horizontal bars, the label on the left
  and the number written out on the right. It diverges around zero when a value is negative,
  takes a party's colour only for a party, fades the other rows when one is picked, and shows
  a "Show all" button past a limit. Built in HTML, so labels wrap on a phone.
- `MultiLineChart`: change over time, one line per series, labelled at the end.
- `Feature` (`charts/feature/`): the frame around a main chart. The title states the finding;
  a lead, the controls, a table view and the source sit around the chart.
- `Heatmap` and the poll trend keep their own forms where a grid or a trend is the answer.

Maps and networks (Data Constellation, the job-ad clusters, the concept and philosophy maps)
draw in greys with one focus: the picked item in ink or in the accent, everything else
receding. Category hues come from `--series-1` to `--series-5`, in that order and never
cycled; they pass the dataviz palette validator on the page, the paper and the plate. A scatter
or map where any two groups can touch uses the first three, with `--ink-2` as a fourth.

## Buttons and filters

One system, in `tokens.css`:

- `.btn`: primary, ink filled. One per view, the main action.
- `.btn-quiet`: secondary, an outline.
- `.btn-text`: a text action, underlined.
- Chip groups (`.atlas-chips`, `.constellation-chips`, `.aa-filters` and the other groups
  listed in `tokens.css`): filters and toggles, pressed when chosen. Toggles that switch
  layers on and off (the constellation's layers, the concept relations) stay light when
  pressed, because most of them are on at once.

Every control has the same states: hover darkens the edge, `aria-pressed="true"` fills it
with ink, `:active` nudges it, `:disabled` fades it and shows a not-allowed pointer, and
`:focus-visible` draws a 2 px outline 3 px out.

## Motion

Short (`--dur: 160ms`, `--ease`). Under `prefers-reduced-motion: reduce` every animation
and transition is cut to near zero.

## States

A page that fails while drawing shows a short message with a reload button and a link to
all projects (`site/PageBoundary.tsx`); the sidebar and breadcrumb stay. Data pages
show their own loading and failure messages.
