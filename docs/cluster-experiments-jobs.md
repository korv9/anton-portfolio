# Job ads: clustering experiments and the MLOps pipeline

Run locally on 2026-10-29 under the shared protocol in [cluster-experiments.md](cluster-experiments.md)
and the criteria in `configs/experiments/jobs.yaml` (frozen 2026-10-29, not edited). Code:
`ml/experiments/jobs.py` (CLI), `jobs_data.py`, `jobs_experiments.py`, `jobs_model.py`, `jobs_mlops.py`;
tests in `ml/experiments/tests/test_jobs_mlops.py`; schedule in `.github/workflows/job-clusters.yml`.
The job assistant's ingest, matching, workflow and D1 are untouched. The clustering only reads the
store, and it is a separate assessment from matching ads against the CV.

**Status (2026-10-30).** The champion is `a35140926c6bf532`: the research settings on v2 text, fitted
on snapshot 1. Champion history (append-only, in `registry.json`):

| When       | Run                        | Action                  | Why                                                                                                   |
| ---------- | -------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------- |
| 2026-10-29 | `6dcad57bab933c28`         | register:champion       | protocol champion, v1 text                                                                            |
| 2026-10-29 | `214c3c57e1f34498`         | promote                 | clean KBLab K-means 8 passed `jobs.yaml` on v1 text                                                   |
| 2026-10-29 | `6dcad…`, `758e…`, `0a71…` | reject                  | v1 text contained redaction placeholders, or invalid provenance (Deviation)                           |
| 2026-10-29 | `214c…`                    | withdraw (now rejected) | coordinator decision with `Registry.reinstate`: its inputs were invalid                               |
| 2026-10-29 | `a351…`                    | reinstate               | the domain's existing pipeline refitted on corrected v2 text; this is not a promotion on the criteria |
| 2026-10-30 | `20c4dba8403fd63a`         | reject                  | refresh on the latest snapshot failed `jobs-refresh.yaml` on employer dominance (below)               |

## Corpus

The source is the job-assistant store `warehouse/raw/job_assistant/ads.json` (JobTech, Data/IT field, CC0):
2,829 ads published from 2026-07-03 to 2026-10-29, both current and removed. The research clustering
behind `frontend/public/data/jobs/cluster-summary.json` used a different corpus: 35,861 ads from
2022 to 2025. Its numbers are not comparable with the ones here.

| Step                                                                                      | Ads                         |
| ----------------------------------------------------------------------------------------- | --------------------------- |
| In the store                                                                              | 2,829                       |
| Schema failures                                                                           | 0                           |
| Marked `duplicate_of` by the store                                                        | 42 dropped                  |
| Same `duplicate_key` or `content_hash`                                                    | 32 dropped                  |
| Identical text after cleaning                                                             | 0 dropped                   |
| Deduplicated                                                                              | 2,755 (dedup rate 2.6 %)    |
| Snapshot 1 (`035573c07db049ab`): published before 2026-10-26T17:05 (newest 15 % held out) | 2,341, of which 478 removed |
| Selection / evaluation side of snapshot 1                                                 | 1,182 / 1,159               |
| Held-out newer ads                                                                        | 414                         |

**Redaction placeholders.** `platform/publish/job_content.py` replaces e-mail addresses and phone
numbers with `[kontaktuppgift utelämnad]` (1,556 times in the store) and contact names with
`[kontaktperson utelämnad]` (270 times). Text v2 removes both from every variant before anything else
(`jobs_data.MARKERS`).

**Employer boilerplate.** A line of at least 80 characters that appears in at least three ads from the
same employer counts as a template. In snapshot 1, 132 employers have templates (697 lines). 54 % of
ads contain at least one template line, and stripping them removes 12.8 % of all description characters.
On the v1 text, a threshold of two ads gave 67 % and 21 %, and a threshold of five gave 45 % and 10 %.
The `clean` text strips these lines and masks the employer's name ("ARBETSGIVAREN"), including the
name without legal suffixes, a distinctive first word and the genitive s. `raw` keeps the description
as served, minus the placeholders. Both use the ml/jobs `title-description-skills-v1` layout, with
must-have and nice-to-have skills as the skills.

**Split.** `splits.split` on employer (`organisation_number`, else the name) plus the cleaned-text
hash. No group or text appears on both sides; this is checked on every run.

