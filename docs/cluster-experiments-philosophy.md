# Clustering experiments: Philosophy Lab

Run on 2026-10-29 under the shared protocol ([cluster-experiments.md](cluster-experiments.md)), with
the criteria in `configs/experiments/philosophy.yaml` (frozen 2026-10-29, not edited). Code:
`ml/experiments/philosophy.py` (prepare, data, embeddings), `philosophy_runs.py` (select, final),
`philosophy_export.py` (export), tests in `ml/experiments/tests/test_philosophy.py`.

## Result in short

Two of three candidates passed every frozen criterion against the refitted champion. The registry
champion is now **K-means k=10 on the champion's own space** (run `2938d83298589cc8`). The
bge-small candidate (`f367c26d34300562`) also passed and stays a candidate. The HDBSCAN
min_cluster_size 40 candidate (`426875670a55f5f2`) was rejected on separation.

**Rolled back on 2026-10-30.** The CPU rerun of `final` on the runner rejected K-means 10 on
separation and passed bge-small instead
([Final on the runner](cluster-experiments.md#final-on-the-runner-2026-10-30)). A decision that
flips between machines shows no improvement, so the registry champion is the original pipeline
(`6efd7326ea66b9c3`) again. K-means 10 is a candidate with its local report.

**Runner decides, 2026-10-30.** The owner made the runner the deciding machine, and two runner
runs agree, so the registry now holds the runner's decision
([The runner decides](cluster-experiments.md#the-runner-decides-2026-10-30)).

**The published Philosophy Atlas page does not change.** Promotion in
`warehouse/features/experiments/registry/philosophy/registry.json` only marks a run as champion
for Cluster Visuals. The site's atlas still comes from `platform/nlp/philosophy/pipeline.py`.
Changing that pipeline would be a separate decision, and the tradeoffs below argue for review
first.

## Champion

The site page shows the `author_centered` map by default (`PhilosophyAtlasPage.tsx`, the default
`karta` parameter). The champion is therefore the work-centred published pipeline: at most 200
passages per work, evenly spaced; MiniLM (`paraphrase-multilingual-MiniLM-L12-v2`, revision
`e8f8c211`); each work's mean subtracted and the vectors normalised again; UMAP 10-D, n_neighbors 15,
min_dist 0, cosine; HDBSCAN min_cluster_size 25, min_samples 8. I checked the refit against the
published run: the pinned-revision vectors match the published `embeddings.npy` (cosine ≥ 0.9999998
on all 1,200 selection-side passages, which were in the published sample). Two protocol
differences apply. UMAP uses seeds 10 to 14 rather than random_state 42, and the refit uses only
the evaluation works.

## Data and split

- Observations: all 7,795 passages of `silver.int_philosophy_passages`; `observation_id` = `passage_id`.
  Stored with text in `warehouse/ml/experiments/philosophy/observations.parquet` (local only). Sizes,
  without text, are in `warehouse/features/experiments/philosophy/dataset.json`.
- `dataset_version` `9b854dbced0fcc49` (hash of ids and text hashes, text version `philosophy-passages-v1`).
- Work-level split (`document_id`, split seed 0). `splits.check` found no leaks: no work and no text
  appears on both sides.

| Side       | Works                                                        | Passages | Sampled (≤200/work) |
| ---------- | ------------------------------------------------------------ | -------- | ------------------- |
| Selection  | Hobbes, Kant, Kierkegaard, Marcus Aurelius, Plato, Spinoza   | 4,394    | 1,200               |
| Evaluation | Aristotle, Epictetus, Hume, Locke, Mill, Nietzsche, Rousseau | 3,401    | 1,400               |

A work-level split is workable but thin, with 6 and 7 works per side. Dominance is measured within a side.

Translator field: the named translator; `original English` for works written in English; and
`unnamed (<work>)` for translations whose Gutenberg file names nobody, because two unnamed
translators are not known to be one person. **On the selection side every work has its own translator
value, so translator dominance there equals work dominance and says nothing more.** On the evaluation
side, Hume, Locke and Mill share `original English`.

## Selection (selection side, seeds 0, 1, 2)

48 configurations: 4 embedding variants × 2 representations (raw, work-centred) × 6 clusterings
(HDBSCAN min_cluster_size 12/25/40 with min_samples 8; K-means k 6/10/15, all on the UMAP 10-D space).

- Passage unit. MiniLM reads at most 128 word pieces. The median passage is 186 tokens, and 71.4% of
  selection passages are cut off. `chunks80` embeds each passage as 80-word pieces and averages them,
  so the whole passage is read. A longer window was not tried: it would only be cut off more.
- Models (pinned): MiniLM `e8f8c211` (current, 128 tokens); `all-mpnet-base-v2` `e8c3b32e`
  (384 tokens, 0.1% truncated); `BAAI/bge-small-en-v1.5` `5c38ec7c` (512 tokens, none truncated).
  Both alternatives read English only. That fits this corpus, but they cannot place Swedish
  text next to it the way the shared multilingual model can.

Neighbour share (k=10, share of a passage's nearest neighbours from the same work; chance 0.167):

| Embedding       | raw   | centred |
| --------------- | ----- | ------- |
| MiniLM passage  | 0.678 | 0.498   |
| MiniLM chunks80 | 0.694 | 0.518   |
| mpnet           | 0.755 | 0.604   |
| bge-small       | 0.727 | 0.546   |

Every model and unit is strongly organised by work. Centring cuts that by 0.15 to 0.18 and never
gets near chance. Reading the whole passage (chunks80, mpnet, bge) _raises_ same-work
neighbours. The stronger English models pick up more of what makes each work and translation sound
like itself.

Selected rows (work top share; null p95 in brackets; "sil" = silhouette in the representation space):

| Configuration                            | Groups | Noise | Seed ARI | Work top share | sil   |
| ---------------------------------------- | ------ | ----- | -------- | -------------- | ----- |
| **MiniLM centred HDBSCAN 25 (champion)** | 13     | 0.299 | 0.911    | 0.517 (0.243)  | 0.047 |
| MiniLM centred HDBSCAN 40                | 5      | 0.177 | 0.865    | 0.367 (0.212)  | 0.034 |
| MiniLM centred K-means 10                | 10     | 0     | 0.824    | 0.421 (0.223)  | 0.024 |
| MiniLM centred K-means 6                 | 6      | 0     | 0.806    | 0.371 (0.209)  | 0.029 |
| MiniLM chunks80 centred HDBSCAN 25       | 15     | 0.332 | 0.952    | 0.541 (0.258)  | 0.061 |
| mpnet centred HDBSCAN 12                 | 23     | 0.282 | 0.306    | 0.694 (0.275)  | 0.058 |
| mpnet centred K-means 6                  | 6      | 0     | 0.885    | 0.432 (0.210)  | 0.026 |
| bge-small centred HDBSCAN 40             | 8      | 0.237 | 0.938    | 0.439 (0.235)  | 0.027 |
| bge-small raw HDBSCAN 25                 | 13     | 0.315 | 0.889    | 0.911 (0.255)  | 0.067 |
| MiniLM raw HDBSCAN 25                    | 10     | 0.212 | 0.948    | 0.693 (0.231)  | 0.042 |

All 48 rows are in `warehouse/features/experiments/philosophy/selection.json`.

Chosen candidates and why. The rule was the frozen criteria applied to selection-side numbers; the
order runs from the smallest change to the largest:

1. **HDBSCAN min_cluster_size 40**, otherwise the champion. This is the smallest change, and work
   dominance fell 0.15 at a similar ARI. Risk: only 5 groups on this side.
2. **K-means k=10 on the champion's space.** This is the K-means baseline at the champion's group
   count. Work dominance was 0.10 lower, though everything is forced into a group (no noise).
3. **bge-small, centred, HDBSCAN 40/8.** This is the model axis: it reads the whole passage. It was
   the most stable alternative model (ARI 0.938), with work dominance 0.08 lower than the champion.

Not chosen: all raw representations (work dominance 0.62 to 0.91); chunks80, which was more
stable but more work-dominated than the champion on HDBSCAN; mpnet, which was less stable
(ARI 0.306 at mcs 12) and more work-dominated than bge-small at each setting.

## Final evaluation (evaluation side, seeds 10 to 14)

Each run was fitted with `fit.evaluate_candidate` and judged with `accept.check` against the
refitted champion (criteria sha256 is in each report).

| Criterion                               | Champion (MiniLM centred HDBSCAN 25/8) | HDBSCAN 40         | K-means 10           | bge-small HDBSCAN 40  |
| --------------------------------------- | -------------------------------------- | ------------------ | -------------------- | --------------------- |
| Seed ARI ≥ 0.5                          | 0.929                                  | 0.584 ✓            | 0.676 ✓              | 0.865 ✓               |
| ≥ 5 groups                              | 14                                     | 6 ✓                | 10 ✓                 | 9 ✓                   |
| Noise ≤ 0.55                            | 0.366                                  | 0.231 ✓            | 0.000 ✓              | 0.354 ✓               |
| Work top share, ≤ champion + 0.02       | 0.365                                  | 0.264 ✓            | 0.264 ✓              | 0.312 ✓               |
| Translator top share, ≤ champion + 0.02 | 0.532                                  | 0.456 ✓            | 0.431 ✓              | 0.489 ✓               |
| Separation (repr.), ≥ champion − 0.03   | 0.054                                  | 0.013 ✗            | 0.028 ✓              | 0.038 ✓               |
| Gain ≥ 0.05 (work, translator or ARI)   | –                                      | work, translator ✓ | work, translator ✓   | work ✓                |
| **Decision**                            | –                                      | **rejected**       | **passed, champion** | **passed, candidate** |

Measured alongside the criteria, not judged:

|                                     | Champion      | HDBSCAN 40    | K-means 10    | bge-small     |
| ----------------------------------- | ------------- | ------------- | ------------- | ------------- |
| Work top share null p95             | 0.221         | 0.186         | 0.193         | 0.213         |
| Translator top share null p95       | 0.467         | 0.449         | 0.429         | 0.463         |
| Work AMI                            | 0.157         | 0.098         | 0.076         | 0.122         |
| Groups mostly one work              | 3             | 1             | 0             | 0             |
| Language / genre top share          | 0.545 / 0.579 | 0.468 / 0.461 | 0.456 / 0.489 | 0.489 / 0.533 |
| Groups per seed                     | 14–16         | 5–10          | 10            | 7–9           |
| Seed ARI min                        | 0.888         | 0.365         | 0.607         | 0.757         |
| Largest group share                 | 0.124         | 0.471         | 0.136         | 0.148         |
| Same-work neighbours (chance 0.143) | 0.386         | 0.386         | 0.386         | 0.439         |

**Tie-break.** Two candidates passed, and the protocol has no tie-break. In the first `final` run
my promotion loop promoted each passing candidate in turn, so bge-small ended as champion. I
then applied the rule now in the code: the first passing candidate in `CANDIDATES` order is
champion, and that order (smallest change first) was fixed before `final` ran. I promoted K-means 10
through `Registry.promote`. The registry history shows both promotions and the reason.

**What the decision means, and what it does not.** K-means 10 wins on the frozen criteria because
its groups follow the work less: 0.264 against 0.365, with translator share at the null. But it
puts every passage in a group, including the 37% the champion calls noise. It is less stable
(0.676 against 0.929) and separates about half as well. Its examples show broad themes (government,
religion, causation) mixed with stray passages. The champion's groups are narrower and more
coherent, for example friendship in the Nicomachean Ethics, but a third of them are mostly one work.
bge-small sits between the two: stable (0.865), less work-dominated (0.312), and its groups still
read as themes. I would review bge-small and K-means 10 by hand before changing the published
pipeline.

## Representative examples checked

I read all three exported runs' groups (terms, three central passages and one borderline
passage each). Findings:

- Champion refit: group 0 is friendship (Aristotle 70%); group 7 is cause, effect and power
  (Hume 58%). Coherent but work-bound.
- K-means 10: group 0 is government and legislative power across 7 works. Its central passage is
  Rousseau, and its borderline passage is the Nicomachean Ethics on honour. In group 8 (cause,
  effect, idea) the central example is Epictetus, not Hume. These groups are mixed.
- bge-small: group 1 is miracles and testimony (Hume, Mill); group 5 is government and legislative
  power (Locke, Rousseau).
- Data issue found: some Hume passages are index or footnote text ("Liberty (v. _Necessity_,
  62-97)", "[26] Nov. Org. lib. ii."). The passage cleaner lets them through. This affects every run
  equally and should be fixed upstream in `platform/nlp/philosophy/passages.py`.

## Negative results

- Reading the whole passage did not reduce work dominance. chunks80 and the 384/512-token models
  raised same-work neighbours by 0.02 to 0.08.
- mpnet was not better than MiniLM on any dominance measure, and was unstable at small cluster sizes.
- Raw representations stay strongly work-bound for every model. bge-small raw HDBSCAN puts 91% of
  each group's passages in one work.
- HDBSCAN 40 looked best on the selection side, but on the evaluation side its separation collapsed
  (0.013) and its group count varied from 5 to 10 across seeds.
- No candidate brings neighbours near chance. Centring on the work reduces work dominance but does
  not remove it.

## Limitations

- 13 works give 6 and 7 per side. Every number describes those works only.
- Translator is confounded with work. On the selection side it is identical to work.
- Top share falls mechanically with fewer, larger groups and with forced assignment (K-means). The
  null p95 is given next to it for that reason.
- Group terms are generated (class-based TF-IDF from the published pipeline) and marked
  `generated terms, unreviewed`. No group is named or interpreted.
- No fine-tuning: there are no defensible training pairs or labels for this corpus.
- The tie-break rule was added after two candidates passed. The order it uses was fixed before.

## Resources

Measured with `runtime.measure` (12 CPUs, GTX 1660 for embeddings):

- Small probe: embedding 100 passages took 14–45 s including model download, peak 1.7 GB.
- select: about 3 minutes of compute (embedding 44 s, 24 UMAP fits 111 s, clustering and measures
  25 s), peak RSS 2.3 GB. Wall time was 69.6 minutes, almost all of it waiting for the shared heavy lock.
- final: 2 min 42 s wall; each five-seed fit took 21–42 s, peak 1.7 GB.
- export: 48 s; run files are 87–96 KB each.
- Embedding cache: `warehouse/features/experiments/embeddings/` (vectors only).

## Commands

```
ml/.venv/Scripts/python.exe -m ml.experiments.philosophy prepare
ml/.venv/Scripts/python.exe -m ml.experiments.philosophy select --deadline-minutes 120
ml/.venv/Scripts/python.exe -m ml.experiments.philosophy final --deadline-minutes 120
ml/.venv/Scripts/python.exe -m ml.experiments.philosophy export
ml/.venv/Scripts/python.exe -m pytest ml/experiments/tests/test_philosophy.py -q -p no:cacheprovider --basetemp tmp/pytest-philosophy
```

Outputs: `warehouse/features/experiments/philosophy/{dataset.json,selection.json,select/,final/}`,
`warehouse/features/experiments/registry/philosophy/registry.json`,
`frontend/public/data/cluster-experiments/runs/{6efd7326ea66b9c3,426875670a55f5f2,2938d83298589cc8,f367c26d34300562}.json`
and `index.json`.

## Not done

- No change to the published atlas pipeline or page.
- No human review of groups. bge-small and K-means 10 should be reviewed before any site change.
- No resample stability (`evaluate.resample_stability`); only seed stability.
- The passage cleaner's index and footnote leak is not fixed.
- `select` was rerun from scratch in GitHub Actions (run 40998784012, 9 min 42 s, 3.57 GB peak). The
  embeddings matched; UMAP and HDBSCAN numbers drifted by up to a few hundredths. See
  [Runner measurements](cluster-experiments.md#runner-measurements-2026-10-30). `final` on the runner rejected K-means 10
  and passed bge-small; see [Final on the runner](cluster-experiments.md#final-on-the-runner-2026-10-30).
