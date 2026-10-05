# Symbolic Atlas

An experimental subject in the platform: can recurring symbolic meanings be found in
mythology, folklore and literature **without deciding the meanings first**? Every use of a
symbol word in a small public-domain corpus is placed on a map by the sentences around it and
grouped without supervision. The site shows the result at `#symbolic-atlas`.

The MVP proves the pipeline end to end. It does not claim the clusters are symbolic meanings.

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

- Reduce the book effect: compare symbols within one book, or remove each book's average
  embedding before clustering, and measure the change with the composition numbers above.
- Mask the symbol word itself in the context, so passages group by what surrounds it.
- More books per tradition, and books in their original languages with a multilingual model.
- Human review of a sample of clusters before any cluster is described in words.
