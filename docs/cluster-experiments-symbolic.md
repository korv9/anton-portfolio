# Clustering experiments: Symbol Lab

Run on 2026-10-29 under the shared protocol in [cluster-experiments.md](cluster-experiments.md),
with the frozen criteria in `configs/experiments/symbolic.yaml`. Code: `ml/experiments/symbolic.py`,
`symbolic_data.py`, `symbolic_fit.py`; tests in `ml/experiments/tests/test_symbolic.py`.

**Decision: the champion stays.** All three candidates were rejected on the evaluation side. The
registry (`warehouse/features/experiments/registry/symbolic/registry.json`) holds the champion and
the three rejected runs with their acceptance reports. Nothing here changes the published Symbol
Lab page; only `platform/nlp/symbolic/pipeline.py` does.

## Data

- Sample: the published one. At most 15 occurrences per book and symbol, lowest occurrence ids,
  passages silver marks as reprints (`duplicate_of`, 436 of 72,926 occurrences) left out. 21,898
  observations from 101 books. Dataset version `c8602cc0e9e4349d`.
- Identical contexts: 1,784 contexts appear more than once (3,872 rows), all inside one book. They
  are one context holding two or more symbol words (median two symbols per repeated context), so
  the same text, and the same vector, is counted once per symbol.
- Normalised text (lower case, letters and digits only): no extra cross-book matches. Near-identical
  contexts across books (MiniLM cosine at least 0.95): 36 pairs, 57 rows, 8 book pairs. Each such
  component was given one shared key, so it lands on one side of the split.
- Split by `document_id` with `ml.experiments.splits`, seed 0: selection 11,388 observations from 53
  books, evaluation 10,510 from 48 books. No book, text hash, normalised hash or near-identical pair
  crosses the sides.
- Cleaning check (`symbolic_data.boilerplate`): no contexts with Project Gutenberg text,
  `[Illustration` tags or U+FFFD encoding loss. Residue that remains: footnote marks like `[12]` in
  800 contexts (3.7%, 39 books), `_italic_` markup in 1,026 (4.7%, 47 books), `CHAPTER` in 113
  (0.5%). None is concentrated in one book (largest single-book share of hits 0.11 to 0.28), so no
  cleaning variant was added. The examples below show that editorial apparatus still forms its own
  group in one candidate.

## Selection side (seeds 0, 1, 2; 11,388 observations)

Every representation was reduced with the champion's UMAP (10-D, 15 neighbours, min_dist 0, cosine)
and clustered with a small grid: HDBSCAN min_cluster_size/min_samples 20/10 (v4), 20/5, 50/10,
100/10, 50/10 leaf, and K-means k=30 and k=60. Embedding models: the champion's all-MiniLM-L6-v2 and
paraphrase-multilingual-MiniLM-L12-v2 (both already in the local cache). bge-base, e5-base and
gte-base were not rerun: the earlier comparison (`frontend/public/data/symbolic/model-comparison.json`)
found bge collapsing to 2 to 5 clusters, and e5 and gte no less book-dominated than MiniLM
(same-book neighbour share 0.41 against 0.38) at six times the embedding time.

Neighbour share (k=10, same value among cosine neighbours; chance: book 0.011, symbol 0.054):

| representation | book | tradition | symbol |
|---|---|---|---|
| context, MiniLM, raw (champion) | 0.416 | 0.589 | 0.221 |
| context, MiniLM, book-centred | 0.298 | 0.445 | 0.254 |
| matching sentence only, MiniLM, raw | 0.201 | 0.356 | 0.413 |
| symbol word masked, MiniLM, raw | 0.415 | 0.591 | 0.137 |
| masked, MiniLM, book-centred | 0.297 | 0.451 | 0.140 |
| context, multilingual MiniLM, raw | 0.324 | 0.489 | 0.219 |
| context, multilingual MiniLM, book-centred | 0.225 | 0.363 | 0.248 |

Selected rows (weighted top share of the dominant book or symbol per group; full table in
`warehouse/ml/experiments/symbolic/select.json`):

