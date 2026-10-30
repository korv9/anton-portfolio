# Clustering experiments: shared protocol

Fixed on 2026-10-29, before any final evaluation ran. It covers four domains: Philosophy Lab,
Symbol Lab, job ads and Replik (Riksdag party-leader debates). Each domain's results are in its own
file, listed at the end. Existing pre-registrations (philosophy-moral, sweden-*, oldbailey, ai-act)
are separate projects and stay as they are.

## Champion and candidates

The champion of a domain is the pipeline its site page publishes today. A candidate replaces it
only when it meets every criterion in `configs/experiments/<domain>.yaml`. Those files were written
before the final evaluation and carry a `frozen_at` date; the acceptance report stores the file's
SHA-256, so a later edit is visible. Criteria are checked one by one and reported with both
values. There is no weighted total. If no candidate passes, the champion stays, and the rejected
candidates stay in the registry with their reports.

## Data and splits

A dataset version is the hash of its observation ids and text hashes. Observations are related
when they share a split group (work, book, employer or debate, named in the domain's YAML) or an
identical text. Related observations form one component, and whole components go to one side
(`ml/experiments/splits.py`):

- Selection side (about half): every parameter search and model choice, seeds 0, 1 and 2.
- Evaluation side: only the champion and at most three chosen candidates, seeds 10 to 14.
  Nothing from this side informs a choice.

The splits are tested for leaks: no group and no text may sit on both sides.

## What is compared

Each domain compares a small, stated set:

- text cleaning, passage unit or context window;
- the current embedding model against at most two pretrained alternatives, each pinned to a
  revision. Changing a pretrained model is not fine-tuning. Fine-tuning needs defensible training
  pairs or labels and an independent evaluation; where those are missing, the domain file says so
  and nothing is fine-tuned;
- the original representation against centring on the confounding group;
- HDBSCAN against K-means as a baseline, over a small grid.

## Measures (`ml/experiments/evaluate.py`, `fit.py`)

These are reported side by side:

- Structure: number of groups, noise share, coverage, largest group.
- Stability: ARI between seeds, noise excluded.
- Separation: silhouette in the clustered space and in the representation space. The 2-D map
  is not measured: a tidy map is not evidence of meaningful groups.
- Dominance: of every confounder, measured as weighted top share and AMI. It is compared with
  a null that keeps group sizes and shuffles membership.
- Examples: representative passages and borderline cases.
- Resources: time, peak memory, disk and artifact size (`runtime.measure`).

The groups are computed, not interpreted. A group's name is either generated (marked as such) or
human-reviewed (marked with who and when). A cluster is never presented as a universal symbol
meaning, an opinion or a verdict.

## Running

Every domain module has the same commands: `python -m ml.experiments.<domain> prepare|select|final|export`.
`select` and `final` checkpoint every finished fit and resume after an interruption. They take
`--deadline-minutes` and stop with a margin before it. One machine-wide lock (`runtime.heavy`) lets
only one embedding or fit job run at a time. Embeddings are cached per text hash, model revision
and text version (`embed.py`).

The heavy path in GitHub Actions is the existing `cluster-jobs.yml` `module` job on a standard
Ubuntu runner, CPU only. It pulls the domain's features folder from R2, runs, and pushes it back,
including checkpoints after a failure. Source texts stay under the storage rules of
`src/portfolio/storage/warehouse_store.py`: only text whose licence allows redistribution may be in
the public bucket.

## Runner measurements (2026-10-30)

Each domain's `select` step ran once from scratch on a standard Ubuntu runner (4 CPUs, no GPU),
from main after #199. It was started with the third word `repro`, so checkpoints and embeddings
went to separate `-repro-<run id>` folders and nothing was resumed. `select` registers nothing, so
the registries did not change. Times are the run step only; R2 pull and push add under a minute.

| Domain | Actions run | Run step | Fits | Peak memory |
|---|---|---|---|---|
| Philosophy Lab | 40998784012 | 9 min 42 s | 48 | 3.57 GB |
| Symbol Lab | 40999907253 | 16 min 12 s | 7 units | 3.11 GB |
| Replik | 41001632612 | 2 h 12 min | 25 | not recorded |
| Job ads | 41014204044 | 53 min 43 s | 37 | not recorded |

All four finished inside the 255-minute deadline. The longest Symbol Lab unit was the multilingual
MiniLM context embedding, at 268 s. The Replik and job-ad select steps keep no per-fit resources
in what they push. In this round, the Replik and Symbol Lab checkpoints were still kept beside the
prepared text in `warehouse/ml/experiments/`, so they were lost with the runner. They hold no text,
though: the longest string in them is the corpus description. Only their embeddings resumed from R2.

Two faults in this round, fixed afterwards:

- The philosophy repro wrote its `selection.json` into the stored `philosophy/` folder and pushed it,
  which replaced the local selection numbers in R2. The local file was rebuilt from the untouched
  local checkpoints (`select` resumed all 48 fits in 3 s) and pushed again.
- Replik and Symbol Lab checkpoints, labels, coordinates and decisions now live in
  `features/experiments/<domain>/`, so they go to R2 and a stopped run resumes. Prepared text
  stays local.

A repro now uses one root, `features/experiments/repro/<label>/` (`registry.EXPERIMENTS`). The root
holds its own registry, checkpoints, embeddings, summaries and exports. Nothing outside it changes,
and `final` judges candidates against an empty registry of its own. In `cluster-jobs.yml` the
args are `<domain> <step[,step]> [repro[:label]]`. GNU time records each step's peak memory. A
re-run keeps the Actions run id and so resumes the same repro.

What the rerun showed:

- Philosophy Lab: the same-work neighbour shares match the local run to three decimals, so the
  embeddings are the same. The UMAP and HDBSCAN results drift. The champion setting (MiniLM centred,
  HDBSCAN 25) gave 13 groups at noise 0.331, seed ARI 0.879 and work share 0.524. Locally it gave
  noise 0.299, ARI 0.911 and work share 0.517. MiniLM raw HDBSCAN 25 moved most, from 10 to 13
  groups. K-means rows moved by about 0.01. Selection numbers are therefore exact only on the
  machine that made them, and differences of a few hundredths between candidates are within this
  drift.
- Job ads: the live store had grown to 2,843 ads (2,769 after deduplication, dataset
  `3f246fedf7113fa3`). It is a different snapshot, so its picks (clean KBLab HDBSCAN 10, raw TF-IDF
  K-means 12, raw KBLab HDBSCAN 10) are not a reproduction of the earlier selection. Its selection
  summary was written to the normal `jobs/selection/` folder under the new dataset version, not
  to a repro folder.
- Symbol Lab and Replik were not compared row by row with their local runs.

## Deviations, recorded after the final evaluations (2026-10-29)

- Tie-break. The protocol did not say which candidate wins when two pass. In Philosophy Lab
  and Replik both domains' code first promoted every passing candidate in turn. They then
  applied the candidate order fixed before the final run, smallest change first, and the registry
  history shows each promotion, retirement and rollback. Two other candidates passed the frozen
  criteria but were not promoted: bge-small in Philosophy Lab and K-means 30 in Replik. Their
  reports still stand. This rule was adopted after the results were known.
- Refreshing the job-ad champion. The job-ad criteria require a measured gain, so a retrain of
  the champion's own pipeline on a newer snapshot could never pass. A separate file,
  `configs/experiments/jobs-refresh.yaml`, judges only such refits (same pipeline, newer data) and
  requires no gain. It is not used to choose between pipelines. See the jobs file.
- Raw shares. The dominance criteria compare raw weighted top shares. Fewer, larger groups
  lower that share mechanically. The null percentile is reported next to every share, and the
  domain files point out where a gain is close to that effect.
- Registry champion and site page. A promotion in the registry does not change any site page.
  Each page still publishes its existing pipeline. Cluster Visuals marks that run as "former
  champion, still the published page". Changing a page needs its own review and a separate decision.

## Domain results

- [Philosophy Lab](cluster-experiments-philosophy.md)
- [Symbol Lab](cluster-experiments-symbolic.md)
- [Job ads and the MLOps pipeline](cluster-experiments-jobs.md)
- [Replik](cluster-experiments-debates.md)