## Champion settings

The champion settings apply the ml/jobs research pipeline to this corpus: raw text, token-chunk mean
`paraphrase-multilingual-MiniLM-L12-v2` at `e8f8c211`, cosine UMAP 10-D with 60 neighbours and
min_dist 0, and HDBSCAN with min_samples 3 and eom selection. Not reproduced: the research run's
title-pattern and technology features (weights .65/.15/.20) and its three-seed consensus. HDBSCAN is
scikit-learn's, not the `hdbscan` package. **min_cluster_size 600 does not transfer.** On the 1,182
selection ads it puts every ad in noise (measured: 0 groups, noise 1.0). The champion therefore uses
the same share of the corpus, 600/35,861 = 0.0167 of the ads fitted, which is about 20 ads here.

## Selection (v2 text, selection side, seeds 0, 1, 2)

The grid has 2 texts × 3 embeddings × 6 clusterings, plus the mcs-600 check: 37 fits in 762 s with a
peak of 2.4 GB. The embeddings are the current MiniLM-L12; `KBLab/sentence-bert-swedish-cased` at
`6b5e83cd`, a Swedish SBERT that was already in the local model cache; and TF-IDF with SVD to 256
dimensions as a non-neural baseline. Multilingual e5 and bge-m3 were not tried, since no new weights
were downloaded. UMAP is fixed at the champion's settings. HDBSCAN uses mcs equal to the research
share (about 20 ads), 10 and 40; K-means uses k = 8, 12 and 16. All 37 results are in
`warehouse/features/experiments/jobs/selection/035573c07db049ab.json`. A selection:

| Fit                                          | Groups | Noise | Largest | Seed ARI | Silhouette (rep.) | Employer top share |
| -------------------------------------------- | ------ | ----- | ------- | -------- | ----------------- | ------------------ |
| raw MiniLM HDBSCAN research share (champion) | 2      | 0.00  | 0.96    | 0.99     | −0.01             | 0.12               |
| raw MiniLM HDBSCAN mcs 10                    | 32     | 0.32  | 0.06    | 0.88     | 0.11              | 0.38               |
| raw TF-IDF HDBSCAN mcs 10                    | 17     | 0.20  | 0.33    | 0.96     | 0.31              | 0.41               |
| raw TF-IDF K-means 12                        | 12     | 0     | 0.24    | 0.89     | 0.15              | 0.29               |
| clean MiniLM HDBSCAN mcs 10                  | 34     | 0.38  | 0.04    | 0.89     | 0.09              | 0.27               |
| clean MiniLM HDBSCAN mcs 40                  | 6      | 0.26  | 0.21    | 0.85     | 0.08              | 0.13               |
| clean KBLab K-means 8                        | 8      | 0     | 0.25    | 0.75     | 0.08              | 0.14               |
| clean KBLab K-means 12                       | 12     | 0     | 0.14    | 0.79     | 0.07              | 0.15               |

What selection showed:

- Cleaning lowers employer dominance for every embedding and clustering; raw MiniLM K-means 8 has
  0.20, clean 0.13. Raw TF-IDF has the best silhouette and stability, largely because templates make
  one employer's ads alike.
- Removing the placeholders lowered clean KBLab K-means 8's seed ARI from 0.94 (v1) to 0.75. The
  placeholder tokens had made ads more alike and so inflated stability. On v1 this run was picked
  and promoted; on v2 it was not picked.
- The champion settings are unstable on half the corpus. With about 20 ads per group, raw MiniLM
  finds 2 groups on the selection side, while the evaluation side gives 13 (below).

The pick rule (`PICK_RULE`) was fixed before the first final run. Fits that meet the absolute criteria
come first; within them, rank by seed ARI and then representation silhouette. Take the best HDBSCAN
fit, the best K-means fit, and the best fit whose text or embedding differs from both. On v2 the
candidates were `raw TF-IDF HDBSCAN mcs 10`, `raw TF-IDF K-means 12` and `clean MiniLM HDBSCAN mcs 10`.

## Final evaluation (v2 text, evaluation side, 1,159 ads, seeds 10–14)