| representation, clustering | groups | noise | seed ARI | silhouette (rep.) | book | symbol |
|---|---|---|---|---|---|---|
| champion, HDBSCAN 20/10 | 77 | 0.392 | 0.784 | 0.027 | 0.413 | 0.217 |
| champion, HDBSCAN 50/10 | 36 | 0.424 | 0.955 | 0.037 | 0.349 | 0.202 |
| champion, HDBSCAN 100/10 | 19 | 0.436 | 0.922 | 0.040 | 0.282 | 0.177 |
| champion, K-means 30 | 30 | 0 | 0.625 | 0.000 | 0.223 | 0.173 |
| book-centred, HDBSCAN 20/10 | 74 | 0.509 | 0.881 | 0.034 | 0.227 | 0.364 |
| sentence only, HDBSCAN 20/10 | 65 | 0.484 | 0.946 | 0.025 | 0.171 | 0.536 |
| masked, HDBSCAN 20/10 | 90 | 0.484 | 0.934 | 0.054 | 0.545 | 0.168 |
| masked + book-centred, HDBSCAN 20/10 | 70 | 0.518 | 0.721 | 0.013 | 0.238 | 0.187 |
| masked + book-centred, HDBSCAN 50/10 | 2 | 0.026 | 0.347 | 0.002 | 0.034 | 0.066 |
| multilingual, HDBSCAN 100/10 | 20 | 0.547 | 0.899 | 0.047 | 0.197 | 0.219 |

Chosen candidates, each a different hypothesis and each passing every frozen criterion on the
selection side:

1. **Retuned HDBSCAN (50/10)** on the champion representation: same groups' basis, more stable
   (ARI 0.955 against 0.784) and less book-dominated (0.349 against 0.413).
2. **Masked symbol word, book-centred, HDBSCAN 20/10**: the only setting that lowered both book
   (0.238) and symbol-word (0.187) dominance.
3. **Multilingual MiniLM, HDBSCAN 100/10**: the alternative model with the lowest book dominance
   (0.197) whose symbol dominance stayed within the 0.02 margin.

## Evaluation side (seeds 10 to 14; 10,510 observations, 48 books)

| criterion (frozen) | champion | retuned 50/10 | masked + centred | multilingual 100/10 |
|---|---|---|---|---|
| seed ARI ≥ 0.5 | 0.939 | 0.940 ✓ | 0.732 ✓ | 0.453 ✗ |
| groups ≥ 5 | 72 | 36 ✓ | 66 ✓ | 16 ✓ |
| noise ≤ 0.6 | 0.371 | 0.403 ✓ | 0.453 ✓ | 0.501 ✓ |
| book top share, at most +0.02 | 0.473 | 0.430 ✓ | 0.240 ✓ | 0.199 ✓ |
| symbol top share, at most +0.02 | 0.216 | 0.193 ✓ | 0.171 ✓ | 0.181 ✓ |
| silhouette in representation, at most −0.03 | 0.042 | 0.047 ✓ | 0.008 ✗ | 0.044 ✓ |
| a gain of 0.05 (book, symbol or ARI) | | ✗ (book −0.043, symbol −0.023, ARI +0.001) | ✓ book | ✓ book |
| **decision** | champion | rejected | rejected | rejected |

Other measures, champion / retuned / masked + centred / multilingual: minimum seed ARI 0.922 /
0.892 / 0.460 / 0.023; clusters per seed 69–75 / 31–38 / 66–85 / 2–17; silhouette in the clustered
space 0.479 / 0.516 / 0.300 / 0.375; largest group share 0.106 / 0.106 / 0.179 / 0.119; tradition
top share 0.682 / 0.668 / 0.420 / 0.533; book AMI 0.527 / 0.533 / 0.249 / 0.357; groups with a
majority from one book 51 / 19 / 22 / 0 of 72 / 36 / 66 / 16; book-specific term share (top terms
used at least 80% in one book) 0.220 / 0.184 / 0.233 / 0.062. Every observed book and symbol top
share is far above its size-preserving null p95 (book 0.049 to 0.065, symbol 0.085 to 0.104).

## Negative results

- The selection-side gain of retuning did not transfer: on the evaluation books the v4 parameters
  were already as stable (ARI 0.939) as 50/10 (0.940), and the book share fell by 0.043, short of
  the 0.05 gain the criteria require.
- Book centring lowers book dominance in every setting but raises symbol-word dominance (0.217 to
  0.364 with HDBSCAN 20/10) unless the symbol word is masked: once the book's mean is removed, the
  symbol word is what is left to group on.
- Masking alone lowers symbol dominance (0.217 to 0.168) and raises book dominance (0.413 to 0.545).
- Masking with centring separates the groups poorly in the embedding space (silhouette 0.008) and
  is less stable (minimum seed ARI 0.460); with min_cluster_size 50 or 100 it collapses to two groups.
