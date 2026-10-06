# Design system

A grey editorial canvas outside, focused analytical worlds inside. The site is a warm
mid-grey page with near-black text; a large visualisation sits on a dark plate. Colour
carries meaning only where the data needs it (a party, a data series, a medallion layer);
the interface itself is neutral.

`frontend/src/tokens.css` is the one place the tokens are defined. It loads after every
other stylesheet, so a component that reads a token follows it everywhere. There is no
second theme file.

## Type

- **Manrope** for everything, self-hosted as a variable font (`/fonts/manrope-variable.ttf`,
  weights 200–800). The SIL Open Font License is kept at `frontend/public/fonts/Manrope-OFL.txt`.
- **System monospace** (`--font-mono`) for figures, metadata, section numbers and code.
- Weights: body 470, interface 560, headings 700.
- Scale: `--display-xl`, `--display-l`, `--h1`, `--h2`, `--h3`, `--body-large`, `--body`,
  `--small`, `--caption`; reading measure `--measure: 68ch`. The older `--fs-*` names map
  onto the same scale.
- Figures are tabular everywhere.

The large name is the homepage's. Project pages show it at a medium size on one row with
the navigation, so the analysis starts high on the screen.

## Colour

| Token | Light page | Plate | Use |
|---|---|---|---|
| `--page` | `#D8D5CF` | `#0F0F10` | the background |
| `--paper` / `--paper-strong` | `#E6E3DD` / `#F2EFE9` | `#1A1A1C` / `#232326` | surfaces, inputs |
| `--ink` | `#0F0F10` | `#F2EFE9` | text |
| `--muted` | `#4A4A4D` | `#A8A49B` | secondary text |
| `--subtle` | `#6B6B6E` | `#8A8A8D` | rules and marks, never text |
| `--line` / `--line-strong` | ink at 16 % / 42 % | off-white at 16 % / 38 % | rules, control edges |
| `--accent` / `--on-accent` | ink / off-white | off-white / ink | what is chosen or current |
| `--info`, `--negative` | `#1F4F73`, `#8F3424` | `#8BBDE3`, `#EC8A74` | meaning, never decoration |
| `--data-*` | six series hues | | charts with categories only |

Measured contrast (WCAG): ink on page 13.1, muted on page 6.0 and on the darkest light
surface 5.2; on a plate, ink 16.7 and muted 7.7. Every main page is checked by axe in
`frontend/tests/accessibility.spec.ts`.

Party colours are unchanged and come from `frontend/src/parties/identity.tsx`.

### Dark plates

`.plate` redefines the same tokens for its subtree, so a component inside reads its colours
from the tokens and needs no theme of its own. It is used by the Symbolic Atlas, the Data
Constellation, the concept and philosophy maps, the job clusters and the project stages
(`Stage` with `dark`). Component aliases such as `--stage-ink` or `--c-muted` are declared
again inside `.plate`, because a custom property set on an outer element keeps the outer
value.

On the Symbolic Atlas the clusters are muted hues on the plate. In the book views, other
clusters are grey, cross-book candidates stone (`#C9C2B6`) and reviewed clusters off-white,
with a key beside the map. The Data Constellation keeps bronze, silver and gold tones for
the medallion layers and draws everything else in greys; each layer also has its own mark
shape, so colour is never the only cue.

## Shape and space

Corners are 0–4 px (`--radius: 2px`); circles stay circles. There are no decorative shadows,
gradients or blur; an inset rule may mark a party or a current item. Space follows
`--sp-1` … `--sp-6` and the fluid `--gutter`.

## Buttons and filters

One system, in `tokens.css`:

- `.btn`: primary, ink filled. One per view, the main action.
- `.btn-quiet`: secondary, an outline.
- `.btn-text`: a text action, underlined.
- Chip groups (`.project-filter`, `.atlas-chips`, `.constellation-chips`, `.aa-filters` and
  the other groups listed in `tokens.css`): filters and toggles, pressed when chosen.

Every control has the same states: hover darkens the edge, `aria-pressed="true"` fills it
with ink, `:active` nudges it, `:disabled` fades it and shows a not-allowed pointer, and
`:focus-visible` draws a 2 px outline 3 px out. The design page (`#design`) shows them
working.

## Motion

Short (`--dur: 160ms`, `--ease`). Under `prefers-reduced-motion: reduce` every animation
and transition is cut to near zero.

## States

A page that fails while drawing shows a short message with a reload button and a link to
all projects (`site/PageBoundary.tsx`); the header, breadcrumb and footer stay. Data pages
show their own loading and failure messages.