| Run                                        | Groups | Noise | Largest | Seed ARI (min) | Silhouette rep. | Employer top share (null p95) | Occupation AMI | Decision                           |
| ------------------------------------------ | ------ | ----- | ------- | -------------- | --------------- | ----------------------------- | -------------- | ---------------------------------- |
| `a35140926c6bf532` champion settings       | 13     | 0.26  | 0.12    | 0.92 (0.85)    | 0.065           | 0.18 (0.10)                   | 0.30           | reference, registered as candidate |
| `272c386613bb3d71` raw TF-IDF HDBSCAN 10   | 35     | 0.19  | 0.20    | 0.96 (0.94)    | 0.283           | 0.55 (0.13)                   | 0.18           | rejected: employer dominance       |
| `8a2ac851197b0485` raw TF-IDF K-means 12   | 12     | 0     | 0.20    | 0.86 (0.80)    | 0.162           | 0.31 (0.09)                   | 0.15           | rejected: employer dominance       |
| `62fa1938d9eb0616` clean MiniLM HDBSCAN 10 | 22     | 0.24  | 0.09    | 0.89 (0.83)    | 0.036           | 0.18 (0.11)                   | 0.33           | rejected: no measured gain         |

All four saved models reproduce their measured fit (artifact label ARI 1.0).

**Over time.** Each model is fitted on snapshot 1 and assigns the 414 newer ads. For comparison, the
same pipeline is refitted on old and new ads together. Agreement is the ARI on the new ads, with noise
excluded.

| Run               | Newer ads assigned | Refit covers | Agreement ARI with refit |
| ----------------- | ------------------ | ------------ | ------------------------ |
| champion settings | 0.52               | 0.62         | 0.83                     |
| TF-IDF HDBSCAN 10 | 0.38               | 0.80         | 0.93                     |
| TF-IDF K-means 12 | 0.87               | 1.00         | 0.74                     |
| MiniLM HDBSCAN 10 | 0.42               | 0.67         | 0.83                     |

**Trade-offs by criterion.** Stability and separation: the TF-IDF runs lead, but their groups follow
the employer (top share 0.31 and 0.55, against a null of about 0.1). Employer dominance: the champion
settings and clean MiniLM HDBSCAN tie at 0.18. Specificity: HDBSCAN gives the finest task groups, such
as network engineers (Cisco, routing), Java/Spring, data/SQL and helpdesk, with 24 to 26 % noise.
Coverage of newer ads: TF-IDF K-means is highest, but it carries employer structure.

**Decision.** No candidate passed `jobs.yaml`. Both TF-IDF runs broke the 0.02 tolerance on employer
dominance. Clean MiniLM HDBSCAN 10 met every floor but showed no measured gain: seed ARI 0.89 vs 0.92,
silhouette 0.036 vs 0.065, noise 0.24 vs 0.26. Nothing was promoted.

The groups of the v2 champion-settings run, as generated c-TF-IDF terms (unreviewed). The stop list is
the shared Swedish one plus `AD_FILLER`, fixed after reading the first export's terms.

| Group | Ads | Terms                                                              | Most common JobTech occupation (share) |
| ----- | --- | ------------------------------------------------------------------ | -------------------------------------- |
| 0     | 27  | linux utveckling relevant kompetens säkerhet jobba polisen         | Systemadministratör (0.33)             |
| 1     | 125 | support microsoft ärenden användare problem tekniker felsökning    | Helpdesktekniker (0.42)                |
| 2     | 22  | cisco nätverk nätverkstekniker routing switching infrastruktur     | Nätverkstekniker (0.82)                |
| 3     | 74  | test testing testning tester elektronik mjukvara verifiering       | Mjukvarutestare (0.16)                 |
| 4     | 49  | verifiering safety tekniskt komplexa dokumentation projekt         | Systemutvecklare (0.16)                |
| 5     | 29  | data sql learning utveckla engineer medical qlik datamodellering   | Data scientist (0.17)                  |
| 6     | 34  | business architecture data enterprise solutions teams agenter      | Mjukvaruutvecklare (0.29)              |
| 7     | 136 | minst leda arbetssätt behov skapa förmåga utveckling               | Projektledare IT (0.24)                |
| 8     | 121 | förmåga vid säkerhet anställning arbetsuppgifter enligt personliga | IT-säkerhetsanalytiker (0.10)          |
| 9     | 120 | software embedded development mjukvara linux systems               | Mjukvaruutvecklare (0.44)              |
| 10    | 72  | cloud azure net backend api aws infrastructure                     | Systemutvecklare (0.21)                |
| 11    | 21  | backend net utvecklare technical produkt code                      | Mjukvaruutvecklare (0.19)              |
| 12    | 31  | java spring backend development services kubernetes boot           | Backend-utvecklare (0.32)              |

