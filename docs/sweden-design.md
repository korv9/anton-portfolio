# SWEDEN design

SWEDEN is the portfolio's featured research platform: five research products and a Connections
page under `#sweden`. This document covers how its pages look and are built. What each product
measures is described on the product's own page, in its method drawer.

The visual direction is "Sverige i höjd": a 3D scene over the whole window is the page's main
content, and glass panels float above it. Everything else sits below the scene.

## Boundary

- Everything lives in `frontend/src/sweden/` and is scoped to `.sweden`. Its tokens never reach
  `.home-shell` or the other projects, and the homepage source is not touched.
- `App.tsx` sets `data-workspace="sweden"` on the shell for SWEDEN routes, and does not render
  `SiteHeader` there: SWEDEN pages carry their own header (`Header.tsx`).
- The site's shared chart components (`RankBars`, `MultiLineChart`) are reused. `.sweden` rebinds
  the tokens they read (`--ink`, `--muted`, `--line`, `--series-1..5`, `--color-chart-*`).

## Routes

| Route                  | Page                              |
| ---------------------- | --------------------------------- |
| `#sweden`              | Hub                               |
| `#sweden-matning`      | A Politics of Measurement         |
| `#sweden-arbete`       | B The Ideal Human                 |
| `#sweden-likhet`       | C The Invisible Sweden            |
| `#sweden-tillhorighet` | D The Infrastructure of Belonging |
| `#sweden-framtid`      | E The Lost Futures                |
| `#sweden-samband`      | Connections                       |

The Wellbeing Observatory moved from `#sweden*` to `#wellbeing*`. Its old addresses redirect in
`router.ts`. A page's state is kept in the query, for example `#sweden-likhet?vy=likhet&kommun=2584`.
Pages write it with `setHashParams(path, params, true)`, so back and forward step through the views.
`?scen=2d` shows a page's 2D view in the scene's place.

## Header (`Header.tsx`)

No band of its own: the header sits on the page and fades into the scene with a gradient, never
a hard edge.

- On the left, the name in Archivo Expanded, upper case. Below it, one row in IBM Plex Mono:
  `SWEDEN`, then each product as its letter and one word (`C Similarity`). The current page is
  underlined and has `aria-current="page"`; each link's accessible name is the full title.
- On the right, two boxed controls. `MENU` opens a native `<dialog>` from the right (Start, SWEDEN,
  More); it takes focus, closes on Escape and hands focus back. The theme control switches SWEDEN
  between dark (default) and light, remembered per reader in `localStorage`.
- On a phone the header leaves the scene and stacks above it; the product row scrolls sideways.

## Tokens

These are defined on `.sweden` in `sweden.css`. Dark is the default; `html[data-sw-theme='light']`
switches to light.

| Token                            | Dark                              | Light                             | Use                                  |
| -------------------------------- | --------------------------------- | --------------------------------- | ------------------------------------ |
| `--sw-bg`                        | `#11100E`                         | `#E9E8E4`                         | Page                                 |
| `--sw-glass`                     | `rgba(26,24,21,.8)`               | `rgba(250,249,246,.88)`           | Scene panels only                    |
| `--sw-ink`                       | `#EDE6D6`                         | `#141416`                         | Text                                 |
| `--sw-muted`                     | `#A39E93`                         | `#55545B`                         | Secondary text                       |
| `--sw-line`                      | `rgba(237,230,214,.13)`           | `rgba(20,20,22,.14)`              | Rules, borders                       |
| `--sw-accent`                    | `#C9BCF2`                         | `#5A4A8C`                         | Links, focus, product letters        |
| `--sw-seq-lo` / `--sw-seq-hi`    | `#3A3256` / `#E3D8FF`             | `#BCB1DC` / `#2C1F5E`             | Sequential magnitude                 |
| `--sw-div-neg` / `-mid` / `-pos` | `#E08A5C` / `#3A3935` / `#6FB3D2` | `#B4562A` / `#C9C7C2` / `#2F6F8F` | Deviation from a meaningful midpoint |
| `--sw-base`                      | `#2A2925`                         | `#B9B6AF`                         | The ground and map base in 3D        |
| `--sw-stamp`                     | `#E2B65A`                         | `#8A6A1F`                         | Status stamps                        |

Colour rules:

- A sequential ramp is used only for magnitude, and a diverging ramp only around a stated midpoint.
  The ramp runs dark to light in the dark theme and light to dark in the light theme, so copy
  says "taller" or "further along the scale", never "darker".
- C's four similarity groups use fixed categorical colours (`GROUP_HEX` in `SimilarityStage.tsx`).
- Party colours are used only for party data.
- Missingness, significance and status are always written out in words. Colour never carries them alone.

Type, self-hosted under the SIL Open Font License (`frontend/public/fonts/sweden/`, `OFL.txt`):

