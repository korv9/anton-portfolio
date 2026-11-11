# The atlas: six corpora in one space

Version 2 is the published one; its rules and results start at "Version 2: rules fixed before the
run". The sections Alignment, Clustering and Links between corpora record version 1.

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

All corpora use one model, `paraphrase-multilingual-MiniLM-L12-v2` at revision `e8f8c211226b`, through the shared embedding cache. Vectors for the debates, symbols and philosophy were already cached. The laws, the AI Act and the job adverts took 107 seconds on a GTX 1660 SUPER GPU, which `embed.py` picks when CUDA is available. Only job-advert headlines are published, never their text.

## Alignment (version 1)

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

Version 1 used whitening with shrinkage 0.1. Purity remains well above random, because laws, myths and debates mostly do talk about different things.

## Clustering (version 1)

The aligned vectors are reduced with a 10-dimensional cosine UMAP (15 neighbours, seed 0) and clustered with HDBSCAN (`min_cluster_size` 150, `min_samples` 15). The map is a separate 2-D UMAP with 30 neighbours.

The version 1 run found 123 clusters, and 39.1% of passages were noise. In 36 clusters at least two corpora each held 20% or more of the passages. Examples:

- Migration debates with the reception and aliens laws (71% debates, 22% laws).
- Children in care: the social services act and debates on the Convention on the Rights of the Child.
- The Coast Guard act, the Baltic Sea debates and the sea in Beowulf.
- The Gambling act next to the board game in the Grettir saga.
- The Animal welfare act, the debate on fur farming and Hume on animals.

Group terms are class-based TF-IDF and have not been reviewed.

## Links between corpora (version 1)

Each passage in corpus A gets its 5 nearest passages in corpus B. The lift of group a towards group b is:

```
P(neighbour in b | passage in a) / P(neighbour in b | passage in A)
```

A lift of 1 means no difference from the rest of the corpus, and corpus B's hubs cancel out. The 95% interval resamples A's units 300 times: debates, books, works, laws, articles or employers. Groups need at least 40 passages. In version 1 a link was shown only when the lower bound was above 1.

Clear links in version 1, with 95% intervals:

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

## Version 2: rules fixed before the run (2026-10-31)

A review of version 1 found that its intervals were too narrow for three corpora and that its alignment rule could be met by destroying information. Version 2 changes the method. These rules were written down before version 2 was run.

Inference for links:

- A group with fewer than 5 units (a philosopher with one work, a law, an AI Act article) is resampled in blocks of 20 consecutive passages within each unit.
- Each link gets a one-sided p-value from the bootstrap: the observed log lift divided by the bootstrap standard deviation of the log lift, read against a normal distribution.
- Benjamini–Hochberg is applied across every link tested, in all corpus pairs together. A link is shown when q < 0.05 and the lower bound of its 95% interval is above 1.
- Calibration: the same procedure is run 3 times with group labels shuffled between resampling blocks. Version 2 is reported as calibrated if those runs together produce at most 5% of the real run's links.

Cluster stability:

- The 10-d UMAP and HDBSCAN run with seeds 0 to 4. Seed 0 is the reference.
- A seed-0 cluster is stable when its best match in a run has Jaccard ≥ 0.5 in at least 3 of the 4 other runs. Unstable clusters are published as noise.
- The adjusted Rand index between seed 0 and each run, over passages that no run calls noise, is reported.

Alignment, chosen from four candidates: whitening with shrinkage 0.1 (version 1), whitening with Ledoit–Wolf shrinkage, and whitening with shrinkage 0.1 followed by removing the top 5 or top 20 language directions. Language directions are the main components of the differences between whitened Swedish and English AI Act paragraph pairs. They are estimated on articles with an even number and measured on articles with an odd number.

- Translation match is measured on the odd articles only. It must be at least what centring gives.
- Retention: the share of passages whose group (party, tradition, occupation) wins a 15-neighbour vote among other units of the same corpus. Averaged over debates, symbols and jobs as a ratio to raw vectors, it must be at least 0.90.
- Among candidates that pass both, the one with the lowest corpus purity is chosen. Candidates within 0.01 of it are compared on the gap between the share of cross-corpus neighbours in the same language and the share a random neighbour would give. The smallest gap wins.

## Version 2: results (2026-10-31)

All four alignments passed both checks. The language directions changed little: removing 20 of them lowered purity from 0.775 to 0.769, and translation match stayed at 0.996 on the odd articles.

| Alignment                |    Purity | Translation (odd) | Retention ratio | Same-language neighbours | Random |
| ------------------------ | --------: | ----------------: | --------------: | -----------------------: | -----: |
| whitening, 0.1           |     0.775 |             0.996 |           1.071 |                    0.574 |  0.408 |
| **whitening, Ledoit–Wolf** | **0.774** |         **0.996** |       **1.060** |                **0.545** |  0.408 |
| whitening, 0.1, −5 dirs  |     0.773 |             0.996 |           1.073 |                    0.573 |  0.408 |
| whitening, 0.1, −20 dirs |     0.769 |             0.996 |           1.059 |                    0.567 |  0.408 |