Group 8 follows public-sector application wording (anställning, enligt, personliga) more than a task.
"polisen" and "fouredge" are employer or client names that masking did not cover.

## Deviation (2026-10-29)

Both changes were made after the first final evaluation, at the coordinator's request.

1. **Redaction placeholders removed: text v1 to v2.** The first run embedded
   `[kontaktuppgift utelämnad]` and `[kontaktperson utelämnad]`, and one champion group was partly held
   together by them. Text versions `…ja-raw-v2` and `…ja-template-strip-mask-v2` remove them. The new
   text hashes start new embedding caches. Then prepare, select, final and export were rerun. The v1
   runs were not deleted: `6dcad57bab933c28`, `758e40d952640cf8` (both candidates) were rejected with
   "text contained redaction marker; superseded by <v2 run>". `2314cb95edec26ea` and `6bc205b6510bf816`
   were already rejected and are unchanged. No v2 candidate passed, so `214c3c57e1f34498` first stayed
   champion. The coordinator then withdrew it and reinstated the v2 research-settings run `a351…`
   (`Registry.reinstate`, see Status). `ex.vectors` now refuses a pipeline whose
   recorded text version differs from the current one. The first v2 retrain, run before that check,
   reused the v1 champion's pipeline record on v2 text (`0a71cb3cfe72bcb4`). It was rejected as invalid.
2. **Refresh rule: `configs/experiments/jobs-refresh.yaml`** (frozen 2026-10-29). `jobs.yaml` demands
   a measured gain, so a plain refit of the champion on newer data could never pass (the v1 retrain
   `6bc205b6510bf816` failed on exactly that). The refresh file keeps the four floors plus "employer
   dominance not worse (0.02)" and "separation not worse (0.03)", and has no gain requirement.
   `jobs_mlops.rule_file` applies it only when the candidate's text, embedding, representation,
   reduction and clustering equal the reference's and only the dataset version differs. Every other
   comparison uses `jobs.yaml`. Each acceptance report records `criteria_file` and `criteria_sha256`.
   Both branches are tested. On real data its first decision was the rejection of `20c4…` (employer
   dominance, 2026-10-30).

## MLOps design

| Need                                  | Implementation                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Incremental ingest                    | `jobs_data.diff`: new ids, changed `content_hash`, newly removed and missing ads since the model's snapshot                                                                                                                                                                                                                                                                       |
| Versioned cleaning, dedup, validation | The text versions and template thresholds are part of every text hash. A missing, empty, non-JSON or non-list store, no valid ad, or more than 5 % schema failures raises `InputError`. A model on an older text version raises `ValueError` instead of embedding new text under an old label                                                                                     |
| Embedding cache                       | `ml.experiments.embed`, keyed by text hash, model revision and text version + pooling. A change in model or preprocessing starts a new cache folder                                                                                                                                                                                                                               |
| Dataset snapshot                      | `snapshots/<dataset_version>.json` holds ids, hashes, dates and the removed flag, with no text. The text table is `warehouse/ml/experiments/jobs/<version>.parquet` (local only)                                                                                                                                                                                                  |
| Model artifact                        | `models/<run_id>/model.joblib` holds the pipeline (text version and cleaning parameters, embedding and revision or the fitted TF-IDF/SVD, the fitted UMAP, training labels, centroids and radii in the reduced space, centroids in the representation space). `manifest.json` adds run_id, dataset_version, snapshot_version, train ids and sha256. `load` refuses tampered files |
| Registry                              | `Registry('jobs')` with candidate, champion and rejected. Promotion needs a passed `accept.check` (`jobs.yaml`, or `jobs-refresh.yaml` for a refresh); `rollback`                                                                                                                                                                                                                 |
| Export                                | `export.run_file` and `export.index`. The run file names `run_id`, `dataset_version`, the acceptance report and the status. No separate assignments file is published                                                                                                                                                                                                             |
| Assignment between retrains           | Nearest centroid in the saved model's reduced space (`umap.transform`), accepted only within that group's 95th-percentile training radius. Otherwise the label is −1, "fits no group"                                                                                                                                                                                             |
| Version diff                          | Jaccard overlap of the ads both models trained on, plus centroid cosine when the embeddings match. It reports matched, split and merged groups, and links below 0.3 as uncertain (`diffs/<old>__<new>.json`)                                                                                                                                                                      |
| Monitoring                            | `monitor/<kind>-<snapshot>-<model>.json`. Flags set `action: investigate` and never promote                                                                                                                                                                                                                                                                                       |

