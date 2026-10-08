# Concept Constellation

`#concept-constellation` is an experimental meaning atlas. It asks: **where do the same ideas
appear as they move from stories to philosophy, politics and law?** The data comes from the
shared concept layer (`docs/concept-layer.md`). This page shows what that layer can defend and
nothing more.

```
npm run concepts      # build, dbt and publish the concept layer
```

## Views

| Address                  | Shows                                                                                                                                                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#concept-constellation` | The 28 concepts on a circle by family, the four corpora inside in chain order, and typed relations. `?begrepp=<id>` selects a concept and `?visa=` picks the relation types.                                                                               |
| `#concepts-profiles`     | Concept × corpus: how often each concept is a passage's closest, against chance (3.6 %).                                                                                                                                                                   |
| `#concepts-method`       | Sample, model, dominance metrics, editorial choices.                                                                                                                                                                                                       |
| `#concept-<id>`          | One concept, for example `#concept-autonomy` or `#concept-risk`. It shows the profile across corpora, the closest passages per corpus with source links, cross-corpus pairs above baseline, related concepts, and links to measures elsewhere on the site. |

## Relation types

Every line has one type, drawn in its own colour **and** stroke pattern, so colour is never the
only cue. The legend states each type's content type.

| Type                   | Drawn as                       | Content type   | Meaning                                                                                                                                                                                                     |
| ---------------------- | ------------------------------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `semantic_similarity`  | blue, solid, width by strength | derived        | Two concepts' anchors are among each other's three nearest, in both languages. On a concept page, two passages from different corpora are closer than 95 % of random pairs. Similar wording; not influence. |
| `shared_tension`       | orange, dashed                 | interpretation | The two concepts are the poles of one Philosophy Atlas tension. This is an editorial choice.                                                                                                                |
| `shared_concept`       | neutral, width by lift         | derived        | Shown as "prominent in corpus": the concept is a passage's closest at least twice as often as chance in that corpus.                                                                                        |
| `documented_reference` | green, dotted                  | source         | Riksdag speeches that name the AI Act. This is a corpus-to-corpus link counted from the speeches' own text.                                                                                                 |
| `temporal_overlap`     | grey, dashed                   | derived        | Two series change in the same period. Used on the AI governance timeline (Phase 8). Temporal overlap does not prove causation.                                                                              |

The three hues (`#3987e5`, `#d95926`, `#199e70`) pass the dataviz palette validator on the
site's dark surface, including the colour-vision-deficiency checks. Corpora are identified by
position and label, not colour.

## What a concept page includes, and leaves out

A concept page shows another domain's data only where a measure of the same idea exists there
(`seeds/concepts/concept_links.csv`). For example, _risk_ links to the Riksdag framing group
"risk", the job-ad terms `risk_management` and `model_risk`, the AI Act risk classes, and the
progress ↔ precaution tension. _Autonomy_ links only to the autonomy ↔ paternalism tension. Its
page says that no Riksdag word group and no job-ad term measures autonomy, rather than filling
the gap with a near match.

## Limitations

- The concept list, anchor sentences, tensions and links are editorial. Different anchors would
  give different profiles.
- The four corpora differ more from each other than their subjects do: 93 % of nearest
  neighbours are from the same corpus. Passages are therefore never placed on one map across
  corpora.
- "Closest passages" are what the model ranks highest. No reader has judged them to be about
  the concept.
- The constellation's layout is fixed by family. The distance between two nodes on the circle
  carries no meaning; only the lines do.
