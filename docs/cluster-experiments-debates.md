# Clustering experiments: Replik (party-leader debates)

Run on 2026-10-29 under the shared protocol in [cluster-experiments.md](cluster-experiments.md),
with the criteria in `configs/experiments/debates.yaml` (frozen 2026-10-29, before the final run).
Code: `ml/experiments/debates.py`, `debates_data.py`, `debates_select.py`, `debates_export.py`.

The groups are topic groups. Two passages in one group talk about a similar subject; that says
nothing about whether the speakers agree.

## Data

- Source: the published passage table
  `warehouse/cluster_lab/public-topics-2026-10-12/datasets/debate/observations.parquet`. It has
  33,023 passages from 108 debates (1993–2026), 108 speakers and 8 parties. Each passage is whole
  sentences closed at 80 words (minimum 40, maximum 150).
- The prepared table is `warehouse/ml/experiments/debates/observations.parquet`, kept local. It holds
  `observation_id, text, text_masked, text_hash, text_hash_masked, debate_id, speaker, party, date,
year, decade, session, selection`. Dataset version `739d86311fb89c5f`.
- Split by `debate_id` with `ml/experiments/splits.py`, seed 0. The selection side has 16,531
  passages from 55 debates (`7871a2dc2c6aae04`). The evaluation side has 16,492 passages from 53
  debates (`72487eb4a4ab7433`). Leak check: no debate and no text on both sides.

### Cleaning variants

- current: the passage as published (`replik-passages-v1`).
- masked (`replik-passages-masked-v1`): speaker full names, first names and surnames (at least
  four letters) are replaced by `[NAMN]`. Party names and abbreviations (KD, MP, SD, FP) become
  `[PARTI]`. Forms of address (herr/fru talman, \*ministern, partiledare) become `[TILLTAL]`. This
  changed 62.6% of passages: 23,269 names, 18,400 party names and 4,250 forms of address. Masking
  raises an error if the count of any negation word (inte, aldrig, ingen, inget, inga, icke,
  varken) changes, and a test checks this.
- Rhetorical templates: only 0.25% of passages share their first 8 words with another passage
  (0.37% after masking, where `jag tycker att det är bra att [NAMN]` is the most common opening).
  Repeated formula openings are rare, so no template-stripping variant was built.

## Champion

The published run `7ddccfed7864e26fe7aa90da` uses KBLab/sentence-bert-swedish-cased
`6b5e83cd29c03729cfdc33d13b1423399b0efb5c`, L2-normalised. Speakers with at least 5 passages in at
least 2 debates are centred. Then UMAP 5-D (30 neighbours, min_dist 0, cosine) and HDBSCAN eom
150/25 with a 10% largest-group cap, over 12 seeds, followed by consensus, merge and noise
reassignment. Its published figures, on all 33,023 passages: 33 groups, noise 29.5% before
reassignment and 16.2% after, seed-pair ARI 0.677, split-half ARI 0.751 (with noise), and AMI 0.044
for party and 0.104 for speaker.

For the protocol, the champion is refitted on the evaluation side with the same model, centring
rule, UMAP and HDBSCAN 150/25. `min_cluster_size` is set as a share, 150/33,023 of the passages.
The refit has no consensus, merge, reassignment or 10% cap: `fit.cluster` does not support a cap,
and a candidate does not get these steps either. Its numbers are therefore not the published ones.

## Selection (selection side, seeds 0, 1, 2)

