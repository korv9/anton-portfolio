# SWEDEN design

SWEDEN is the portfolio's featured research platform: five research products and a Connections
page under `#sweden`. This document covers how its pages look and are built. What each product
measures is described on the product's own page, in its method drawer.

## Boundary

- Everything lives in `frontend/src/sweden/` and is scoped to `.sweden`. Its tokens never reach
  `.home-shell` or the other projects, and the homepage source is not touched.
- `App.tsx` sets `data-workspace="sweden"` on the shell for SWEDEN routes.
- The site's shared chart components (`RankBars`, `MultiLineChart`) are reused. `.sweden` rebinds
  the tokens they read (`--ink`, `--muted`, `--line`, `--series-1..5`, `--color-chart-*`).

## Routes

| Route | Page |
|---|---|
| `#sweden` | Hub |
| `#sweden-matning` | A Politics of Measurement |
| `#sweden-arbete` | B The Ideal Human |
| `#sweden-likhet` | C The Invisible Sweden |
| `#sweden-tillhorighet` | D The Infrastructure of Belonging |
| `#sweden-framtid` | E The Lost Futures |
| `#sweden-samband` | Connections |
| `#sweden-kit` | Component states, no data |

The Wellbeing Observatory moved from `#sweden*` to `#wellbeing*`. Its old addresses redirect in
`router.ts`. A page's state is kept in the query, for example `#sweden-matning?domain=culture&decade=2010`.
Pages write it with `setHashParams(path, params, true)`, so back and forward step through the views.

## Tokens

These are defined on `.sweden` in `sweden.css`. They follow the reader's `prefers-color-scheme`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--sw-bg` | `#E9E8E4` | `#0F0F11` | Page |
| `--sw-glass` | `rgba(250,249,246,.88)` | `rgba(24,24,27,.84)` | Scene panels only |
| `--sw-ink` | `#141416` | `#EDECF0` | Text |
| `--sw-muted` | `#55545B` | `#A6A5AD` | Secondary text |
| `--sw-line` | `rgba(20,20,22,.14)` | `rgba(255,255,255,.12)` | Rules, borders |
| `--sw-accent` | `#5A4A8C` | `#B7A8E8` | Links, focus, single measures |
| `--sw-seq-lo` / `--sw-seq-hi` | `#BCB1DC` / `#2C1F5E` | `#352D4F` / `#D9CCFF` | Sequential magnitude |
| `--sw-div-neg` / `-mid` / `-pos` | `#B4562A` / `#C9C7C2` / `#2F6F8F` | `#E08A5C` / `#3A3A40` / `#6FB3D2` | Deviation from a meaningful midpoint |
| `--sw-band` | `#161616` | `#161616` | Masthead |
| `--sw-pill` | `#D9CFF7` | `#D9CFF7` | Product letters |

Colour rules:
- A sequential ramp is used only for magnitude, and a diverging ramp only around a stated midpoint.
- Party colours are used only for party data.
- Missingness, significance and status are always written out in words. Colour never carries them alone.

Type:
- Helvetica Neue / Helvetica for the masthead, titles and large numbers.
- The site's body stack for running text.
- Monospace with tabular numerals for metadata and numeric scales.
- No webfonts.

**The one exception to flat surfaces:** the scene panels have translucency, a 10px backdrop blur
and a soft shadow. Every other surface on the page is flat, with a 2px radius.

## Page template (`template.tsx`)

Every research product renders `SwedenResearchPage`, with the sections in this order:

1. **Scene.** A full-width stage, up to about 100svh, with four fixed overlay slots: title top
   left, legend top right, the main control bottom left, and the selected entity bottom right.
   If the data has no time dimension, the page shows no timeline.
2. **Findings.** At most three `FindingCard`s. Each states:
   - the statement
   - its measured values with units and period
   - an evidence stamp (descriptive, exploratory or causally identified)
   - its source

   A finding that runs against the expectation is marked and sorted first. Cards are computed
   from published data and never written by hand.
3. **Explore.** The 2D and tabular equivalents of the scene, with exact values and filters.
4. **Method and limitations.** `MethodDrawer` holds the nine sections: question, theory, data,
   method, results, alternatives, limitations, references and reproducibility. Limitations
   open by default. Data quality and construct validity are always discussed separately.
5. **Interpretations.** Two to four theoretical readings. Each says what the theory would
   expect, gives a verdict (supports, challenges, or cannot decide) computed or argued from
   the evidence, and states its limits.
6. **Related research.** Two or three links, each with a one-line reason.

A product without validated data renders its scene with an `EmptyState`. The empty state says
what the page would show, what it needs, and whether that is ingestion, validation, licence
review or cloud execution. Product status (`products.ts`) is one of three: findings available;
pipeline ready, awaiting execution; or data unavailable.

## Scenes and their 2D equivalents

| Product | Scene | 2D equivalent |
|---|---|---|
| A | Domain × decade coverage matrix, filtered by the finest geography. The Knowledge Cube (domain × decade × geography) is planned on the same data. | The matrix itself with exact counts, per-domain table, tables-per-year lines, and the full item list |
| B | Language landscape (year × category × rate per thousand words) | Time series per category |
| C | Municipal geometry morphing into similarity space | UMAP/PCA scatter, comparison table |
| D | Accessibility landscape on C's geometry | Map table, municipal comparisons |
| E | Future landscape per corpus | Theme trends per corpus and period |

### 3D

`BarField.tsx` (three.js 0.169.0) is the one 3D scene. It draws A's knowledge cube and B's and E's
landscapes as one instanced box per matrix cell.

- **Loading:** it loads only when a reader picks 3D with `ViewToggle` (`?scen=3d`). The homepage
  never loads it.
- **Fallback:** the 2D matrix is the default and accessible view, and it is also the fallback when
  WebGL is missing.
- **Look:** a 32° perspective camera, a matte material, a hemisphere light plus one directional
  light, and no idle rotation. The device pixel ratio is capped at 2.
- **Values:** the scene receives only normalised heights. The page keeps the raw values and shows
  them in the info panel and in the tables under Explore.

C's map moves each municipality between its centroid and its principal components, with a CSS
transition that reduced motion turns off. D reuses the same geometry and projection (`map.ts`).

## Accessibility and responsive behaviour

- Every scene cell or point is a native button with a text label, and every chart has a table.
- Focus is a 2px accent outline. Touch targets are at least 44px.
- At 760px and below:
  - the scene stacks as title, visual, control, legend, then info
  - the info panel becomes a sticky bottom sheet
  - the masthead shows only product letters
- Reduced motion turns off animation within `.sweden`.

## Adding a research page

1. Add the product's data to `products.ts`, keeping `status: 'pipeline'` until its data has run.
2. Write `<Product>.tsx`. Load the product's files with `fetchJson` from `sweden/<product>/`,
   compute the findings from them, and render `SwedenResearchPage`.
3. Lazy-load it in `SwedenPage.tsx` and remove its `PENDING` entry.
4. Export the data from a dbt mart under `models/gold/sweden/` through a script in
   `platform/publish/sweden/`, and add its steps to the `sweden` subject in `platform/pipeline.yml`.
