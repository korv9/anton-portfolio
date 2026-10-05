# Symbolic Atlas

An experimental subject in the platform: can recurring symbolic meanings be found in
mythology, folklore and literature **without deciding the meanings first**? Every use of a
symbol word in a small public-domain corpus is placed on a map by the sentences around it and
grouped without supervision. The site shows the result at `#symbolic-atlas`.

The MVP proves the pipeline end to end. It does not claim the clusters are symbolic meanings.

The baseline showed the clusters follow books more than symbols, which raised a follow-up
question, investigated in [Deconfounding experiments](#deconfounding-experiments):

> Can symbolic meaning be separated from literary style and document identity in an
> unsupervised semantic space?

## Flow

```
Project Gutenberg ──ingest──▶ warehouse/raw/symbolic        (rawstore: URL, time, SHA-256)
  ──dbt bronze──▶ stg_symbolic_documents                    (text as fetched + provenance)
  ──dbt silver──▶ int_symbolic_documents                    (Gutenberg header/licence cut)
               ▶ int_symbol_occurrences                     (dbt Python model, nlp/symbolic/context.py)
  ──Python ML───▶ warehouse/features/symbolic               (embeddings, UMAP, HDBSCAN, evaluation)
  ──dbt gold────▶ mart_symbol_atlas, mart_symbol_profiles
  ──publish─────▶ frontend/public/data/symbolic             (summary.json, preview.json, *.parquet → R2)
  ──frontend────▶ #symbolic-atlas
```

## Commands

```
npm run symbolic:ingest    # python platform/ingest/symbolic/ingest_corpus.py
npm run symbolic:silver    # dbt: seeds, bronze, silver (tag:symbolic without gold)
npm run symbolic:ml        # python platform/nlp/symbolic/pipeline.py
npm run symbolic:gold      # dbt: the two gold marts
npm run symbolic:publish   # python platform/publish/symbolic/export_symbolic.py
npm run symbolic:build     # all of the above in order
```

The ML stage needs PyTorch (CPU) and the packages in `platform/requirements-symbolic.txt`,
which are kept out of `requirements.txt` so CI stays light. Scripts are run by path, like the
rest of `platform/`: `python -m platform…` would collide with Python's own `platform` module.

After publishing, run the **Publish to R2** workflow (Actions) on the branch to upload the
Parquet files; the site reads them from R2 and falls back to its own copy until then.

## Corpus

Ten books from Project Gutenberg (`platform/ingest/symbolic/corpus.json`). Each id was checked
against the Title and Author lines of the Gutenberg file.

| Book | Gutenberg | Tradition |
|---|---|---|
| The Elder Eddas and the Younger Eddas (Thorpe, Blackwell) | 14726 | Norse |
| Myths of the Norsemen (Guerber) | 28497 | Norse |
| Kalevala (Crawford) | 5186 | Finnish |
| Hesiod, the Homeric Hymns and Homerica (Evelyn-White) | 348 | Greek |
| The Odyssey (Butler) | 1727 | Greek |
| Bulfinch's Mythology | 4928 | Classical |
| Grimms' Fairy Tales | 2591 | European folklore |
| Andersen's Fairy Tales | 1597 | European folklore |
| Celtic Fairy Tales (Jacobs) | 7885 | Celtic |
| Paradise Lost (Milton) | 26 | Christian, literary |

Every book is an English translation or English original, so "tradition" is partly also
"translator".

## Symbol vocabulary

Twenty symbols (`platform/seeds/symbolic/symbols.csv`) and their aliases
(`symbol_aliases.csv`): plural forms, and a few near-synonyms kept deliberately narrow
(serpent and viper for snake, flame for fire, gate for door). Nothing is stemmed or lemmatised.

## Occurrence extraction

`platform/nlp/symbolic/context.py`, run inside dbt as a Python model:

- aliases match as whole words, case-insensitively; where two aliases cover the same text the
  longer wins, so a word is counted once;
- sentences are split by a regular expression; the context is the previous, matching and next
  sentence, never crossing into another book;
- verse can run a "sentence" for a page, so each sentence is cut to a window around the match;
- the occurrence id is a hash of book, character offset and symbol, so it is stable.

The silver layer keeps the text as natural language (case, punctuation, every word), because
the embedding model reads sentences.

## Embedding, map and clusters

`platform/nlp/symbolic/pipeline.py`:

1. **Sample.** At most 30 occurrences per book and symbol, chosen by occurrence id (a hash), so
   a long book or a common word does not fill the map: 4,869 of 13,168 occurrences.
2. **Embed.** `sentence-transformers/all-MiniLM-L6-v2`, 384 dimensions, normalised, on the CPU.
   No text leaves the machine. The vectors stay in `warehouse/features/` and are never delivered.
3. **Map.** UMAP to 2 dimensions: cosine, `n_neighbors` 15, `min_dist` 0.1, `random_state` 42.
4. **Cluster.** UMAP to 10 dimensions (`min_dist` 0.0), then HDBSCAN from scikit-learn with
   `min_cluster_size` 20, `min_samples` 10. The number of clusters is not set in advance.
5. **Evaluate** and write `run.json` (model, parameters, counts, time) and `evaluation.json`.

The run is deterministic: the same corpus gives the same map and clusters.

## Evaluation (current run)

| Measure | Value | What it says |
|---|---|---|
| Clusters | 43 | groups HDBSCAN found |
| Noise | 38 % | points in no cluster |
| Trustworthiness (2-D map) | 0.85 | the map mostly keeps each point's neighbours |
| Silhouette (10-D, clustered points) | 0.51 | clusters are reasonably separated |
| Median membership probability | 0.995 | clustered points sit firmly in their cluster |
| Largest book's share per cluster | 74 % | clusters mostly hold one book |
| Largest symbol's share per cluster | 28 % | clusters mix symbols |

**The main finding so far:** the clusters follow books (their style, era and translator) much
more than symbols. Well-separated clusters are therefore not evidence of shared symbolic
meaning. The page says so next to the map.

## Deconfounding experiments

`platform/nlp/symbolic/experiments.py` (`npm run symbolic:experiments`) runs the **same
occurrence sample** four ways. The sample is defined once (`pipeline.sample`) and every
`run.json` carries the SHA-256 of its ordered occurrence ids, so it can be checked that all
four used identical points. Embeddings are computed twice (original and masked contexts) and
shared; each variant gets its own UMAP map, 10-D UMAP space and HDBSCAN run with the
pipeline's parameters.

| Experiment | Input to UMAP | Tests |
|---|---|---|
| `baseline` | embeddings of the original contexts | the control; identical to the published atlas |
| `masked` | embeddings of contexts with the matched word replaced by `[SYMBOL]` | does structure survive when the symbol's identity is hidden? |
| `book_centered` | original embeddings minus their book's mean embedding, re-normalised (L2) | do clusters depend less on book and style when what a book's passages share is removed? |
| `masked_book_centered` | both | both at once |

`transforms.py`:

- `mask_symbol(context, matched_term)` replaces every whole-word, case-insensitive use of the
  matched term ("serpent", not "serpentine"; other aliases are left). A second use in the
  neighbouring sentences is masked too, since it would reveal the symbol.
- `center_by_document(vectors, document_ids)` subtracts each book's mean over the sampled
  occurrences only, then L2-normalises. This removes what a book's passages share on average:
  style, era, translator, but also any theme a book carries throughout. It reduces the book
  signal; it does not remove author, translator or style bias in any strict sense.

Outputs, under `warehouse/features/symbolic/experiments/` (local, not delivered): per
experiment `atlas_projection.parquet`, `evaluation.json`, `run.json`,
`cluster_composition.parquet` and `cluster_representatives.parquet`; and `comparison.json` /
`comparison.parquet`, one row per experiment. The site publishes `experiment-comparison.json`
and `cross-book-clusters.json` (counts, shares and representative ids only).

### Measures

Per non-noise cluster (`cluster_composition.parquet`): occurrence count; the number of
distinct books, traditions and symbols; the largest of each and its share; and the
**normalised entropy** of each: Shannon entropy divided by log(K), where K is the number of
categories in the whole experiment (10 books, 7 traditions, 20 symbols). 0 means one category;
1 means spread evenly over all of them. Dividing by the corpus-wide K, not by the categories
present in the cluster, keeps clusters comparable.

A **cross-book cluster** has at least 3 books and no book with more than half of it
(`CROSS_BOOK_MIN_BOOKS = 3`, `CROSS_BOOK_MAX_SHARE = 0.5` in `evaluation.py`).

Per experiment: the means of those shares and entropies, unweighted (each cluster counts
once, `mean_*`) and weighted by cluster size (`weighted_mean_*`); how many clusters have 2, 3
or 4+ books and 2 or 3+ traditions; the cross-book cluster count and the share of all sampled
occurrences that fall in one.

Representatives: for each cluster, the 7 members nearest its centroid in the 10-D clustering
space, ties broken by position; nothing is chosen at random.

### Results (run 2026-10-05, 4,869 occurrences, same sample in all four)

| | Baseline | Masked | Book-centred | Both |
|---|---|---|---|---|
| Clusters | 43 | 51 | 50 | 53 |
| Noise | 38 % | 37 % | 32 % | 37 % |
| Trustworthiness | 0.85 | 0.84 | 0.83 | 0.80 |
| Silhouette | 0.51 | 0.52 | 0.52 | 0.51 |
| Largest book share (mean / weighted) | 0.74 / 0.72 | 0.71 / 0.74 | **0.57 / 0.50** | 0.59 / 0.55 |
| Largest tradition share | 0.80 | 0.82 | **0.64** | 0.67 |
| Largest symbol share | 0.28 | 0.23 | 0.29 | 0.22 |
| Book entropy (normalised) | 0.32 | 0.33 | **0.51** | 0.48 |
| Clusters with 3+ books | 32 | 42 | 44 | 47 |
| Cross-book clusters | 5 | 8 | **24** | 19 |
| Occurrences in cross-book clusters | 7 % | 8 % | **43 %** | 28 % |

What this says:

- **Book-centring reduced book dependence the most**: book share 0.74 → 0.57 (0.72 → 0.50
  weighted), cross-book clusters 5 → 24, holding 43 % of the points, and silhouette did not
  drop. Book identity is a large, removable part of the baseline structure.
- **Masking hid the symbol, not the book**: symbol share fell (0.28 → 0.23) but book share
  barely moved. The clusters were never mainly about the symbol word; they follow the
  surrounding prose.
- **Combining both** sits between: fewer cross-book clusters than book-centring alone. Without
  the word, what is left of a passage after removing the book's mean is weaker.
- **Book effects are reduced, not gone**: even book-centred, a cluster's largest book holds
  57 % on average.
- **A failure mode surfaced**: one of the largest book-centred cross-book clusters is built
  from Bulfinch's glossary and index entries ("Aegisthus, murderer of Agamemnon…"), not from
  narrative. Paratext (indexes, notes, contents) survives the silver cleaning and forms its own
  clusters; it should be cut before the next run. Other cross-book clusters, such as passages
  about death and graves drawn from the Eddas, Hesiod and Bulfinch, look thematic, but no
  cluster has been reviewed by a person and none is named.

No variant is called best: the book-centred map trades a little trustworthiness (0.85 → 0.83)
for much less book dependence, which is what the follow-up question asks for.

## Delivery

`platform/publish/symbolic/export_symbolic.py` writes to `frontend/public/data/symbolic/`:

- `summary.json`: counts, symbols, traditions, books, the run's model and parameters, the
  evaluation (served with the site);
- `preview.json`: every tenth point (x, y, cluster) for the start page's picture;
- `atlas.parquet`: one row per point with a context excerpt of at most 360 characters;
- `symbol-profiles.parquet`: per symbol and cluster, count, share and mean probability.

It registers these four files in `catalog.json` and `delivery.json` with the same rules as
`build_catalog.py`, touching no other entry. Parquet is delivered from R2.

## Frontend

`frontend/src/symbolic/`: `SymbolicAtlasPage` (route `#symbolic-atlas`, lazy-loaded),
`AtlasCanvas` (canvas, one dot per point, colour by cluster, noise grey, hover and click),
`AtlasSidebar` (symbol, tradition, cluster and noise filters, kept in the address:
`?symbol=snake`, `?tradition=norse`, `?cluster=3`), `atlasData` (loading through the delivery
manifest) and `atlasTypes`.

The map's view spans the 0.2–99.8 percentiles of the coordinates; the few points outside it
are drawn as rings at the edge, and the page says how many. No coordinate is changed.

## Limitations

- Symbol matching is lexicon-based: "fire" in "fire-sword" and "gate" as a door both count, and
  a word used literally counts like one used symbolically.
- A context is not a symbolic meaning; the embedding sees the topic and style of a passage.
- Clusters are exploratory, not ground truth, and their ids carry no meaning.
- The corpus is ten English books chosen by hand; another selection gives another map.
- UMAP distorts the high-dimensional geometry; distances between far-apart groups on the map
  mean little.
- HDBSCAN leaves many points as noise by design.

## Future work

- Remove paratext (indexes, glossaries, notes, contents) in silver before the next run.
- Publish the book-centred map as a second, switchable atlas once its clusters are reviewed.
- Centre by translator as well as by book, and try per-symbol analyses within one book.
- More books per tradition, and books in their original languages with a multilingual model.
- Human review of a sample of clusters before any cluster is described in words.