- The matching sentence alone is dominated by the symbol word (symbol top share 0.536, same-symbol
  neighbours 0.413).
- The multilingual model with large groups is unstable across seeds (one seed found two groups).
- K-means assigns everything and has no separation (silhouette about 0) and lower seed ARI (0.46 to
  0.65). Its lower top shares come from forcing every point into a group, not from better groups.
- Weighted top share falls mechanically when groups get fewer and larger (its null falls too); the
  frozen criteria use the raw share, so a coarser clustering can earn a "gain" without being less
  book-bound. The null p95 is stored next to each value for that reason.

## Examples checked (evaluation side, exported run files)

- Champion, largest group (1,115 contexts): top terms "thou, thy, thee, heaven, earth, god";
  representatives from Longfellow's Divine Comedy. It groups an archaic verse register, which is a
  translation style, not a shared symbolic use.
- Champion, group 69 (20 contexts, 60% Mighty Mikko): two representatives are the same context, once
  for "door" and once for "blood". Repeated multi-symbol contexts reach the examples.
- Champion, group 43 (367 contexts, 45% "bird"): birds that speak or transform across Grimm, Jataka
  and Czech tales; its borderline member is a Dante passage about a tree.
- Masked + centred, group 39 (288 contexts): tables of contents, essay prefaces and numbered tablet
  lines; editorial apparatus that the cleaning check's patterns do not catch.
- Masked + centred, largest group (1,883 contexts, 17.9%): a catch-all of dialogue from many books.

## Limitations

- Groups are computed context groups of symbol-word occurrences, not universal symbol meanings. Names
  are generated terms, unreviewed.
- There is no hand-labelled sample of literal against symbolic uses, so no model was fine-tuned and no
  group is validated as symbolic.
- The runs use half the books (the evaluation side). The published map uses all 101 books with seed 42
  (136 groups, 50.5% noise); the refitted champion here has 72 groups and 37.1% noise on 48 books.
- The MiniLM weights are revision `c9745ed1…`, the local cache's version. It reproduces the published
  `occurrence_embeddings.parquet` vectors (max absolute difference 1e-7 on 50 checked rows).
  `configs/cluster_lab/symbolic_atlas.yaml` pins `1110a243…`, which is not in the cache, so it was not used.
- The 2-D maps are separate UMAP fits per run. One fell back from spectral to random initialisation
  (identical repeated contexts give a small eigengap).

## Resources

Local, Windows 10, 12 CPU threads, GTX 1660 for embeddings. Under `runtime.heavy`:
prepare 3 min 22 s (MiniLM embedding of 21,898 contexts 44 s, peak 1.2 GB); select 7 units, 70 to
111 s each (about 10 min, peak 2.6 GB); final 4 runs of 5 seeds, 52 to 89 s each (about 5 min, peak
2.6 GB); export 1 min 22 s. Run files 330 to 487 KB each.

## Commands

    HF_HUB_OFFLINE=1 ml/.venv/Scripts/python.exe -m ml.experiments.symbolic prepare
    HF_HUB_OFFLINE=1 ml/.venv/Scripts/python.exe -m ml.experiments.symbolic select --deadline-minutes 120
    HF_HUB_OFFLINE=1 ml/.venv/Scripts/python.exe -m ml.experiments.symbolic final --deadline-minutes 120
    HF_HUB_OFFLINE=1 ml/.venv/Scripts/python.exe -m ml.experiments.symbolic export
    ml/.venv/Scripts/python.exe -m pytest ml/experiments/tests/test_symbolic.py -q -p no:cacheprovider --basetemp tmp/pytest-symbolic

Logs: `tmp/symbolic-{prepare,select,final,export}.log`; prepared data and checkpoints under
`warehouse/ml/experiments/symbolic/` (local, holds text).

## Not done

- No resample stability (`evaluate.resample_stability`); seed stability only.
- The pinned config revision `1110a243…` of MiniLM was not downloaded and compared.
- Deduplicating multi-symbol contexts (one row per context) was measured but not tried as a variant.
- Editorial apparatus (contents pages, numbered notes) is not filtered; it needs a cleaning rule in
  `platform/nlp/symbolic/cleaning.py`, not here.
- `select` was rerun on CPU in GitHub Actions (run 40999907253, 16 min 12 s, 3.11 GB peak). Its rows
  were not compared one by one with the local GPU run, and `final` has not run there.
