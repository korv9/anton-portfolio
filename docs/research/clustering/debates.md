# Clustering experiments: Replik (party-leader debates)

Run on 2026-10-29 under the shared protocol in [cluster-experiments.md](method.md),
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
([Final on the runner](method.md#final-on-the-runner-2026-10-30)). A decision that
flips between machines shows no improvement, so the registry champion is the original pipeline
(`e86ca4aa5f4e8a3d`) again. sbert-party is a candidate with its local report.

**Runner decides, 2026-10-30.** The owner made the runner the deciding machine, and two runner
runs agree, so the registry now holds the runner's decision
([The runner decides](method.md#the-runner-decides-2026-10-30)).

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

## Partiledardebatterna i de offentliga experimenten 2026-10-12 till 2026-10-14 (sv)

Experiment 2026-10-12. [Metod, datakvalitet och återkörning](method.md#metod-och-återkörning-för-offentliga-klustringsexperiment)
innehåller källhashar, modellrevisioner, hela parameterutrymmet och kommandon.
Det underliggande Riksdagslagret saknas lokalt; den befintliga publicerade
fulltextkorpusen har frysts utan ny ingestion. Experimentet 2026-10-12 publicerades inte;
uppföljningen 2026-10-14 nedan publicerades i `frontend/public/data/cluster-research/`.
Endast öppen, publicerad data skickas till Workers AI. Besökarens text loggas aldrig och sparas inte.

### Uppföljning 2026-10-14: konsensus över tolv seeds

Kartorna på sidan Klustervisualiseringar bygger nu på körningarna nedan (3 000 av 33 023
respektive 21 260 passager visas, `POINTS` i `ml/research/export_public_maps.py`). Avsnittet
från 2026-10-13 står kvar som jämförelse. Statiska diagram finns i
`warehouse/cluster_lab/public-consensus-2026-10-13/report.html`.

Varje variant kördes med tolv seeds. En grupp behålls när minst hälften av
körningarna hittar den, och en passage får den grupp som flest körningar ger den.
Stabiliteten mäts som ARI mellan konsensus över seeds 0, 2, 4 … och konsensus över
seeds 1, 3, 5 … (split-half-ARI).

| Underlag | Passager | Grupper | Namngivna | Utan grupp före och efter återföring | Största grupp | Split-half-ARI | Intrångstest |
|---|---|---|---|---|---|---|---|
| Partiledardebatter | 33 023 | 33 | 31 | 29,5 % och 16,2 % | 7,8 % | 0,75 | 52 av 66 |
| Filosofi, 113 verk | 21 260 | 19 | 17 | 57,5 % och 31,2 % | 12,0 % | 0,80 | 25 av 38 |

#### Varianter

| Variant | Passager | Grupper | Utan grupp | Största grupp | Split-half-ARI | Poäng |
|---|---|---|---|---|---|---|
| Debatter, SBERT (vald) | 33 023 | 33 | 16,2 % | 7,8 % | 0,751 | 0,171 |
| Debatter, e5-large | 33 023 | 34 | 28,2 % | 6,2 % | 0,862 | −0,021 |
| Debatter, bge-m3 (Workers AI) | 33 023 | 32 | 28,8 % | 6,9 % | 0,735 | −0,014 |
| Debatter, SBERT utan sju grupper | 23 027 | 30 | 16,9 % | 9,4 % | 0,720 | 0,048 |
| Debatter, e5-large utan sju grupper | 23 027 | 33 | 28,2 % | 8,0 % | 0,833 | 0,003 |
| Filosofi, MiniLM, 80–150 ord (vald) | 21 260 | 19 | 31,2 % | 12,0 % | 0,805 | −0,125 |
| Filosofi, e5-large, 80–150 ord | 21 260 | 13 | 46,3 % | 12,9 % | 0,563 | −0,211 |
| Filosofi, MiniLM, cirka 300 ord | 16 602 | 19 | 37,8 % | 6,9 % | 0,733 | −0,126 |
| Filosofi, e5-large, cirka 300 ord | 16 602 | 12 | 42,6 % | 8,5 % | 0,764 | −0,154 |

Valet är högsta poäng bland varianter med split-half-ARI minst 0,75.

- Ett tidigare tal var för högt. Seed-ARI 0,77 från 2026-10-13 gällde seeds 42, 43
  och 44. Samma inställning ger 0,70 i medel över seeds 0 till 5, och ARI mellan två
  enskilda körningar är 0,68 över alla tolv. Konsensus når 0,751.
- Tröskeln för att länka grupper mellan körningar sänktes från Jaccard 0,5 till 0,3
  efter att 0,5 gav split-half-ARI 0,735 på debatterna. Värdet valdes alltså på samma
  data som det mäts på, och marginalen till gränsen 0,75 är liten.
- `multilingual-e5-large` ger stabilare grupper på debatterna men lämnar 28 % av
  passagerna utan grupp mot 16 % för SBERT. På filosofin är modellen sämre på alla mått.
- Att ta bort de sju grupper som saknade namn och klustra om gav inte bättre grupper.
  Med svensk stoppordslista visade sig fyra av dem vara ämnen: EU och euron, brott
  och polis, arbetsmarknadspolitik, skattesänkningar och budget.
- Passager om cirka 300 ord gav filosofin lika många grupper men fler passager utan
  grupp och split-half-ARI under gränsen.
- `bge-m3` kördes 2026-10-14 genom Cloudflare Workers AI (`platform/nlp/workers_ai.py`)
  med samma inställningar som SBERT och en egen valnyckel (`pick-debate-bge-m3.json`), så
  att den inte tävlar om kartan. Den lämnar 28,8 % utan grupp mot 16,2 %, har
  split-half-ARI 0,735 under gränsen 0,75 och poäng −0,014 mot 0,171. Den är alltså
  klart sämre för kartan.
- Demon "Var hamnar din mening?" behåller därför SBERT-kartan, dess grupper och namn.
  Besökarens mening bäddas in med bge-m3, och punkten placeras bland de närmaste
  passagerna i bge-m3 med deras koordinater på SBERT-kartan. Sökningen sker i
  webbläsaren på PCA-komprimerade int8-vektorer. Med 384 dimensioner hittar den 94,1 %
  av de tio närmaste passagerna enligt cosinus på de fulla vektorerna (500 slumpade
  passager som frågor). Med 256 dimensioner blir andelen 86,0 %.

#### Namn och intrångstest

31 av 33 debattgrupper har namn och rymmer 73,5 % av passagerna. Två grupper med
10,3 % har inget namn. 21 grupper delar minst 85 % av sina passager med en grupp som
fick namn 2026-10-13 och behöll det namnet. Tio fick namn efter läsning av åtta
slumpade passager var. I filosofin har 17 av 19 grupper namn (64,4 % av passagerna).

Intrångstestet visar fyra passager ur en grupp och en ur en annan, två uppgifter per
grupp. Läsaren pekade ut rätt passage i 52 av 66 uppgifter för debatterna (79 %) och
25 av 38 för filosofin (66 %). Slumpen ger 20 %. Noll rätt av två fick
skattesänkningar och budget, försvar och skogen bland debatterna, skönhet och konst
samt skrift och tro i filosofin. Läsaren var samma språkmodell som satte namnen och
hade redan läst passager ur 11 debattgrupper och 7 filosofigrupper. Testet är därför
inte oberoende, och en mänsklig läsare återstår.

#### Två nivåer

Grupper med minst 800 passager klustrades en gång till med åtta seeds. Delningen
visas när split-half-ARI når 0,75. Åtta av 13 debattgrupper delas, till exempel EU i
samarbete (1 101 passager), euron (535) och folkomröstning (178), och brott och polis
i polis och straff (1 055), alkohol (79) och abort (54). I filosofin delas en av fem
grupper. Delgrupperna har bara de vanligaste orden som etikett; ingen har läst dem.

### Uppföljning 2026-10-13: ämnesgrupper som går att visa

Körningarna nedan ersatte kartorna från 2026-10-12 och är i sin tur ersatta av avsnittet ovan.
De äldre resultaten står kvar längre ned som jämförelse. Statiska diagram över alla
resultat finns i `warehouse/cluster_lab/public-topics-2026-10-12/report.html`.

| Underlag | Passager | Grupper | Namngivna | Brus före och efter återföring | Största grupp | Seed-ARI | AMI mot talare eller författare |
|---|---|---|---|---|---|---|---|
| Partiledardebatter | 33 023 | 32 | 25 | 27,3 % och 14,0 % | 7,5 % | 0,77 | 0,102 |
| Filosofi, 113 verk | 21 260 | 17 | 13 | 52,5 % och 28,3 % | 13,5 % | 0,64 | 0,078 |

#### Debatter

Texten rensades från tilltal till talmannen, applådnoteringar, instämmandelistor och
procedurrader och delades vid meningsslut i passager om 80 till 150 ord. Det ger
33 023 passager ur 9 976 anföranden i 108 debatter.

Sökningen prövade 288 passningar med KBLab:s svenska SBERT. Vald körning
`1b8a9e8a84859c4437eb93f1`: vektorerna centrerade per talare, UMAP 5D med 30 grannar
och `min_dist` 0, HDBSCAN `eom` med `min_cluster_size` 150, `min_samples` 25 och
storlekstak 10 %. Centrering per talare höjde DBCV från 0,345 till 0,441 på första
seeden. Över tre seeds ger körningen 32, 33 och 31 grupper med seed-ARI 0,77 med brus
som egen grupp och 0,96 bland passager som fick grupp i båda körningarna.

Två grupper med centroidlikhet över 0,7 slogs ihop (klimat och grön skatteväxling).
4 385 bruspassager återfördes till närmaste grupp. På 4 801 gömda gruppassager
hamnade 93 % av de återförda i rätt grupp. Riktigt brus är svårare än gömda passager,
så talet är en övre gräns.

25 grupper fick namn efter läsning av 5 till 13 slumpade passager per grupp. De
rymmer 55,7 % av passagerna. Sju grupper med 30,3 % av passagerna har inget namn:
där delade passagerna inget ämne, de är repliker och allmän debattretorik. 14,0 % har
ingen grupp.

Utan storlekstak gav samma inställning en grupp på 66 % på två av tre seeds.
Sökningen på en seed såg inte det, så finalisterna körs alltid med taket.

### Resultat och tolkning

Grundsökningens 261 parameterpunkter och ytterligare 90 leaf-punkter är genomförda.
Det ger 351 unika passningar på fullt observationsunderlag, varav sex återanvända
länspiloter. Därtill finns sex mindre textpiloter, nio debatturvalskontroller,
21 lämna-ett-län-ut-kontroller och sju indikatorablationer: 394 sparade körningar.
Det frysta huvudregistret har inga misslyckade klustringskörningar.

Följande är granskningskandidater vid seed 42, valda per representation efter
originalrymdens silhuett, minst två grupper, högst 70 % brus och högst 80 % i en
grupp. Urvalet är geometriskt och efterhandsvalt; det fastställer inte semantisk
träffsäkerhet. Fullständig söktabell finns lokalt i `sweep.csv`.

| Representation / metod                     | Grupper | Gruppstorlekar |   Brus | Silhuett original / analyserad | Run-id                     |
| ------------------------------------------ | ------: | -------------- | -----: | ------------------------------ | -------------------------- |
| Debatt TF-IDF/SVD, HDBSCAN leaf            |      37 | 102-944        | 53,6 % | 0,147 / 0,679                  | `3dc85ece62abfbfdc4a2ae60` |
| Debatt MiniLM, HDBSCAN leaf                |      31 | 100-777        | 69,7 % | 0,117 / 0,493                  | `6e67fd92707114188ac5c16d` |
| Debatt svensk SBERT, HDBSCAN leaf          |      38 | 103-671        | 65,6 % | 0,147 / 0,514                  | `9fcb967c8ec972dad2532ac6` |
| Län, StandardScaler + K-means, original 7D |       2 | 16, 5          |    0 % | 0,292 / 0,292                  | `6de121cb59a3894dc3ae0fc7` |
| Län, StandardScaler + UMAP/HDBSCAN         |       2 | 16, 4          |  4,8 % | 0,332 / 0,433                  | `5ab95daf82fdc6b9f3bf872b` |
| Län, RobustScaler + K-means, original 7D   |       3 | 14, 4, 3       |    0 % | 0,280 / 0,280                  | `a0a88e4ef110bb7f0e4a903e` |

Alla tre debattkandidater använder UMAP 10D, `min_dist=0.2`, HDBSCAN
`min_cluster_size=100`, `min_samples=10`, leaf. TF-IDF och svensk SBERT använder
60 grannar; MiniLM 15. Länens UMAP-kandidat använder 3D, 3 grannar,
`min_dist=0.5`, HDBSCAN 3/2/eom. K-means-baslinjerna använder `n_init=20`.
Gruppstorlekarna i detalj och varje inaktiv/aktiv parameter finns i körningsfilerna.

#### Debatter

Seed 43/44 jämfört med 42:

| Representation | ARI alla id:n, brus som en grupp | ARI gemensamt tilldelade | Gemensamt tilldelade av hela korpusen | Byter brusstatus |
| -------------- | -------------------------------- | ------------------------ | ------------------------------------- | ---------------- |
| TF-IDF/SVD     | 0,860-0,872                      | 0,993-0,995              | 43,7-44,2 %                           | 4,9-5,4 %        |
| MiniLM         | 0,687-0,749                      | 0,954-0,960              | 26,2-26,3 %                           | 9,2-11,8 %       |
| Svensk SBERT   | 0,715-0,746                      | 0,962-0,969              | 29,7-30,3 %                           | 9,8-11,1 %       |

När 22 av 108 hela debatter hålls undan i tre olika urval, ligger kärn-ARI på
0,959-0,985 för TF-IDF, 0,874-0,894 för MiniLM och 0,897-0,933 för svensk SBERT.
ARI inklusive brus är samtidigt 0,643-0,685, 0,541-0,576 respektive 0,538-0,640.
Det är stabilitet hos omklustrade kvarvarande passager, inte precision på osedda
debatter. Brusgränserna ändras och merparten av materialet får ingen grupp i de
utvalda embeddingkandidaterna.

TF-IDF:s AMI mot talare/tidsdecennium är 0,222/0,196, jämfört med
0,136/0,062 för MiniLM och 0,139/0,057 för svensk SBERT. Sambandet med debatt
är 0,201/0,158/0,182; med parti 0,088/0,076/0,071; med längdklass
0,086/0,033/0,025. Tidssamband kan spegla både verkliga ämnesförändringar och
språk-/transkriptionsskillnader. Måtten särskiljer inte dessa förklaringar.

Representativa och slumpade exempel ger en blandad innehållsbild:

- TF-IDF-grupp 23, 944 passager, samlar referenser till Göran Persson:
  exempel `GP0913-51:702:1553` och `GT09142-48:9101:9999`. Grupp 20 har i stället
  allmänna argumentationsfraser. Dessa är inte avgränsade sakfrågor.
- MiniLM-grupp 18, 544 passager, har exempel om vårdgaranti och sjukvårdsbudget:
  `GU0949-65:3624:4380` och `H50956-76:0:579`. Grupp 8 blandar EU-institutioner
  och frihandelsdiskussioner.
- Svensk SBERT-grupp 35, 636 passager, innehåller migrations- och asyltexter:
  `GY09116-62:0:729` och `H50956-106:671:902`. Dess största grupp, 24, blandar
  personpolemik och allmän debattrhetorik över skilda sakfrågor.

Det finns stöd för reproducerbara textkärnor och vissa ämnesnära grupper, men
ingen verifierad sakfrågetaxonomi eller träffsäkerhet. Modellerna jämförs i olika
representationer och på olika tilldelade delmängder; ett högre silhuettvärde gör
inte en modell semantiskt bättre. Nästa experiment bör vara en blind granskning
av slumpade passager och brus, följd av en kontrollerad variant utan hälsnings-
och argumentationsmallar. Testa också passagegränser efter meningar och behandla
personnamn som en separat känslighetsanalys, med samma spårbara id:n.
