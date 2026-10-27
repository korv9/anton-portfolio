# Concept Constellation

`#concept-constellation` is an experimental meaning atlas. It asks: **where do the same ideas
appear as they move from stories to philosophy, politics and law?** The data comes from the
shared concept layer (`docs/concept-layer.md`). This page shows what that layer can defend and
nothing more.

```
npm run concepts      # build, dbt and publish the concept layer
```

## Views

| Address | Shows |
|---|---|
| `#concept-constellation` | The 28 concepts on a circle by family, the four corpora inside in chain order, and typed relations. `?begrepp=<id>` selects a concept and `?visa=` picks the relation types. |
| `#concepts-profiles` | Concept × corpus: how often each concept is a passage's closest, against chance (3.6 %). |
| `#concepts-method` | Sample, model, dominance metrics, editorial choices. |
| `#concept-<id>` | One concept, for example `#concept-autonomy` or `#concept-risk`. It shows the profile across corpora, the closest passages per corpus with source links, cross-corpus pairs above baseline, related concepts, and links to measures elsewhere on the site. |

## Relation types

Every line has one type, drawn in its own colour **and** stroke pattern, so colour is never the
only cue. The legend states each type's content type.

| Type | Drawn as | Content type | Meaning |
|---|---|---|---|
| `semantic_similarity` | first series colour, solid, width by strength | derived | Two concepts' anchors are among each other's three nearest, in both languages. On a concept page, two passages from different corpora are closer than 95 % of random pairs. Similar wording; not influence. |
| `shared_tension` | second series colour, dashed | interpretation | The two concepts are the poles of one Philosophy Atlas tension. This is an editorial choice. |
| `shared_concept` | neutral, width by lift | derived | Shown as "prominent in corpus": the concept is a passage's closest at least twice as often as chance in that corpus. |
| `documented_reference` | third series colour, dotted | source | Riksdag speeches that name the AI Act. This is a corpus-to-corpus link counted from the speeches' own text. |
| `temporal_overlap` | grey, dashed | derived | Two series change in the same period. The type is defined but no page draws it since the AI governance timeline view was withdrawn. Temporal overlap does not prove causation. |

The three hues come from the site's series tokens: `--cc-semantic`, `--cc-tension` and
`--cc-reference` map to `--series-1`, `--series-2` and `--series-3`
(`frontend/src/concepts/concepts.css`). Each type also has its own stroke pattern, so colour is
never the only cue. Corpora are identified by
position and label, not colour.

## What a concept page includes, and leaves out

A concept page shows another domain's data only where a measure of the same idea exists there
(`seeds/concepts/concept_links.csv`). For example, *risk* links to the Riksdag framing group
"risk", the job-ad terms `risk_management` and `model_risk`, the AI Act risk classes, and the
progress ↔ precaution tension. *Autonomy* links only to the autonomy ↔ paternalism tension. Its
page says that no Riksdag word group and no job-ad term measures autonomy, and leaves the gap
unfilled. The job-ad and AI Act links now lead to `#what-does-it-even-mean`,
because those pages were withdrawn on 2026-10-21.

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
