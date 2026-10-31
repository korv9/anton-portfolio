# The atlas: six corpora in one space

The atlas puts six corpora on one map and clusters them without labels:

- Riksdag party-leader debate passages
- myth and folklore symbol occurrences
- philosophy passages
- provisions of Swedish laws
- paragraphs of the EU AI Act (Swedish and English)
- current job adverts

It is shown on Cluster Visuals under "One map for six corpora".

```bash
ml/.venv/Scripts/python.exe -m ml.atlas.build embed     # load and embed; cached vectors are reused
ml/.venv/Scripts/python.exe -m ml.atlas.build analyse   # align, check, cluster, link, export
```

Code is in `ml/atlas/`: `corpora.py` (loaders), `space.py` (alignment, checks, clustering) and `links.py` (links between corpora). Working files are in `warehouse/features/atlas/`, published files in `frontend/public/data/atlas/`. Tests are in `ml/tests/test_atlas.py`.

## Data (run of 2026-10-31)

| Corpus     | Passages | Group      | Resampling unit | Source                                                     |
| ---------- | -------: | ---------- | --------------- | ---------------------------------------------------------- |
| debates    |   33,023 | party      | debate          | Replik passages, `replik-passages-v1`                      |
| symbols    |   19,810 | tradition  | book            | symbolic observations, `symbolic-context-v1`               |
| laws       |   18,074 | law        | law             | 516 law snapshots, provisions of at least 60 characters    |
| jobs       |    2,854 | occupation | employer        | `ads.json` without duplicates, headline and first 90 words |
| philosophy |    2,600 | author     | work            | the published 200-per-work sample                          |
| ai_act     |    1,392 | article    | article         | numbered paragraphs, Swedish and English                   |

All corpora use one model, `paraphrase-multilingual-MiniLM-L12-v2` at revision `e8f8c211226b`, through the shared embedding cache. Vectors for the debates, symbols and philosophy were already cached. The laws, the AI Act and the job adverts took 107 seconds on a 12-core CPU. Only job-advert headlines are published, never their text.

## Alignment

Raw vectors sort by corpus: 97.7% of a passage's 15 nearest neighbours come from its own corpus, against 30.2% at random. Centring each corpus (and each AI Act language) on its own mean only brought that to 93.6%.

The rule for choosing an alignment was fixed before any clusters were looked at: the lowest corpus purity whose translation match is no worse than centring. Translation match asks whether each Swedish AI Act paragraph finds its English original as its nearest English paragraph.

Five alignments were compared on a sample of 6,000 passages:

| Alignment                                   |    Purity | Translation match |
| ------------------------------------------- | --------: | ----------------: |
| centring                                    |     0.936 |             0.988 |
| centring, top 5 components removed          |     0.921 |             0.988 |
| centring, top 15 components removed         |     0.900 |             0.982 |
| per-corpus z-score                          |     0.933 |             0.986 |
| **per-corpus ZCA whitening, shrinkage 0.1** | **0.775** |         **0.996** |
| per-corpus ZCA whitening, shrinkage 0.3     |     0.783 |             0.996 |

Whitening with shrinkage 0.1 was used. Purity remains well above random, because laws, myths and debates mostly do talk about different things.

## Clustering

The aligned vectors are reduced with a 10-dimensional cosine UMAP (15 neighbours, seed 0) and clustered with HDBSCAN (`min_cluster_size` 150, `min_samples` 15). The map is a separate 2-D UMAP with 30 neighbours.

The run found 123 clusters, and 39.1% of passages are noise. In 36 clusters at least two corpora each hold 20% or more of the passages. Examples:

- Migration debates with the reception and aliens laws (71% debates, 22% laws).
- Children in care: the social services act and debates on the Convention on the Rights of the Child.
- The Coast Guard act, the Baltic Sea debates and the sea in Beowulf.
- The Gambling act next to the board game in the Grettir saga.
- The Animal welfare act, the debate on fur farming and Hume on animals.

Group terms are class-based TF-IDF and have not been reviewed.

## Links between corpora

Each passage in corpus A gets its 5 nearest passages in corpus B. The lift of group a towards group b is:

```
P(neighbour in b | passage in a) / P(neighbour in b | passage in A)
```

A lift of 1 means no difference from the rest of the corpus, and corpus B's hubs cancel out. The 95% interval resamples A's units 300 times: debates, books, works, laws, articles or employers. Groups need at least 40 passages. A link is shown only when the lower bound is above 1.

Clear links, with 95% intervals:

| From | To                           | Lift | 95% interval |
| ---- | ---------------------------- | ---: | -----------: |
| KD   | christian-biblical myth      | 1.27 |    1.16–1.36 |
| SD   | norse-germanic myth          | 1.19 |    1.08–1.30 |
| M    | greek-roman myth             | 1.19 |    1.14–1.24 |
| MP   | greenhouse-gas emissions act | 3.23 |    2.86–3.65 |
| MP   | Animal welfare act           | 2.88 |    2.27–3.31 |
| V    | Private letting act          | 2.64 |    1.96–3.20 |
| V    | Discrimination act           | 1.94 |    1.67–2.21 |
| S    | unemployment insurance act   | 1.69 |    1.52–1.90 |
| MP   | Hume                         | 1.20 |    1.12–1.28 |
| L    | Nietzsche                    | 1.15 |    1.07–1.21 |
| V    | Epictetus                    | 1.15 |    1.09–1.21 |
| M    | Kant                         | 1.13 |    1.07–1.19 |

Links to philosophers are the weakest, all under 1.21. The AI Act has no clear link to any law. Job-advert groups are small and their intervals wide (some span 1.1 to 13), so those links are not shown on the page.

## Limitations

- A link says that passages sit near each other in the model's space. It does not say that a party cites a law or holds a philosopher's views. KD → christian-biblical may only be shared vocabulary.
- The debates are party-leader debates only, from 1993 to 2026. The laws are the 516 snapshots the site carries, not the whole statute book.
- The philosophy and myth texts are English translations, and the debates and laws are Swedish. Whitening reduces the language axis but does not remove it.
- Job adverts cover about four months of IT adverts and are too few to carry links on their own.
- The clustering ran once, with seed 0. Its stability across seeds has not been measured.
- The run was local, on 12 cores. It took 107 s to embed and 310 s to analyse.
