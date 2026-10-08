# Philosophy Atlas

`#philosophy-atlas` (experimental) asks: **how do recurring moral and philosophical tensions
organise texts across thinkers and traditions?** It maps passages of thirteen public-domain works
by meaning, groups them, measures how far the groups follow the works rather than the ideas, and
reads the passages through a set of tensions chosen as lenses. No group is named by a machine.

```
python platform/ingest/philosophy/ingest_corpus.py                       # Gutenberg, via rawstore
cd platform && dbt build --profiles-dir . --select tag:philosophy --exclude path:models/gold/philosophy
python platform/nlp/philosophy/pipeline.py                              # sample, embed, map, cluster, tensions
cd platform && dbt build --profiles-dir . --select path:models/gold/philosophy
python platform/publish/philosophy/export_philosophy.py
```
(`npm run philosophy` runs them in order.)

## Corpus

`platform/ingest/philosophy/corpus.json`: one work per thinker, spread over ethics, political
philosophy, epistemology and existential thought, from Plato (*Republic*, Jowett) to Nietzsche
(*Beyond Good and Evil*, Zimmern). Each entry carries title, author, approximate year, period,
tradition, area, original language, text language (English throughout), **translator** (from the
Gutenberg file; null with a note where the file names none: Aristotle's *Ethics*, Marcus
Aurelius) and genre. Ids, titles, authors and translators were checked against each file.

**Only the philosopher's own text.** Editions open with translators' and editors' introductions,
biographies and analyses (Jowett's introduction to the *Republic* runs to thousands of lines) and
close with notes and glossaries. `text_start` / `text_end` in corpus.json mark where the work
itself begins and ends (a line matched in full, its n-th occurrence), and
`platform/nlp/philosophy/passages.py` `own_text` keeps only that span. The shared Gutenberg
cleaning (`nlp/symbolic/cleaning.py`) then removes tables of contents, indexes, footnotes.

Passages: paragraphs joined to at least 60 words and split above 220 at sentence ends; headings
dropped. 7,794 passages in all.

## Pipeline (`platform/nlp/philosophy/pipeline.py`)

1. **Balanced sample**: at most 200 passages per work, evenly spaced through it (2,600).
2. **Embeddings**: `paraphrase-multilingual-MiniLM-L12-v2` (`nlp/text/vectors.py`), the model the
   concept layer uses for every corpus, so these vectors are comparable with the others.
3. **Two maps**, as the Symbolic Atlas learned: *raw*, and *centred per work* (each work's mean
   vector subtracted, `nlp/symbolic/transforms.py`). UMAP 2-D for the map, 10-D for HDBSCAN
   (min cluster size 25).
4. **Evaluation** of each map: groups, noise, largest-work share, groups dominated by one work,
   groups across works (≥ 3 works, none above half), and the share of each passage's ten nearest
   neighbours from the same work and with the same translator, against chance.
5. **Groups**: composition, the six passages nearest the centre, the most distinctive words
   (class-based TF-IDF). Status `unreviewed` unless `nlp/philosophy/reviewed_clusters.json` holds
   a review for the group's fingerprint (hash of its sorted members). Labels come only from there.
6. **Tensions** (`seeds/philosophy/tensions.csv`): eleven pairs (freedom ↔ control, individual ↔
   collective, duty ↔ consequence, …), each pole written as one sentence and embedded; a
   passage's position is its similarity to pole A minus pole B.

## Results (6 October 2026)

| | Raw | Centred per work |
|---|---|---|
| Groups | 20 | 23 |
| Passages in no group | 35 % | 44 % |
| Groups across works | 6 | 19 |
| Groups dominated by one work | 2 | 0 |
| Nearest neighbours from the same work (chance 8 %) | 48 % | 32 % |
| Nearest neighbours with the same translator (chance 14 %) | 58 % | 44 % |

A well-separated group is not necessarily the structure we meant to measure: in the raw map the
work, and the translator's English, organise much of it. Centring per work reduces that a lot,
not entirely. Differences along the tensions are small; the lens is ours.

## Data model

`stg_philosophy_documents` (bronze) → `int_philosophy_passages` (silver, Python) →
`dim_philosophy_document`, `dim_tension`, `mart_philosophy_atlas`, `mart_philosophy_clusters`,
`mart_philosophy_tensions`, `mart_philosophy_tension_poles` (gold). Published under
`frontend/public/data/philosophy/`; no embedding is published.

## Limitations

- Thirteen works do not stand for traditions; this is a corpus for exploring method.
- Translations: nine of thirteen works are English translations, mostly Victorian; translator
  style is measurable in the map.
- Passages are cut mechanically; a passage can join the end of one argument and the start of the
  next.
- Tension poles are single sentences we wrote; another wording would move the positions.