| representation                   | clustering          | groups | noise | largest | seed ARI | sil. repr. | party AMI | speaker AMI | debate top share | groups in ≥3 decades |
| -------------------------------- | ------------------- | ------ | ----- | ------- | -------- | ---------- | --------- | ----------- | ---------------- | -------------------- |
| sbert speaker-centred (champion) | HDBSCAN 150/25      | 27     | 0.253 | 0.116   | 0.917    | 0.089      | 0.050     | 0.140       | 0.128            | 26                   |
| sbert speaker-centred            | HDBSCAN 150/10      | 17     | 0.108 | 0.416   | 0.689    | 0.013      | 0.045     | 0.131       | 0.102            | 17                   |
| sbert speaker-centred            | HDBSCAN 300/25      | 17     | 0.235 | 0.126   | 0.993    | 0.102      | 0.045     | 0.130       | 0.117            | 17                   |
| sbert speaker-centred            | K-means 30 on UMAP  | 30     | 0     | 0.067   | 0.864    | 0.078      | 0.036     | 0.106       | 0.115            | 30                   |
| sbert speaker-centred            | K-means 30 on 768-D | 30     | 0     | 0.054   | 0.645    | 0.091      | 0.023     | 0.083       | 0.102            | 30                   |
| sbert raw                        | HDBSCAN 150/25      | 14     | 0.060 | 0.481   | 0.996    | 0.073      | 0.053     | 0.090       | 0.074            | 14                   |
| sbert party-centred              | HDBSCAN 150/25      | 27     | 0.236 | 0.114   | 0.990    | 0.082      | 0.048     | 0.107       | 0.104            | 26                   |
| sbert party-centred              | HDBSCAN 300/25      | 16     | 0.196 | 0.139   | 0.996    | 0.109      | 0.042     | 0.093       | 0.089            | 16                   |
| sbert masked, speaker-centred    | HDBSCAN 150/25      | 18     | 0.067 | 0.288   | 0.867    | 0.010      | 0.044     | 0.121       | 0.092            | 17                   |
| sbert masked, speaker-centred    | K-means 30 on UMAP  | 30     | 0     | 0.067   | 0.823    | 0.075      | 0.036     | 0.107       | 0.114            | 30                   |
| e5-base speaker-centred          | HDBSCAN 150/25      | 2      | 0     | 0.949   | 1.000    | 0.044      | 0.005     | 0.100       | 0.063            | 2                    |
| e5-base speaker-centred          | HDBSCAN 150/10      | 38     | 0.448 | 0.051   | 0.978    | 0.129      | 0.076     | 0.235       | 0.183            | 22                   |
| minilm speaker-centred           | HDBSCAN 150/25      | 28     | 0.422 | 0.094   | 0.981    | 0.083      | 0.045     | 0.142       | 0.141            | 25                   |

All 25 rows are in `warehouse/ml/experiments/debates/select.csv`, including per-decade noise and the
null top shares. In every row the party and debate top shares are above the null p95: for the
champion, party 0.266 against a null of 0.187, and debate 0.128 against 0.066.

The alternative models were intfloat/multilingual-e5-base `d128750597153bb5987e10b1c3493a34e5a4502a`
(with the `query: ` prefix from its card) and paraphrase-multilingual-MiniLM-L12-v2
`e8f8c211226b894fcb81acc59f3b34ba3efd5f42`.

Three candidates were chosen. The reasons are in the order of the RUNS list in `debates.py`:

1. **sbert party-centred, HDBSCAN 150/25.** It keeps the champion's granularity (27 groups) with
   higher seed ARI (0.990 against 0.917), lower debate and speaker dominance, and similar noise.
   It is the smallest change: the centring group is the only difference.
2. **sbert speaker-centred, K-means 30 on UMAP.** This is the baseline. It assigns every passage,
   which matters for Replik, where unassigned passages are lost, and it has lower party and
   speaker AMI. Its seed ARI is lower.
3. **MiniLM speaker-centred, HDBSCAN 150/25.** This tests the model. It is stable (0.981), but its
   noise of 0.42 is close to the 0.45 ceiling.

Not chosen:

- e5-base. With min_samples 25 it collapses into two groups, one of them 95% of passages. With
  min_samples 10 it is stable and well separated (0.129), but its party AMI (0.076) and speaker AMI
  (0.235) are far above the champion's. That would fail the frozen criteria.
- Masked text. Masking barely moves party AMI (0.044 against 0.050 with HDBSCAN, and 0.036 for
  both with K-means). The HDBSCAN fit merges into one group of 29% with separation 0.010. Names and
  party names are not what makes the groups follow party.
- Raw (uncentred) sbert. It makes one group of 48%.

## Final evaluation (evaluation side, seeds 10–14)

Each run went through `fit.evaluate_candidate`. Centring is applied beforehand in
`debates_data.centre` so that it follows the champion's rule; `fit` then only normalises.