- Archivo Expanded (width 125) for the name.
- IBM Plex Mono for navigation, labels, stamps, scales and numbers.
- Newsreader for questions, headings and the hub's product names.
- The site's body stack for running text.

The scene panels are the one exception to flat surfaces: they have translucency, a 10px backdrop blur
and a soft shadow. Every other surface on the page is flat.

## Page template (`template.tsx`)

Every research product renders `SwedenResearchPage`, with the sections in this order:

1. Scene. The full window (`100svh`), the 3D view filling it, with four fixed panels:
   - Title, top left: product letter and title, status stamp, the research question as the
     `h1`, one sentence on what the scene shows, then the findings as numbered buttons (at
     most three). A finding that runs against the expectation is marked and sorted first. Choosing
     one opens its values, evidence stamp and source in place and, where the page supports it,
     moves the scene (`onShow`). Findings are computed from published data, never written by hand.
   - Legend, top right: the measure, its period, the scale, how to read it, and the 3D / 2D switch.
   - Main control, bottom centre: the product's own control (C's Map ↔ Similarity, a measure, a year).
   - Info, bottom right: the chosen entity with raw values, units and source.
2. Explore. The 2D and tabular equivalents of the scene, with exact values and filters.
3. Method and limitations. `MethodDrawer` holds the nine sections: question, theory, data,
   method, results, alternatives, limitations, references and reproducibility. Limitations
   open by default. Data quality and construct validity are always discussed separately.
4. Interpretations. Two to four theoretical readings. Each says what the theory would
   expect, gives a verdict (supports, challenges, or cannot decide) computed or argued from
   the evidence, and states its limits.
5. Related research. Two or three links, each with a one-line reason.

A product without validated data renders its scene with an `EmptyState`. The empty state says
what the page would show, what it needs, and whether that is ingestion, validation, licence
review or cloud execution. Product status (`products.ts`) is one of three: findings available;
pipeline ready, awaiting execution; or data unavailable.

## Scenes and their 2D equivalents

| Product | 3D scene                                                                                                                       | 2D equivalent (`?scen=2d`, and without WebGL) |
| ------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Hub     | The municipalities on the map, coloured by C's similarity group                                                                | The list of pages                             |
| A       | Domain × decade bars, by the finest geography                                                                                  | The coverage matrix with exact counts         |
| B       | Category × year; skills as matte stone, personal expectations as glass. Years without a counted archive are flat, empty ground | The language matrix                           |
| C       | Municipalities lift from the map and travel to their principal components (`t`, 0–1)                                           | The SVG map / similarity dots                 |
| D       | Municipalities raised by rank on the chosen measure, libraries as lights                                                       | The choropleth with library points            |
| E       | Theme × year for the Riksdag; years left out are empty ground                                                                  | The future matrix                             |

### 3D engine

- `stage.ts`: the shared three.js stage. 32° perspective camera, damped orbit controls,
  hemisphere light plus one directional light with soft shadows, a shadow-catching ground,
  colours read from the tokens. The view is offset so the subject sits between the panels.
  It renders on change only and caps the device pixel ratio at 2.
- `BarField.tsx`: instanced boxes for A, B and E, with projected row and column labels.
- `MunicipalityField.tsx`: SCB's municipality boundaries (SWEREF99 TM, 100 m units; one scene
  unit is 10 km) as extruded shapes over a flat map base, with an optional second position per
  municipality, drawn paths for the move, outlined and labelled selections, and point lights.
  `SimilarityStage.tsx` (C) and `BelongingStage.tsx` (D) build on it; the hub uses it directly.
- three.js is lazy-loaded on SWEDEN routes only. The homepage never loads it.
- Scenes receive normalised heights and colours. Pages keep the raw values and show
  them in the info panel and in the tables under Explore.
- C's play button animates `t`; reduced motion jumps to the end instead.

## Accessibility and responsive behaviour

- Every 3D scene has a 2D equivalent with native, labelled controls, and every chart has a table.
- Focus is a 2px accent outline. Touch targets are at least 44px.
- From 760 to 1100px the main control takes the full width at the bottom and the info panel sits above it.
- At 760px and below the header and panels leave the scene and stack: header, title with
  findings, the visual, control, info, then legend.
- Reduced motion turns off animation within `.sweden`.

## Adding a research page

1. Add the product's data to `products.ts` (with a one-word `short` name for the header),
   keeping `status: 'pipeline'` until its data has run.
2. Write `<Product>.tsx`. Load the product's files with `fetchJson` from `sweden/<product>/`,
   compute the findings from them, and render `SwedenResearchPage` with a `Scene`.
3. Lazy-load it in `SwedenPage.tsx` and remove its `PENDING` entry.
4. Export the data from a dbt mart under `models/gold/sweden/` through a script in
   `platform/publish/sweden/`, and add its steps to the `sweden` subject in `platform/pipeline.yml`.
