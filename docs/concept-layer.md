# The shared concept layer

The portfolio's text corpora sit at four stages of one chain: **stories** (myth and folklore),
**ideas** (philosophy), **contestation** (Riksdag speeches) and **codification** (the EU AI Act).
The concept layer reads a balanced sample of all four against one editorial list of concepts,
with one embedding model, so that the Concept Constellation (`docs/concept-constellation.md`)
and the concept pages can show where an idea such as *autonomy* or *risk* is prominent, and in
what words, without pretending that one corpus caused another.

```
npm run concepts                # all of the below
npm run concepts:build          # platform/nlp/concepts/build.py -> warehouse/features/concepts
npm run concepts:dbt            # dbt build --select tag:concepts
npm run concepts:publish        # frontend/public/data/concepts/*.json
```

It reads the warehouse built by the Symbolic Atlas, the Philosophy Atlas, the AI Act and the
Riksdag AI models; build those first.

## Content types

Every row is marked:

- **source**: a chunk's text, exactly as it stands in the source, with its URL;
- **derived**: similarity, rank, z-score, shares, pairs; computed, reproducible, model-dependent;
- **interpretation**: the concepts, their anchor sentences, the tensions and the links to other
  measures; chosen by a person, and named as such.

No label is produced by a language model. A link between an atlas cluster and a concept exists
only in `seeds/concepts/cluster_concept_reviews.csv`, written by a reviewer; it is empty now.

## Concepts

`seeds/concepts/concepts.csv`: 28 concepts in six families (moral, political, regulatory,
epistemic, social, symbolic), each with a one-line description and an **anchor sentence in
English and in Swedish**. Status `curated`, created by the portfolio's editor; the method column
names how the concept is read (the anchor embedded with the shared model).

`concept_tensions.csv` pairs concepts with the Philosophy Atlas tensions they are poles of (or
nearest to). `concept_links.csv` links a concept to a measure elsewhere on the site only where
the target measures the same idea: a Riksdag framing group, a job-ad term, an AI Act view or a
tension. *Autonomy* has no Riksdag group or job term, and gets none.

## Corpora and sampling

| Corpus | Stage | Language | Chunks | Documents | Read from |
|---|---|---|---|---|---|
| myth | stories | en | 500 | 10 books | `silver.int_symbol_occurrences` (context windows) |
| philosophy | ideas | en | 494 | 13 works | `silver.int_philosophy_passages` |
| politics | contestation | sv | 495 | 495 speeches | `silver.int_riksdag_speeches`, one paragraph per speech |
| law | codification | en | 500 | 121 provisions | `silver.int_ai_act_provisions`, `02024R1689-20260727` |

At most 500 chunks per corpus, spread evenly over its books, works, calendar years
(2016–2026, 45 speeches each, party speeches only) or the Act's provisions in reading order
(Articles 102–110, which only amend other acts, are left out). A speech's paragraph is chosen
by a hash of its id, never by its content. Every chunk keeps corpus, document, location, source
URL, the hash of the source version it was read from and its retrieval time
(`gold.dim_text_chunk`; tests require all of them).

## Method

`platform/nlp/concepts/build.py`, with `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
(the shared model in `platform/nlp/text/vectors.py`):

1. Every chunk is embedded; each concept's anchor is embedded in both languages, and a chunk is
   compared with the anchor in its own language.
2. **Alignment** (`gold.fact_concept_alignment`, chunk × concept): cosine similarity, the
   concept's **rank** among the 28 for that chunk, and a **z-score** against the same concept in
   the same corpus.
3. **Profiles** (`gold.mart_concept_profiles`): how often a concept is a chunk's closest
   (rank-1 share; chance is 1/28 ≈ 3.6 %) and among its three closest.
4. **Representative passages** (`gold.mart_concept_passages`): chunks where the concept ranks
   in the top three, ordered by z-score within the corpus; eight per concept and corpus.
5. **Cross-corpus pairs** (`gold.fact_cross_domain_similarity`): per concept and pair of
   corpora, the closest pair among the representatives, kept only above the 95th percentile of
   4,000 random pairs between those corpora.
6. **Concept relations** (`gold.mart_concept_relations`): `semantic_similarity` where two
   anchors are among each other's three nearest in both languages; `shared_tension` from the
   editorial seed.

### Why ranks and z-scores, not raw similarity

Raw similarity depends on the corpus as much as on the concept: the mean chunk–anchor
similarity is 0.10 for myth, 0.15 for politics, 0.17 for law and 0.21 for philosophy, because
abstract prose is closer to every abstract anchor sentence. A rank compares concepts *within* one
chunk and a z-score compares chunks *within* one corpus, so neither carries that offset.

## Evaluation (`run.json`)

- **Corpus dominance.** 94 % of each chunk's ten nearest neighbours come from its own corpus
  (chance 25 %); with each corpus's mean removed, still 82 %. The four corpora differ in genre,
  period and language far more than in subject, so the layer never places chunks from different
  corpora on one map or clusters them together. It compares them only through the concepts.
- **Language.** 98 % of neighbours share the chunk's language (chance 63 %); Swedish is one
  corpus, so this is mostly the corpus effect again.
- **Anchor agreement.** Each Swedish anchor's nearest English anchor is the same concept for 28
  of 28 concepts: the two languages' anchors say the same thing to the model.
- **Concentration.** No corpus is absorbed by one concept: the largest rank-1 share is death in
  myth (34 %); normalised entropy of rank-1 concepts is 0.66–0.82.

## Results (6 October 2026)

The concepts most often closest, per corpus (rank-1 share, chance 3.6 %):

- **myth**: death 34 %, nature 21 %, power 9 %;
- **philosophy**: dignity 19 %, truth 11 %, order 11 %;
- **politics**: care 24 %, responsibility 18 %, duty and innovation 8 % each;
- **law**: safety 16 %, authority 13 %, transparency 13 %, duty 12 %.

148 of 159 concept × corpus-pair combinations have a representative pair above the random-pair
baseline. That says the closest passages of two corpora are closer than chance, not that they
mean the same thing.

## Limitations

- An anchor sentence is one way of putting a concept; another wording moves the scores. The
  anchors are published so they can be argued with.
- The model reads at most 128 tokens (about 100 words); longer chunks, mostly philosophy, are
  read from their beginning.
- Translations: myth and philosophy are read in English translations, the Riksdag in Swedish,
  the Act in English. The model is multilingual but not equally good in both.
- Riksdag paragraphs are a sample of all speeches, not of AI speeches; the AI-specific analysis
  is `docs/ai-politics.md`.
- Representative passages are what the model finds closest, not passages a reader has judged
  to be about the concept.
- Scores are comparable within one run of one model only.