| criterion (frozen)                                               | champion `e86ca4aa5f4e8a3d` | sbert-party `e6c6282cfce36e0c` | K-means `b33f92b181b8e676` | MiniLM `0da6b7b441331a17` |
| ---------------------------------------------------------------- | --------------------------- | ------------------------------ | -------------------------- | ------------------------- |
| seed ARI ≥ 0.6                                                   | 0.991                       | 0.980 ✓                        | 0.843 ✓                    | 0.962 ✓                   |
| ≥ 5 groups                                                       | 28                          | 23 ✓                           | 30 ✓                       | 22 ✓                      |
| noise ≤ 0.45                                                     | 0.269                       | 0.233 ✓                        | 0.000 ✓                    | 0.385 ✓                   |
| party AMI ≤ champion + 0.01                                      | 0.0637                      | 0.0501 ✓                       | 0.0492 ✓                   | 0.0569 ✓                  |
| speaker AMI ≤ champion + 0.01                                    | 0.1204                      | 0.0903 ✓                       | 0.0981 ✓                   | 0.1135 ✓                  |
| debate top share ≤ champion + 0.02                               | 0.0941                      | 0.0872 ✓                       | 0.0905 ✓                   | 0.0873 ✓                  |
| separation (repr.) ≥ champion − 0.03                             | 0.0887                      | 0.0823 ✓                       | 0.0704 ✓                   | 0.0893 ✓                  |
| a measured gain (ARI +0.05, separation +0.03 or party AMI −0.01) | none                        | party AMI −0.014 ✓             | party AMI −0.015 ✓         | none ✗                    |
| **result**                                                       |                             | **passed**                     | **passed**                 | **rejected**              |

Further measures, not part of the criteria:

| measure                                   | champion        | sbert-party     | K-means        | MiniLM          |
| ----------------------------------------- | --------------- | --------------- | -------------- | --------------- |
| largest group                             | 0.150           | 0.154           | 0.072          | 0.100           |
| silhouette, clustered space               | 0.590           | 0.559           | 0.441          | 0.479           |
| groups per seed                           | 26–29           | 23–29           | 30             | 21–22           |
| noise 1990s / 2000s / 2010s / 2020s       | .31/.26/.27/.26 | .30/.25/.23/.18 | 0              | .45/.40/.37/.38 |
| groups in ≥ 3 decades (≥ 5% of the group) | 26/28           | 23/23           | 29/30          | 19/22           |
| wall time / peak RSS (embed + 5 fits)     | 306 s / 2.1 GB  | 113 s / 2.2 GB  | 106 s / 2.2 GB | 155 s / 2.9 GB  |

### Decision

Two candidates passed. `debates.decide` first promoted both in turn, which was a bug: the second
promotion retired the first. The bug is fixed so that at most one is promoted, the first to pass in
RUNS order. The registry was rolled back through its append-only history (`rollback`), so its
history shows promote, promote, demote and rollback.

**The registry champion is now sbert-party (`e6c6282cfce36e0c`).** It is the smaller change and
keeps seed ARI at 0.98, against 0.84 for K-means. The K-means run passed its report, but it shows
as `rejected` because of the rollback, which is the only way the registry API could demote it. Its
acceptance report still says passed.

