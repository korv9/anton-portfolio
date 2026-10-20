# SWEDEN atlas

The atlas is a second way into SWEDEN: one dark 3D space per study, with the question and
two short texts on the left. The first says what the data reveals; the second names the
Data–Reality Gap, meaning what the data cannot show. The routes are `#sweden-atlas` (start)
and `#sweden-atlas-a` to `-e` plus `#sweden-atlas-x` (Connections). You can also open the
atlas from the SWEDEN menu. The product pages under `#sweden-*` are unchanged.

Code lives in `frontend/src/sweden/atlas/`. three.js loads only on atlas routes.

## How a page is built

- `space.ts` is the shared stage. It holds the stars, camera, orbit controls and the
  drawing helpers: glow, thread, arc, web floor and ghost box. A ghost box is a dashed
  outline drawn where data is missing.
- `AtlasPage.tsx` is the page template. It shows the header, the space, the free text,
  a key, a source line and the DATA drawer.
- One file per page holds the data reading, the computed finding and the scene:
  `AtlasHub`, `AtlasMeasured` (A), `AtlasWorker` (B), `AtlasModelled` (C),
  `AtlasBelonging` (D), `AtlasFutures` (E) and `AtlasConnections` (×).

## Interaction

Every choice in the scene has a keyboard route as well:

- Start: click a municipality, or pick one from the list, to see its similarity group and
  a link to C.
- A: click a bar or a row label to light that area of life.
- B: switch between the occupation-fixed and the raw rate, and click a personal trait to
  follow it. The finding is recomputed.
- C: play, or drag the slider, to move every municipality between the map and similarity
  space. Paths can be turned off. Click a municipality, or pick one from the list, to light
  its three nearest neighbours.
- D: click a floor label to isolate that floor. Click a municipality, or pick one, to trace
  it through all four floors.
- E: click a theme in the key, or a slice, to follow it in both corpora.
- Connections: click a thread to read the relationship, its interval or the reason it was
  rejected.

A selection rebuilds the scene and keeps the reader's camera. C's slider moves objects in
place without a rebuild (`apply` in `AtlasPage`).

## Data slots

Each page reads its files through `slots.ts`. Every slot has a path, a role and the JSON
shape the scene expects. A slot is either filled or empty:

- A filled slot is drawn from the published file.
- An empty slot is drawn as a ghost: a dashed outline with the text "awaiting <file>". The
  page's DATA drawer lists the slot with its path and shape. Nothing is filled with sample
  values.
- The "Revealed" text is computed from the data. While its file is missing, the page says
  which file would produce it.

To fill a slot, publish the file at its path in the shape given in `slots.ts`. The scene
picks it up on the next load, and nothing else needs to change.

| Slot                     | Path                                       | Fills                                                                     |
| ------------------------ | ------------------------------------------ | ------------------------------------------------------------------------- |
| `measurementOther`       | `sweden/measurement/other_catalogues.json` | A: rows for Socialstyrelsen, Brå, Folkhälsomyndigheten and others         |
| `similarityAlternatives` | `sweden/similarity/alternatives.json`      | C: the top floor, another model specification                             |
| `travelTime`             | `sweden/belonging/travel_time.json`        | D: travel time replaces area per service point on the accessibility floor |
| `belongingSurvey`        | `sweden/belonging/belonging.json`          | D: the belonging floor                                                    |
| `futuresSou`             | `sweden/futures/sou.json`                  | E: a third corpus row (SOU)                                               |

Some gaps fill themselves. In B, adding a counted year to `language/trends.json` turns its
ghost column into a bar. In Connections, publishing a tested relationship for a pair that
is now only conceptual replaces the dotted thread with a tested one.

## Rules kept from SWEDEN

- Missing data is drawn as missing, never interpolated or treated as zero.
- Corpora with different denominators get separate rows and are never pooled.
- Colour never carries meaning alone. Every gap is also written out in words.