All files except the text table sit under `warehouse/features/experiments/jobs/` and the shared
registry and embedding folders, so `warehouse_store.py push --only features --path experiments` keeps them.

**Monitor fields:** volume (store ads, snapshot ads, new, changed, removed, missing), dedup rate,
schema failures, template statistics, drift (mean cosine of training and new ads to the training
centre, and the shift between them), assignment (ads, assigned and abstained share, the training
abstain rate, ads per group), training noise share, coverage, group sizes, resources, flags. A flag is
raised for schema failures, for abstentions more than 0.10 above the training rate, and for a cosine
shift above 0.05. The thresholds are set by hand and not yet calibrated.

## Second-snapshot cycle with the reinstated champion (2026-10-30)

The model artifact `models/a35140926c6bf532/` comes from `final`. It holds text v2 with the cleaning
parameters, MiniLM-L12 at `e8f8c211`, the fitted UMAP, training labels, centroids and 95 % radii, and
a manifest with the sha256 (snapshot `035573c07db049ab`, dataset `5fdeddb1ab2a6f40`, 1,159 ads).

- Assign (snapshot `8a1c96974181fe18`, 2,755 ads): 414 new, 0 changed, 0 removed. Changes cannot
  be simulated, because the store keeps only current text. 51.7 % of the new ads were assigned and
  48.3 % abstained ("fits no group"), against a training abstain rate of 18.8 %. HDBSCAN leaves 25.7 %
  of training ads in noise, and the radius rule abstains on those. The abstention flag was raised.
  Drift shift was 0.012, below the 0.05 flag. New ads went mostly to group 7 (project leads, 55),
  group 8 (public-sector security wording, 41), group 1 (support, 39) and group 9 (embedded, 35); group
  11 got none. The file is `monitor/assign-8a1c96974181fe18-a35140926c6bf532.json`.
- Retrain on the evaluation side of the latest snapshot (1,364 ads). The pipeline is identical, so
  `jobs-refresh.yaml` judged it (recorded as `criteria_file`). The refit `20c4dba8403fd63a` gave 16 groups,
  noise 0.243, largest 0.095, seed ARI 0.913, separation 0.065 and employer top share 0.214. It met the
  floors and the separation rule, but failed "employer dominance not worse" (0.214 vs 0.179, tolerance
  0.02). It was **rejected**, and the champion stays.
- Version diff (`diffs/a35140926c6bf532__20c4dba8403fd63a.json`, 1,019 shared training ads):
  - 9 of 13 old groups matched one to one.
  - Old group 7 (project leads) split into new groups 12 and 13 (Jaccard 0.32 and 0.45, centroid cosine 0.98).
  - No merges.
  - Uncertain links (best Jaccard below 0.3): old 0, 4 and 12; new 1, 3, 8, 10 and 14.
- Export: run files for the five v2 runs (champion, three rejected candidates, the rejected
  refresh), then `export.index()`. The v1 run files stay, with status rejected.
- Rollback drill on a copy of the registry, with the new core behaviour (rejected runs skipped):
  "no earlier champion to restore", because every earlier champion is now rejected. The real registry
  is unchanged.
- The invalid v2 monitor file from the v1 model on v2 text (`0a71…`) was moved to `monitor/invalid/`
  with a note.

Measured: assign 29.5 s at 1.06 GB peak, retrain 39.5 s at 1.17 GB, export 24 s at 1.35 GB (one CPU
process; embeddings came from the cache).

## Earlier local runs (2026-10-29)

**v1** (`prepare --hold-out-newest 0.15`, then select, final, export, assign, retrain, and rollback on a copy):