**Rolled back on 2026-10-30.** The CPU rerun of `final` on the runner failed sbert-party on "a
measured gain" and passed K-means instead
([Final on the runner](cluster-experiments.md#final-on-the-runner-2026-10-30)). A decision that
flips between machines shows no improvement, so the registry champion is the original pipeline
(`e86ca4aa5f4e8a3d`) again. sbert-party is a candidate with its local report.

**Runner decides, 2026-10-30.** The owner made the runner the deciding machine, and two runner
runs agree, so the registry now holds the runner's decision
([The runner decides](cluster-experiments.md#the-runner-decides-2026-10-30)).

Caveat on the gain: the only gain either candidate showed is party AMI 0.014 lower. Centring on
party removes each party's mean vector, so lower party AMI partly follows from how the
representation is built rather than being an independent finding. K-means gets its lower AMI while
assigning every passage, rhetoric included. The champion's party AMI on the evaluation side (0.064)
is also higher than on the selection side (0.050).

**Replik is unchanged.** The registry promotion does not touch
`frontend/public/data/clusters/debate-topics.json`, `cluster-research/debate-topics.json`, the
published run, or `frontend/src/replik/`. Moving Replik to party centring would need a new run of
the published consensus pipeline (`ml/research/consensus.py`) with party centring, and an owner
decision.

## Examples checked

From the exported sbert-party run (`frontend/public/data/cluster-experiments/runs/e6c6282cfce36e0c.json`):

- The largest group (2,547 passages, terms _miljöpartiet, utsläppen, kärnkraft, energi_) is about
  climate and energy. Its representatives are Kristersson (M) in 2022 and 2025 on climate policy
  and Åkesson (SD) in 2017 on Fridolin and climate. The borderline passage is Olofsson (C) in 2005
  on enterprise, so the group's edge runs into business policy.
- The jobs group (959; _jobb, arbetslösheten_) has Reinfeldt (M) in 2007, Hägglund (KD) in 2007 and
  Persson (S) in 2004 on unemployment. Its borderline is Sjöstedt (V) in 2018 on sickness insurance.
- The migration group (425; _migrationspolitik, flyktingar_) has Fridolin (MP) in 2011, Kristersson
  (M) in 2019 and Björklund (L) in 2013. Its borderline is Åkesson (SD) in 2012 on the Migration
  Agency.
- Group 7 (929; _dig, mig, säga, tacka_) is replies and thanks, the same kind of rhetoric group that
  the 2026-10-12 reading found.
- No group has one party in the majority. The highest party share is V at 0.47 in the housing group
  (99 passages).

## Export

There is one file per run in `frontend/public/data/cluster-experiments/runs/` (`e86ca4aa5f4e8a3d`,
`e6c6282cfce36e0c`, `b33f92b181b8e676`, `0da6b7b441331a17`; 350–375 KB each), and
`index.json` was rebuilt. Each file has its own 2-D UMAP (15 neighbours, min_dist 0.1, seed 10,
sampled to 3,000 points). Each group has its size, dominant party and speaker with their shares,
c-TF-IDF terms (`name_status: generated terms, unreviewed`), passages per decade, 3 representative
passages and 1 borderline passage, each cut to 300 characters, with source {debate_id, date,
speaker, party}. The source is the public parliamentary record.

## Limitations

- The refitted champion has no consensus, reassignment or 10% cap. Its largest group is 15%, and
  its seed ARI (0.99 over 5 seeds of one half) cannot be compared with the published 0.677
  (12 seeds over all passages, with the hdbscan library and a cap).
- Each side has about 16.5k passages from about 54 debates. The split is one random draw of
  debates.
- Party and name masking uses regular expressions over speaker names and party stems. Names of
  people who never spoke are not masked.
- MiniLM truncates at 128 tokens, so the ends of long passages are not embedded.
- Dominance is measured against party, speaker and debate only. Government or opposition status
  and the year are not confounders in the criteria.
- Temporal stability was not tested by fitting on early years and assigning later ones. Only noise
  per decade and group presence per decade are reported.

## Resources

- Selection: about 19.5 min of heavy wall time. That covers embedding the selection side 4 times
  (sbert ×2, e5-base, MiniLM) and 18 UMAP 5-D fits, about 20 s each. Peak RSS was 2.9 GB.
- Final: 29 min, most of it waiting for the shared heavy lock; the compute was about 11 min.
- Export: 3.5 min, mostly four 2-D UMAP fits. A first attempt failed on a type error in the terms
  call after its maps were cached.
- GPU: GTX 1660 for embeddings. The code runs on CPU too.
- Disk: 225 MB embedding cache (`warehouse/features/experiments/embeddings`, vectors only) and
  30 MB under `warehouse/ml/experiments/debates`.

## Commands

```bash
ml/.venv/Scripts/python.exe -m ml.experiments.debates prepare
ml/.venv/Scripts/python.exe -m ml.experiments.debates select --deadline-minutes 100
ml/.venv/Scripts/python.exe -m ml.experiments.debates final --deadline-minutes 90
ml/.venv/Scripts/python.exe -m ml.experiments.debates export --deadline-minutes 60
ml/.venv/Scripts/python.exe -m pytest ml/experiments/tests/test_debates.py -q -p no:cacheprovider --basetemp tmp/pytest-debates
```

## Not done

- No fine-tuning, because there are no defensible pairs or labels.
- No change to Replik or the published run.
- No consensus refit with party centring.
- No temporal hold-out fit.
- No human review of group names.
- No R2 push of the registry.