Every candidate was within 0.01 of the lowest purity, so the tie-break decided: Ledoit–Wolf has the smallest language gap. Whitening raised retention above raw vectors in every candidate, so it does not destroy the groups. The language gap remains: 55% of cross-corpus neighbours share a language against 41% at random.

Stability: seed 0 found 137 clusters, and 87 of them came back in at least 3 of the 4 other runs. The adjusted Rand index against seed 0 was 0.91 to 0.93. With the unstable clusters published as noise, 54.6% of passages are noise, and 22 of the 87 clusters mix corpora.

Links: 3,685 were tested and 71 pass the rule, against 149 under version 1's rule. The three shuffled runs produced 1, 3 and 4 links, 8 in total against a limit of 10.65, so the procedure counts as calibrated. All twelve party links in the table above survive, with lifts within 0.1 of version 1 (for example KD → christian-biblical 1.23, MP → greenhouse-gas emissions act 3.07). New among the clear links: KD → Kierkegaard (1.28, 1.21–1.36) and SD → Kierkegaard (1.19). The largest drops were philosophy → symbols (37 to 9), whose single-work authors had intervals that were too narrow, and job adverts → laws (30 to 12) and debates → job adverts (21 to 7), which the false discovery rate removed. Debates → laws kept all 24. The AI Act still has no clear link to any law.

The full analysis took 766 seconds: 681 for the five seeds and the map in three parallel processes, the rest for the links and their null runs.

## Dimension-reduction benchmark (2026-10-31): not adopted

This benchmark tested whether another reducer gives a better atlas. The published atlas does not use its results and stays on version 2. The code is in `ml/experiments/dr_bench/`; the rules and raw results are in `tmp/dr-bench/`, which Git ignores, so they are summarised here.

Rules, fixed before any method ran:

- Every method was fit on 20,000 passages stratified by corpus, from the Ledoit–Wolf whitened vectors, with seeds 0 to 2. The top methods were then checked on all 77,753 passages with production settings (HDBSCAN 150/15).
- A cluster is stable when its best match has Jaccard ≥ 0.5 in both other seeds. Version 2's rule is 3 of 4 other seeds, so the baseline here is 83 where version 2 reports 87.
- To be eligible for the clustering win, a method needs noise at most 5 points above `umap10`, retention at least 0.95 of `umap10`'s, and mean ARI at least 0.80. The most stable clusters then win, and a clear win needs at least 1.10 times the baseline's count.
- The best map has the lowest rank sum on 15-neighbour preservation and trustworthiness.

Clustering input, on all passages:

| Method                  | Clusters | Stable | Noise, published | Noise, raw | Mean ARI | Mixed |
| ----------------------- | -------: | -----: | ---------------: | ---------: | -------: | ----: |
| `umap10`, production    |      137 |     83 |            57.4% |      37.9% |    0.902 |    20 |
| `umap10` with exact kNN |      101 |     87 |            54.3% |      47.7% |    0.956 |    21 |

On 20,000 passages the exact 15-neighbour graph gave 96 stable clusters against 75, a clear win by the rule. On all passages 87 against 83 falls short of the 92 a clear win needs, though the order holds and ARI rises. It finds fewer clusters, calls more passages noise before unstable clusters are removed, and its 10-d space sorts more by corpus (purity 0.846, aligned vectors 0.774). The baseline's 10-d embeddings were not kept, so the full-data comparison of purity and retention is missing.

The other 20,000-passage candidates did not compete: DensMAP reached 42 stable clusters, PLSCAN 8, LocalMAP 3 and PaCMAP 1, and PCA to 50 dimensions found no clusters. EVoC, comparison only, had 4. TriMap failed to install.

Map, on all passages:

| Method            | 15-neighbour preservation | Trustworthiness | Peak memory |
| ----------------- | ------------------------: | --------------: | ----------: |
| UMAP 2-d, current |                     0.094 |           0.655 |     3.76 GB |
| openTSNE          |                     0.278 |           0.713 |     4.55 GB |

openTSNE also won on 20,000 passages. TorchDR's UMAP ran out of GPU memory on the full set.

Timings are rough, because up to three processes ran at once. Adopting either result would change the published clusters and links, and would need the version 2 checks rerun on it.

## Limitations

- A link says that passages sit near each other in the model's space. It does not say that a party cites a law or holds a philosopher's views. KD → christian-biblical may only be shared vocabulary.
- The debates are party-leader debates only, from 1993 to 2026. The laws are the 516 snapshots the site carries, not the whole statute book.
- The philosophy and myth texts are English translations, and the debates and laws are Swedish. Whitening reduces the language axis but does not remove it.
- Job adverts cover about four months of IT adverts and are too few to carry links on their own.
- Stability is measured over five seeds of one UMAP and HDBSCAN setting. Other settings were not tried.
- The run was local, on 12 cores. It took 107 s to embed and 766 s to analyse.
