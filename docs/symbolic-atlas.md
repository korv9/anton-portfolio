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

Reading the results then exposed paratext (glossaries, indexes) as a second confounder, which
led to [Paratext cleaning](#paratext-cleaning) and a [human review](#human-review) step: the
atlas moves from an interesting clustering picture to a transparent, human-reviewed
investigation of cross-document symbolic context. Nothing here claims a symbolic meaning has
been discovered; a cluster gets a name only when a person has read it.

| Version | What changed                   | Largest book in a cluster | Cross-book clusters (passages in them) |
| ------- | ------------------------------ | ------------------------- | -------------------------------------- |
| v1      | Baseline embeddings            | 74 %                      | 5 of 43 (7 %)                          |
| v2      | Book-centred embeddings        | 57 %                      | 24 of 50 (43 %)                        |
| v3      | Paratext cleaned, book-centred | 58 %                      | 25 of 59 (32 %), ranked for review     |

## Flow

```
Project Gutenberg ──ingest──▶ warehouse/raw/symbolic        (rawstore: URL, time, SHA-256)
  ──dbt bronze──▶ stg_symbolic_documents                    (text as fetched + provenance)
  ──dbt silver──▶ int_symbolic_documents                    (dbt Python model, nlp/symbolic/cleaning.py:
                                                              boilerplate and paratext cut, audited)
               ▶ int_symbol_occurrences                     (dbt Python model, nlp/symbolic/context.py)
  ──Python ML───▶ warehouse/features/symbolic               (embeddings, UMAP, HDBSCAN, evaluation)
               ▶ experiments/                               (baseline, masked, book-centred, both)
               ▶ review/                                    (rank_clusters.py: candidates for human review)
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

npm run symbolic:clean        # snapshot occurrences, rebuild silver with the cleaning, write the audit
npm run symbolic:experiments  # python platform/nlp/symbolic/experiments.py (all four variants)
npm run symbolic:review       # python platform/nlp/symbolic/rank_clusters.py book_centered
npm run symbolic:research     # clean → experiments → ml → gold → review → publish
```

The research workflow, in order:

1. `npm run symbolic:clean`: snapshots the current occurrences
   (`warehouse/features/symbolic/occurrences_before_cleaning.parquet`), rebuilds silver with
   the cleaning and writes `cleaning_audit.parquet` and `cleaning_comparison.json`.
2. Archive the experiment results the new run will be compared with:
   `python platform/nlp/symbolic/experiments.py --archive <label>` (copies them to
   `experiments/history/<label>/`; `v2-before-cleaning` is the archive used today).
3. `npm run symbolic:experiments` (and `npm run symbolic:ml` for the published baseline: the
   cleaning changes character offsets and so occurrence ids).
4. `npm run symbolic:review`: ranks the book-centred clusters and writes `review/`.
5. Read `review/representative_passages.parquet` (both sets) and `cluster_keywords.parquet`
   for the clusters at the top of `review/cluster_candidates.parquet`.
6. Edit `platform/nlp/symbolic/reviewed_clusters.json` by hand (see [Human review](#human-review)).
7. `npm run symbolic:gold && npm run symbolic:publish`, then the **Publish to R2** workflow.

No step writes `reviewed_clusters.json`; rerunning everything never overwrites a review.

The ML stage needs PyTorch (CPU) and the packages in `platform/requirements-symbolic.txt`,
which are kept out of `requirements.txt` so CI stays light. Scripts are run by path, like the
rest of `platform/`: `python -m platform…` would collide with Python's own `platform` module.

After publishing, run the **Publish to R2** workflow (Actions) on the branch to upload the
Parquet files; the site reads them from R2 and falls back to its own copy until then.

## Corpus

**v4: 101 books** in twelve tradition groups (`platform/ingest/symbolic/corpus.json`, one
document per line). v1–v3 used the ten books marked `pilot`.

How the books were chosen and checked:

1. **From the catalogue, not from memory.** Candidates were searched per tradition in Project
   Gutenberg's catalogue (`pg_catalog.csv`), preferring complete, independent works: one
   translation per work, no anthology that reprints another chosen book, single files only
   (so Ovid is Howard's complete blank-verse edition and Malory is volume 1).
2. **Against Gutenberg's own record.** For every book the Gutenberg RDF record gave the title,
   the creators with their roles (author, translator, editor, compiler), the language and the
   rights. All 101 are English and "Public domain in the USA." Title, author, translator and
   editor in `corpus.json` come from that record; tradition, culture, region, genre, source
   type and period are curated.
3. **Against the files.** `platform/ingest/symbolic/audit_corpus.py` (after the ingest) checks
   the fields, that each file's own header names the same title in English, the length (at
   least 5,000 words), and duplicated text between books: the share of one book's eight-word
   shingles found in another. It writes `corpus_audit.json` and stops on a duplicate.
   _Sakoontala_ (12169) was dropped because 52 % of it is reprinted in _Hindu Literature_
   (13268). Smaller overlaps remain (27 % of the _Mabinogion_ is in Bulfinch's _Age of
   Chivalry_, 22 % of _Serbian Folk-lore_ in _Hero Tales of the Serbians_); they are handled
   per passage (below).

| Tradition group                | Books |
| ------------------------------ | ----- |
| Greek and Roman                | 13    |
| Norse and Germanic             | 10    |
| Celtic and Arthurian           | 10    |
| East Asian                     | 10    |
| Indigenous North American      | 10    |
| European folklore              | 10    |
| Slavic and Eastern European    | 9     |
| Christian and Biblical         | 9     |
| South Asian                    | 8     |
| Egyptian and Ancient Near East | 6     |
| Finnish and Baltic             | 3     |
| Middle Eastern and Persian     | 3     |

Source types: 42 translations, 33 folklore collections, 17 retellings, 8 literary works and
one work written in English (Malory). Finnish/Baltic and Middle Eastern/Persian stay small:
Gutenberg has few complete, independent English texts for them, and the corpus does not pad a
group with weak sources to reach a quota.

Every book is read in English. Many are translations or retellings by nineteenth-century
English writers, so "tradition" is partly also "translator"; the validity checks below test
that directly.

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

1. **Sample.** At most 15 occurrences per book and symbol (30 in v1–v3), chosen by occurrence
   id (a hash), so a long book or a common word does not fill the map, leaving out passages
   another book reprints (`duplicate_of` in silver). v4: 21,898 of 72,926 occurrences, 436
   marked as reprints. The pilot: 4,804 of 12,712 after the paratext cleaning.
2. **Embed.** `sentence-transformers/all-MiniLM-L6-v2`, 384 dimensions, normalised, on the CPU.
   No text leaves the machine. The vectors stay in `warehouse/features/` and are never delivered.
3. **Map.** UMAP to 2 dimensions: cosine, `n_neighbors` 15, `min_dist` 0.1, `random_state` 42.
4. **Cluster.** UMAP to 10 dimensions (`min_dist` 0.0), then HDBSCAN from scikit-learn with
   `min_cluster_size` 20, `min_samples` 10. The number of clusters is not set in advance.
5. **Evaluate** and write `run.json` (model, parameters, counts, time) and `evaluation.json`.

The run is deterministic: the same corpus gives the same map and clusters.

## Evaluation (current baseline, after the paratext cleaning)

| Measure                             | Value | What it says                                  |
| ----------------------------------- | ----- | --------------------------------------------- |
| Clusters                            | 50    | groups HDBSCAN found (43 before the cleaning) |
| Noise                               | 29 %  | points in no cluster (38 %)                   |
| Trustworthiness (2-D map)           | 0.85  | the map mostly keeps each point's neighbours  |
| Silhouette (10-D, clustered points) | 0.49  | clusters are reasonably separated (0.51)      |
| Median membership probability       | 0.99  | clustered points sit firmly in their cluster  |
| Largest book's share per cluster    | 69 %  | clusters mostly hold one book (74 %)          |
| Largest symbol's share per cluster  | 28 %  | clusters mix symbols                          |

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

| Experiment             | Input to UMAP                                                             | Tests                                                                                   |
| ---------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `baseline`             | embeddings of the original contexts                                       | the control; identical to the published atlas                                           |
| `masked`               | embeddings of contexts with the matched word replaced by `[SYMBOL]`       | does structure survive when the symbol's identity is hidden?                            |
| `book_centered`        | original embeddings minus their book's mean embedding, re-normalised (L2) | do clusters depend less on book and style when what a book's passages share is removed? |
| `masked_book_centered` | both                                                                      | both at once                                                                            |

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

Representatives: for each cluster, the 15 members nearest its centroid in the 10-D clustering
space, ties broken by position; nothing is chosen at random. Each run also keeps its 10-D
clustering space (`cluster_space.parquet`, local only) for the review.

### Results before the paratext cleaning (run 2026-10-05, 4,869 occurrences, same sample in all four)

Archived in `experiments/history/v2-before-cleaning/`.

|                                      | Baseline    | Masked      | Book-centred    | Both        |
| ------------------------------------ | ----------- | ----------- | --------------- | ----------- |
| Clusters                             | 43          | 51          | 50              | 53          |
| Noise                                | 38 %        | 37 %        | 32 %            | 37 %        |
| Trustworthiness                      | 0.85        | 0.84        | 0.83            | 0.80        |
| Silhouette                           | 0.51        | 0.52        | 0.52            | 0.51        |
| Largest book share (mean / weighted) | 0.74 / 0.72 | 0.71 / 0.74 | **0.57 / 0.50** | 0.59 / 0.55 |
| Largest tradition share              | 0.80        | 0.82        | **0.64**        | 0.67        |
| Largest symbol share                 | 0.28        | 0.23        | 0.29            | 0.22        |
| Book entropy (normalised)            | 0.32        | 0.33        | **0.51**        | 0.48        |
| Clusters with 3+ books               | 32          | 42          | 44              | 47          |
| Cross-book clusters                  | 5           | 8           | **24**          | 19          |
| Occurrences in cross-book clusters   | 7 %         | 8 %         | **43 %**        | 28 %        |

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

## Paratext cleaning

`platform/nlp/symbolic/cleaning.py`, run in the silver model `int_symbolic_documents` (now a
dbt Python model). The old SQL collapsed every line break before cleaning, which hid the
structure that shows where paratext is; the new cleaning reads the lines first and collapses
white space last. Each rule is its own function and none is one big regular expression:

| Rule                                 | Function                      | Signal                                                                                                                                                                                                                  |
| ------------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gutenberg header, licence and credit | `strip_gutenberg_boilerplate` | START/END markers; a leading "Produced by …" paragraph                                                                                                                                                                  |
| Footnotes and transcriber's notes    | `remove_footnote_blocks`      | bracketed `[Footnote 12: …]` blocks, wherever they stand                                                                                                                                                                |
| Tables of contents                   | `remove_table_of_contents`    | a CONTENTS / TABLE OF CONTENTS / LIST OF ILLUSTRATIONS heading, then list-like paragraphs (lines in capitals, numbered, CHAPTER/BOOK/RUNE…, page numbers, indented titles) up to the first paragraph that is not a list |
| Glossaries                           | `remove_glossary_sections`    | a GLOSSARY / VOCABULARY heading **and** entries that look like "Term, …" / "Term. …" (60 % or more)                                                                                                                     |
| Indexes                              | `remove_index_sections`       | an INDEX heading **and** entries with page numbers (half or more) or glossary-like entries                                                                                                                              |
| Notes, references, appendices        | `remove_editorial_notes`      | BIBLIOGRAPHY / REFERENCES anywhere; NOTES, FOOTNOTES, ENDNOTES, APPENDIX, DRAMATIS PERSONAE in the last quarter of a book, or earlier only when their entries look like notes ("[1] …")                                 |
| The document                         | `clean_document`              | all of the above, then white space collapsed                                                                                                                                                                            |

A heading is a short line on its own with at least two blank lines before it, as Gutenberg sets
section headings. Words alone never trigger anything: "index", "notes" or "contents" in a
sentence are prose. A section runs to the next heading in capitals that is not itself an entry,
or to the end of the book. The rules are conservative: a section heading over prose is kept.

Safeguards: the model raises if a book would lose more than half its text or keep fewer than
5,000 words, and warns above 30 %. Paragraph order is kept. Character offsets are offsets in
the cleaned text, so occurrence ids (hash of book, offset and symbol) stay deterministic for a
cleaning version, but change when the cleaning changes.

## Cleaning audit

Each row of `int_symbolic_documents` carries its audit: `raw_char_count`, `body_char_count`
(after boilerplate), `clean_char_count`, `removed_char_count`, `removed_share`,
`sections_removed` (kind:heading, JSON), `footnote_blocks_removed`, `cleaning_warnings` and
`cleaning_version`. `cleaning_report.py` writes `warehouse/features/symbolic/cleaning_audit.parquet`
and `cleaning_comparison.json` (occurrences before and after, per book, symbol and tradition).

| Book                        | Removed | Sections                               |
| --------------------------- | ------- | -------------------------------------- |
| Andersen's Fairy Tales      | 0.1 %   | contents                               |
| Bulfinch's Mythology        | 5.2 %   | contents, glossary, 75 footnotes       |
| Celtic Fairy Tales          | 4.1 %   | contents, notes and references         |
| The Elder and Younger Eddas | 9.1 %   | contents, glossary, 137 footnotes      |
| Grimms' Fairy Tales         | 0.3 %   | contents                               |
| Hesiod, the Homeric Hymns   | 9.0 %   | bibliography, endnotes                 |
| Kalevala                    | 1.3 %   | contents, glossary                     |
| Myths of the Norsemen       | 0.5 %   | contents, list of illustrations, notes |
| The Odyssey                 | 7.6 %   | footnotes                              |
| Paradise Lost               | 0.0 %   | contents                               |

Occurrences: 13,168 → 12,712 (456 fewer, 9 of 10 books affected; Paradise Lost unchanged).
The largest losses are in Bulfinch (−207, its glossary), the Eddas (−107) and the Kalevala
(−58); by symbol, river (−55), mother (−41) and tree (−39).

## Post-cleaning experiment

All four variants rerun on the cleaned occurrences with unchanged UMAP and HDBSCAN parameters,
so only the cleaning differs (`experiments/post_cleaning_comparison.json`). 4,804 occurrences,
the same sample in all four.

|                             | Baseline    | Masked      | Book-centred | Both        |
| --------------------------- | ----------- | ----------- | ------------ | ----------- |
| Clusters                    | 43 → 50     | 51 → 40     | 50 → 59      | 53 → 57     |
| Noise                       | 38 → 29 %   | 37 → 30 %   | 32 → 36 %    | 37 → 40 %   |
| Trustworthiness             | 0.85 → 0.85 | 0.84 → 0.84 | 0.83 → 0.83  | 0.80 → 0.81 |
| Silhouette                  | 0.51 → 0.49 | 0.52 → 0.47 | 0.52 → 0.53  | 0.51 → 0.54 |
| Largest book share (mean)   | 0.74 → 0.69 | 0.71 → 0.69 | 0.57 → 0.58  | 0.59 → 0.60 |
| Book entropy                | 0.32 → 0.36 | 0.33 → 0.35 | 0.51 → 0.48  | 0.48 → 0.46 |
| Cross-book clusters         | 5 → 10      | 8 → 9       | 24 → 25      | 19 → 23     |
| Occurrences in them         | 7 → 11 %    | 8 → 19 %    | 43 → 32 %    | 28 → 23 %   |
| Suspected paratext clusters | 1 → 0       | 2 → 0       | 2 → 0        | 2 → 0       |

What this says, and what it does not:

- **The paratext clusters are gone** in every variant, including the two glossary clusters of
  the book-centred run (Bulfinch's, 173 points, which had counted as cross-book; the Eddas', 70).
- **Book-centred cross-book clusters held up** (24 → 25), but their share of passages fell from
  43 % to 32 %: part of the earlier cross-book structure was glossary entries. The aggregate
  improvement claimed before the cleaning was partly paratext.
- **The baseline lost some book dependence** (0.74 → 0.69) once front and back matter, which
  each book has in its own style, were gone.
- Aggregate metrics alone do not show the remaining clusters mean anything; that is what the
  review is for.

## Cluster candidate ranking

`platform/nlp/symbolic/rank_clusters.py` ranks the book-centred clusters **for review, not for
meaning**. `review_priority_score` (0 to 1) is a weighted mean of documented components:

| Weight | Component                             |
| ------ | ------------------------------------- |
| 0.25   | book entropy (normalised)             |
| 0.20   | tradition entropy (normalised)        |
| 0.20   | 1 − largest book share                |
| 0.15   | mean HDBSCAN membership probability   |
| 0.10   | symbol diversity, min(symbols, 5) / 5 |
| 0.10   | size, min(1, log n / log 200)         |

Audit flags never remove a cluster from the results; they set its `review_class`:

- `suspected_paratext`: 20 % or more of its passages read as paratext. A passage is paratext
  when it has a run of glossary entries ("Aegisthus, murderer of Agamemnon"), capitalised
  headwords ("KERLAUG: …"), or two weaker signals together (many capitalised words, page
  references, editorial markers such as "See", "cf.", "vol.", a high share of digits). The 20 %
  is calibrated on the run before cleaning: its two glossary clusters had 31 % and 21 %, every
  narrative cluster at most 9 %.
- `too_small`: fewer than 30 passages. `book_dominated`: not cross-book (one book holds more
  than half, or fewer than three books). `low_membership`: mean membership below 0.5.
- `reject` = paratext or too small, `warning` = book-dominated or low membership, otherwise
  `candidate`.

Today: 59 clusters, **19 candidates**, 22 warnings, 18 set aside (all too small), **0
suspected paratext**, 25 cross-book.

Review artefacts in `warehouse/features/symbolic/review/`:

- `cluster_candidates.parquet`: one row per cluster with counts, largest book/tradition/symbol
  and shares, entropies, membership, flags, class, score, status, fingerprint and
  `suggested_terms`;
- `representative_passages.parquet`: two sets of 12 per cluster. _centroid_: nearest the
  centroid in the 10-D space. _diverse_: among members at or above the cluster's median
  membership, the one nearest the centroid from each book in turn, then by distance, so a
  cross-book cluster shows a passage from every book before a second from any;
- `cluster_keywords.parquet`: class-based TF-IDF terms (each cluster's passages as one document;
  tf = count / words in the cluster, idf = log(1 + mean words per cluster / term count)). The
  stop-word list is scikit-learn's without "fire" (a symbol it happens to contain) plus archaic
  function words (thou, thee, hath, …). These are **suggestions for the reviewer, never labels**;
- `cluster_symbols.parquet`, `cluster_traditions.parquet`: the mix per cluster;
- `review_summary.json`: the counts, the weights and thresholds, the top candidates and any
  stale reviews.

## Human review

`platform/nlp/symbolic/reviewed_clusters.json` is edited by hand only:

```json
{
  "experiment": "book_centered",
  "clusters": {
    "17": {
      "fingerprint": "3f2a…",
      "status": "reviewed",
      "label": "Threshold / passage",
      "description": "Contexts involving movement across boundaries, entrances, shores or transitions.",
      "interpretation": "Why this cluster matters, in a few sentences.",
      "confidence": "medium",
      "reviewed_by": "human",
      "notes": "Appears across several books and traditions."
    }
  }
}
```

Statuses: `unreviewed`, `candidate`, `reviewed`, `rejected`. A reviewed entry needs a
fingerprint, label, description and confidence (low, medium, high); `reviews.py` refuses the
file otherwise. Cluster numbers change whenever anything upstream changes, so an entry is
matched to the current run by its **fingerprint** (the hash of the cluster's member ids, in
`cluster_candidates.parquet`), not its number. An entry whose fingerprint matches no current
cluster is reported as stale in `review_summary.json` and ignored, never published under a
cluster it did not read.

Today the file has **no reviewed clusters**: nothing has been labelled yet.

## Reviewed labels

Only entries with status `reviewed` are published (`reviewed-clusters.json`: cluster id, label,
description, interpretation, confidence, book/tradition/symbol counts, representative ids).
Notes stay private. No label is generated: keywords and any later automatic suggestion stay in
the review artefacts and never become public labels. Unreviewed clusters are "Cluster n".

## Cross-book atlas

The page has three views of the same points (`?view=`):

- **Baseline**: the published atlas, coloured by cluster in muted hues on the dark plate.
- **Cross-book**: the book-centred map. Noise is faint, book-bound and rejected clusters are
  grey, cross-book candidates stone, reviewed clusters off-white and labelled on the map, the
  chosen cluster on top; a key beside the map names the three tones. Choosing a cluster (a point or the cluster list) opens its
  panel: name if reviewed, number, review status and audit class, passages, books, traditions,
  symbols, largest book share, book entropy, mean membership, top symbols and traditions and
  representative passages one book at a time; for reviewed clusters also the description,
  confidence and the reviewer's "why this cluster matters".
- **Reviewed**: only reviewed clusters lit; until there are any the page says "No reviewed
  semantic clusters yet."

Under the map, "How the investigation went" tells the steps (question, baseline, problem,
deconfounding, cleaning, review, result) with the numbers from `research-history.json`; the
cluster-quality diagnostics (trustworthiness, silhouette, noise, membership) are under Method.

## Delivery

`platform/publish/symbolic/export_symbolic.py` writes to `frontend/public/data/symbolic/`:

- `summary.json`: counts, symbols, traditions, books, the run's model and parameters, the
  evaluation (served with the site);
- `preview.json`: every tenth point (x, y, cluster) for the start page's picture;
- `atlas.parquet`: one row per point with a context excerpt of at most 360 characters;
- `symbol-profiles.parquet`: per symbol and cluster, count, share and mean probability.

and, from the experiments and the review:

- `experiment-comparison.json`: one row per deconfounding experiment;
- `book-centered-atlas.parquet`: the book-centred coordinates and clusters of the same points
  (the rest of each point is joined from `atlas.parquet` by occurrence id);
- `book-centered-clusters.json`: every book-centred cluster with its counts, shares, entropies,
  flags, review class and status, top symbols and traditions and representative ids;
- `cross-book-clusters.json`: the cross-book subset, each with its review status;
- `reviewed-clusters.json`: only human-reviewed clusters (empty until a review);
- `research-history.json`: v1–v3 with their numbers, the cleaning audit and the review counts.

The export reruns the ranking first, so the published review status always matches
`reviewed_clusters.json`. No embedding and no text beyond each point's excerpt is delivered.
It registers the files in `catalog.json` and `delivery.json` with the same rules as
`build_catalog.py`, touching no other entry. Parquet is delivered from R2.

## Frontend

`frontend/src/symbolic/`: `SymbolicAtlasPage` (route `#symbolic-atlas`, lazy-loaded),
`AtlasCanvas` (canvas, one dot per point, colour by cluster, noise grey, hover and click),
`AtlasSidebar` (symbol, tradition, cluster and noise filters, kept in the address:
`?symbol=snake`, `?tradition=norse`, `?cluster=3`, and the view, `?view=cross-book`),
`ClusterPanel` (a book-centred cluster for review), `ResearchStory` (the investigation step by
step), `ExperimentTable`, `atlasData` (loading through the delivery manifest) and `atlasTypes`.
The review layer is optional: without its files the page is the baseline atlas.

The map's view spans the 0.2–99.8 percentiles of the coordinates; the few points outside it
are drawn as rings at the edge, and the page says how many. No coordinate is changed.

## v4: the expanded corpus (run 2026-10-06)

The experiment changes one thing: the corpus, from 10 to 101 books. The symbols, the
extraction, the cleaning, the embedding model and the UMAP and HDBSCAN settings are those of
v3. Two consequences of a larger corpus are handled and stated: the sample cap went from 30 to
15 passages per book and symbol (so 101 books give 21,898 points, not 50,000), and passages one
book reprints from another are left out. The v3 results are archived in
`experiments/history/v3-pilot/` and stay in the research history.

Book-centred (the cross-book view), v3 pilot against v4:

| Measure                           | v3 (10 books) | v4 (101 books) |
| --------------------------------- | ------------- | -------------- |
| Passages mapped                   | 4,804         | 21,898         |
| Clusters                          | 59            | 114            |
| Noise                             | 36 %          | 52 %           |
| Largest book's share of a cluster | 58 %          | 36 %           |
| Clusters over several books       | 25            | 87             |
| Passages in them                  | 32 %          | 44 %           |
| Silhouette (10-D)                 | 0.53          | 0.31           |
| Trustworthiness (2-D)             | 0.83          | 0.74           |

Baseline (no centring), v4: 130 clusters, 49 % noise, largest book 50 % (69 % in v3).

**What the clusters follow** (`platform/nlp/symbolic/validity.py`, adjusted mutual information
between the cluster labels and each property, 0 = chance):

| Property                               | Baseline | Book-centred |
| -------------------------------------- | -------- | ------------ |
| Symbol                                 | 0.13     | 0.20         |
| Book                                   | 0.49     | 0.20         |
| English voice (translator or compiler) | 0.45     | 0.18         |
| Tradition                              | 0.40     | 0.16         |
| Genre                                  | 0.40     | 0.15         |
| Period                                 | 0.24     | 0.09         |
| Source type                            | 0.21     | 0.08         |

Book pairs, book-centred (mean similarity of two books' spread over the clusters, 0–1): 0.27
for pairs that share nothing, 0.31 for the same source type or period, 0.34 for the same
tradition, 0.35 for the same genre, 0.36 for the same English voice (14 pairs).

Reading these honestly:

- With more books, a cluster is less often one book: the largest book's share fell from 58 % to
  36 %, and most clusters now span several books.
- Without centring the map still follows the book (AMI 0.49) far more than the symbol (0.13).
  Book-centring brings symbol and book level (0.20 each); it does not make symbol dominant.
- The structure is weaker: half the points are noise and the silhouette fell from 0.53 to 0.31.
  A wider corpus is more varied, and the parameters were not retuned, by design.
- Shared genre, tradition and English voice still make books more alike than books sharing
  nothing. The voice test rests on 14 pairs and is the least certain.
- No v4 cluster has been reviewed. The five v3 labels were written for v3's clusters and do not
  carry over (`reviews.py` matches them by fingerprint); 61 v4 clusters are ranked for review.
- Not measured: literal against symbolic use of a word; that needs a hand-labelled sample.

## Embedding models (run 2026-10-07)

`python platform/nlp/symbolic/experiments.py --models` embeds the same 21,898 passages with
four sentence-transformers models (all-MiniLM-L6-v2, BAAI/bge-base-en-v1.5, intfloat/e5-base-v2
with its `query: ` prefix, thenlper/gte-base) and runs the baseline and book-centred experiments
for each. It writes `experiments/models/<model>/` and `experiments/models/comparison.json`,
published as `model-comparison.json`. The vectors stay local (`embeddings.npy`), so a rerun skips
the slow part.

HDBSCAN's settings were chosen for MiniLM, and bge-base collapses under them to five clusters
(two book-centred), so cluster counts alone cannot compare models. The comparison therefore adds a
measure with no map and no clusters (`evaluation.neighbourhood`): for each passage, the share of
its 10 nearest neighbours (cosine) from the same book, tradition or symbol, next to the share a
random neighbour would have (1 % same book, 5 % same symbol).

Book-centred:

| Model            | Neighbours, same book | Neighbours, same symbol | Clusters | Book share | Noise | Embedding |
| ---------------- | --------------------: | ----------------------: | -------: | ---------: | ----: | --------: |
| all-MiniLM-L6-v2 |                  26 % |                    26 % |      114 |       36 % |  52 % |     4 min |
| bge-base-en-v1.5 |                  22 % |                    30 % |        2 |        6 % |   4 % |    21 min |
| e5-base-v2       |                  24 % |                    30 % |       88 |       26 % |  66 % |    22 min |
| gte-base         |                  25 % |                    31 % |       98 |       28 % |  61 % |    20 min |

- Every larger model moves the same way: fewer same-book neighbours, about four points more
  same-symbol ones. The step is small next to the book and tradition effect.
- The symbol word is still in each passage, so part of "same symbol" is the word itself.
- The atlas keeps all-MiniLM-L6-v2. A larger model would need new HDBSCAN settings, and those
  should change only after the clusters have been reviewed.
- Centring by translator was not run: only three translators have more than one book in the
  corpus, so it would be almost the same as centring by book.

## Limitations

- Symbol matching is lexicon-based: "fire" in "fire-sword" and "gate" as a door both count, and
  a word used literally counts like one used symbolically.
- A context is not a symbolic meaning; the embedding sees the topic and style of a passage.
- Clusters are exploratory, not ground truth, and their ids carry no meaning. Cross-book
  clusters are not archetypes, and nothing here shows a meaning is universal across cultures.
- The paratext rules are heuristics: some paratext may survive and some short headings over
  narrative may go; the audit records every removal so either can be checked.
- The review priority is a heuristic for where to spend a reader's time, not a measure of
  meaning, and its weights are a choice.
- The corpus is 101 English books chosen from one archive; another selection gives another
  map, and Gutenberg's holdings over-represent nineteenth-century English translators and
  collectors.
- UMAP distorts the high-dimensional geometry; distances between far-apart groups on the map
  mean little.
- HDBSCAN leaves many points as noise by design.

## Future work

- Review the top candidates by hand (`review/representative_passages.parquet`) and record the
  outcome in `reviewed_clusters.json`, rejections included.
- Tune UMAP and HDBSCAN only after the review, so the effect of cleaner text stays isolated.
- Try per-symbol analyses within one book.
- Retune HDBSCAN per embedding model after the review, then compare the models' clusters too.
- More books per tradition, and books in their original languages with a multilingual model.
