# Concept Journey

`#concept-journey?begrepp=<id>` follows one idea through four kinds of text: myths and folk
tales (stories), philosophy (ideas), Riksdag speeches (public debate) and the EU AI Act
(rules). It is the reading view of the concept layer ([concept-layer.md](concept-layer.md));
the constellation and the concept pages ([concept-constellation.md](concept-constellation.md))
stay as the exploring views.

The page says at the top what it shows and what it does not: passages with similar language
are placed closer together, and that is semantic similarity, not historical influence.

## Concepts

It opens with five concepts (`JOURNEY_CONCEPTS` in `frontend/src/concepts/logic.ts`):

| Concept | Why it is included |
|---|---|
| Risk | A Philosophy Atlas tension, a Riksdag word group, job-ad terms and the AI Act risk classes |
| Transparency | A tension, a Riksdag word group and the AI Act's Article 50 obligations |
| Control | A tension, the Riksdag's human-oversight group and Article 14 obligations |
| Responsibility | A Riksdag word group and a job-ad term; it stands out most in the Riksdag |
| Autonomy | Strong in philosophy, almost absent in law and politics; the page says so |

All 28 concepts remain on the constellation.

## What the page shows

1. The concept, its description and a small constellation on a dark plate. Each domain is a
   star sized by how often the concept is a passage's closest, against chance
   (`profiles.json`). Lines appear only where the data has a relation: semantic similarity
   between two domains' passages above the 95th percentile of random pairs (`pairs.json`), and
   the documented reference from Riksdag speeches that name the AI Act (`relations.json`).
   Domains differ by tone, shape and label, so colour is never the only cue. Positions mean
   nothing beyond the order of the domains.
2. *Why this matters*: generated from the same figures (where the concept stands out most and
   least) plus the editor's notes from `seeds/concepts/concept_links.csv`. Marked derived and
   editorial.
3. One section per domain: how often the concept is the closest there, two representative
   passages with their source link, similarity and rank, and the measures elsewhere on the site
   that count the same idea (`links.json`). Where none exists, the page says so instead of
   filling the gap.
4. *What connects them?* The closest cross-domain pairs, each with its value and the random
   baseline.
5. *What does not follow from this*, *Quality in brief*, *How it was built* and *Trace this
   result*.

## Relation types and status

Every link is labelled with its relation type and status:

| Type | Used for | Status |
|---|---|---|
| Semantic similarity | A passage close to the concept's anchor; two passages from different domains closer than random pairs | derived |
| Shared concept | A Riksdag word group, job-ad term or AI Act view that measures the same idea | derived or editorial |
| Shared tension | The concept is a pole of a Philosophy Atlas tension | editorial |
| Documented reference | Riksdag speeches that name the AI Act | derived from the speeches' text |

No passage-to-concept mapping has been reviewed yet, and no reviewed Symbolic Atlas cluster is
tied to a concept (`summary.reviewed_cluster_links` is 0). The stories section says so and shows
the model's closest passages among the 101 books of the Symbolic Atlas corpus (v4).

## Limitations

- The concepts, anchors, tensions and links are editorial. Different anchors would give
  different results.
- 93 % of nearest neighbours come from the same corpus, so passages are only compared within a
  domain and through the concepts, never on one shared map.
- The myth corpus samples about four passages from each of the 101 v4 books, so one book's
  passages rarely carry a concept on their own; it is still a sample, not every passage.
