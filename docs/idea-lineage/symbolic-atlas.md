<!-- Generated from the Idea Lineage journal. Do not edit; run npm run ideas:build. -->

# Symbolic Atlas

## Current direction
Keep the same 20 symbols and grow the corpus from 10 to 101 public-domain books, so the comparison stays controlled.

## Active decisions
- Centre the embeddings by book before clustering — 2026-10-05, `decision-2026-10-07-001`
  Subtract each book's mean embedding and normalise again, and compare it with masking the symbol word on one shared sample.
- Remove paratext before clustering — 2026-10-05, `decision-2026-10-07-002`
  Cut contents, glossaries, notes and indexes from the books and keep an audit of every removal.
- Only a person's review may name a cluster — 2026-10-05, `decision-2026-10-07-003`
  Clusters are ranked for review and stay numbers until someone has read the passages; rejections are recorded too.
- Expand the corpus to 101 books across 12 traditions — 2026-10-06, `decision-2026-10-07-004`
  Keep the same 20 symbols and grow the corpus from 10 to 101 public-domain books, so the comparison stays controlled.
- Keep all-MiniLM-L6-v2 for the published atlas — 2026-10-07, `decision-2026-10-07-005`
- Open the concept layer with Concept Journey — 2026-10-07, `decision-2026-10-07-006`
  Follow one concept at a time through stories, philosophy, Riksdag speeches and the AI Act; the constellation stays as the exploring view.

## Active hypotheses
- Book identity confounds the representation — 2026-10-05, `hypothesis-2026-10-07-001`
  Style, era and translation make passages from one book alike whatever symbol they hold, and that shared part drives the clusters.

## Experiments
- Four deconfounding variants on one shared sample — 2026-10-05, `experiment-2026-10-07-001`
  Baseline, symbol masked, book-centred and both, each with its own map and clusters on the same occurrences.
- Four embedding models compared by their nearest neighbours — 2026-10-07, `experiment-2026-10-07-002`
  MiniLM, bge-base, e5-base and gte-base on the same 21,898 book-centred passages, scored by the share of each passage's 10 nearest neighbours from the same book or with the same symbol.

## Latest findings
- The baseline clusters followed books, not symbols — 2026-10-05, `finding-2026-10-07-001`
  In the first run a cluster's largest book held 74 % of it on average, and only 5 of 43 clusters drew on several books.
- Book-centring cut the largest-book share from 74 % to 57 % — 2026-10-05, `finding-2026-10-07-002`
  Cross-book clusters rose from 5 to 24 and the silhouette did not drop. Masking the symbol word changed the book share little.
- Glossaries and indexes formed false cross-book clusters — 2026-10-05, `finding-2026-10-07-003`
  One of the largest book-centred cross-book clusters was built from Bulfinch's glossary entries, not from narrative.
- The larger corpus gave broader but weaker structure — 2026-10-06, `finding-2026-10-07-004`
  Book-centred, the largest-book share fell to 36 % and 87 of 114 clusters span several books, while the silhouette fell to 0.31.
- Larger models gained about four points on same-symbol neighbours — 2026-10-07, `finding-2026-10-07-005`
  gte-base put 31 % same-symbol passages among the neighbours against 26 % for MiniLM; same-book neighbours fell from 26 % to 22-25 %.

## Open questions
- Which v4 clusters survive a person's review? — 2026-10-07, `question-2026-10-07-001`
- How often is a symbol word used literally rather than symbolically? — 2026-10-07, `question-2026-10-07-002`
  Needs a hand-labelled sample of occurrences; none exists yet.

## Ideas
- Map symbol words in myth and folklore without predefined meanings — 2026-10-05, `idea-2026-10-07-001`
  Embed the passage around each of 20 symbol words, lay the passages out with UMAP and let HDBSCAN find groups, so any shared meaning has to come from the text.