- final promoted clean KBLab K-means 8 (`214c…`).
- assign: 414 new ads, 74 % assigned against a training abstain rate of 5.3 %; the abstention flag
  was raised.
- retrain: rejected on "a measured gain".
- These numbers are superseded, as described under Deviation.

**v2:**

- select and final as above; nothing passed.
- The assign and refit in that drill used the v1 model on v2 text (`0a71…`). They are invalid and
  were rejected or moved, as above.

**Resources** (`tmp/jobs/resources.json` for v2 and `resources-v1.json`, measured with `runtime.measure`;
12 CPUs, GTX 1660 for embeddings):

| Step                                                        | Wall time v1 / v2     | Peak RSS v1 / v2 |
| ----------------------------------------------------------- | --------------------- | ---------------- |
| Sample check: 200 ads, three embeddings plus one 3-seed fit | 82 s / –              | 1.7 GB           |
| select (37 fits)                                            | 710 s / 762 s         | 2.8 / 2.4 GB     |
| final (4 runs × 5 seeds, artefacts, temporal refits)        | 329 s / 231 s         | 3.2 / 3.1 GB     |
| export                                                      | 47 s / 19 s           | 1.2 / 2.5 GB     |
| assign / retrain                                            | 4.5 / 41 s; 29 / 99 s | ≤ 3.0 GB         |

The heavy work took about 20 minutes per pass inside `runtime.heavy`; the first pass also waited
about 45 minutes for the lock.

## First runs in GitHub Actions (2026-10-30)

These ran on a standard Ubuntu runner, CPU only, from main after #196 and #197.

- The first dispatch of `cluster-jobs.yml` (job `experiments`, `philosophy select`, run 40993146600)
  stopped on `ModuleNotFoundError: psutil`, because the ML lock lacked it. #197 added it. The second
  dispatch (run 40994244944) pulled 327 files from R2 and found every fit already checkpointed.
  Its run step took 3 seconds and pushed 2 files back. This shows that resuming from R2 works;
  it does not measure CPU fitting time.
- `job-clusters.yml` `assign` (run 40994537885) read the live store. Against the champion's snapshot
  it found 97 changed and 42 removed ads. It gave 44.4 % of new and changed ads "fits no group",
  against 18.8 % at training, and raised the investigation flag. The step took 66.7 s at a 2.15 GB
  peak, including the CPU embedding of those ads.
- `job-clusters.yml` `retrain` (run 40994561492) fitted candidate `8fc83877c0593b28` on the latest
  snapshot. `jobs-refresh.yaml` judged it, and it was rejected on employer dominance. Nothing was
  promoted. The assign part of that run took 13.2 s at a 0.72 GB peak because the embeddings were
  cached.

The full selection grid (37 fits) then ran from scratch in run 41014204044. It took 53 min 43 s on
a newer snapshot of 2,843 ads, so its picks differ from the selection above. Peak memory was not
recorded. See [Runner measurements](cluster-experiments.md#runner-measurements-2026-10-30).

## Runner drill: over time and rollback (2026-10-30)

Actions run 41091714598 ran `jobs select,final,rollback repro:drill-jobs --hold-out-newest 0.15
--reason runner-rollback-drill` on a standard Ubuntu runner (CPU). Everything went to
`features/experiments/repro/drill-jobs/`; the stored registry did not change. The store had 2,981
ads (dataset `62223f4f601cb39e`); 2,896 after deduplication, and 2,461 after holding out the newest 15 %. The 435 newer ads
were assigned afterwards. Splits are by employer, as before.

| Step     | Time        | Peak memory |
| -------- | ----------- | ----------- |
| prepare  | 4 s         | 0.42 GB     |
| select   | 54 min 10 s | 3.49 GB     |
| final    | 38 min 42 s | 4.61 GB     |
| rollback | 1 s         | 0.23 GB     |

| Run (evaluation side)       | Status after drill  | Employer top share (null p95) | Newer ads assigned | Refit covers | Agreement ARI |
| --------------------------- | ------------------- | ----------------------------- | ------------------ | ------------ | ------------- |
| champion settings refitted  | champion (restored) | 0.189 (0.100)                 | 0.55               | 0.77         | 0.77          |
| clean MiniLM-L12 HDBSCAN 10 | rejected (demoted)  | 0.196 (0.111)                 | 0.34               | 0.70         | 0.84          |
| raw TF-IDF K-means 8        | rejected            | 0.223 (0.082)                 | 0.95               | 1.00         | 0.60          |
| clean KBLab HDBSCAN 10      | candidate (passed)  | 0.200 (0.119)                 | 0.41               | 0.66         | 0.81          |

Two candidates passed the frozen criteria and `final` promoted MiniLM HDBSCAN 10 (highest seed
ARI). TF-IDF K-means 8 failed "employer dominance not worse". The `rollback` step then demoted the
promoted run and restored the refitted champion, with the drill reason in the history. In every
run the employer top share stays above its null p95, so employer templates still shape the groups.
Over time, the HDBSCAN runs leave more newer ads unassigned but agree better with a refit; K-means
assigns almost all but agrees least. This is a drill on a newer snapshot, not a reproduction, and
it changes no stored decision.

## Runbook

```bash
ml/.venv/Scripts/python.exe -m ml.experiments.jobs prepare            # full store; --hold-out-newest 0.15 for the drill
ml/.venv/Scripts/python.exe -m ml.experiments.jobs select --deadline-minutes 120
ml/.venv/Scripts/python.exe -m ml.experiments.jobs final  --deadline-minutes 120   # registers, decides, promotes a passed candidate
ml/.venv/Scripts/python.exe -m ml.experiments.jobs export
ml/.venv/Scripts/python.exe -m ml.experiments.jobs assign             # new and changed ads -> group or -1, monitor file
ml/.venv/Scripts/python.exe -m ml.experiments.jobs monitor            # latest monitor file
ml/.venv/Scripts/python.exe -m ml.experiments.jobs retrain [--promote]
ml/.venv/Scripts/python.exe -m ml.experiments.jobs promote --run-id <id> --reason "..."
ml/.venv/Scripts/python.exe -m ml.experiments.jobs rollback --reason "..." [--copy-to tmp/registry-copy]
```

`select` and `final` checkpoint each fit under `checkpoints/` and resume after an interruption.

**Schedule.** `job-clusters.yml` runs every Monday at 04:41 UTC, and can also be started by hand. It
pulls `features/experiments` and `raw/job_assistant`, runs `assign` and `monitor`, and pushes
`features/experiments` back, after a failure too. Started by hand with `retrain`, it also refits a
candidate; it never passes `--promote`. A person reads the acceptance report and the diff, then runs
`promote`. It shares the `cluster-jobs-experiments` concurrency group with `cluster-jobs.yml`.

**Tested** (`test_jobs_mlops.py`, 11 tests, about 5 s): missing, empty, non-JSON, wrong-shape and
mostly invalid input; dedup by duplicate_of, duplicate_key and hash; template stripping and masking;
placeholders never reach embedded text, and old-version pipelines are refused; leak-free split; new,
changed and removed detection; cache invalidation on model and preprocessing change; resume after an
interruption; abstention; model ↔ dataset ↔ export linkage and the tamper check; rejection, promotion
and rollback on a copy; the refresh rule and the `jobs.yaml` branch; monitor flags; version diff.
**Run in Actions:** assign, retrain and select (see above). **Untested:** `final` on a runner.

## Limitations

- About three months of ads from one occupation field. The groups describe this window only.
- The champion was reinstated by a coordinator decision (`Registry.reinstate`), not by passing
  `jobs.yaml`. No pipeline compared on v2 text has beaten it.
- With HDBSCAN, assignment abstains on about a fifth of training ads (noise and the radius tail).
  Abstention is compared with that training rate, not with zero.
- No rollback target exists: every earlier champion is rejected.
- The champion settings reproduce only the research pipeline's semantic text, at a scaled
  min_cluster_size. On the selection side they gave 2 groups, on the evaluation side 13.
- The assignment radius is a 95th-percentile rule. HDBSCAN's own `approximate_predict` was not used
  (scikit-learn's HDBSCAN has none).
- Template stripping is measured on the whole snapshot before the split. It uses no labels, and
  employers never sit on both sides.
- Masking covers the advertising employer only. Client names remain, and the headline in published
  examples is not masked.
- Group terms are generated and unreviewed; `AD_FILLER` was chosen after one look at the terms.
- The drift and abstention thresholds are set by hand.
