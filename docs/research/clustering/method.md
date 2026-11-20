# Clustering: method

The shared protocol was fixed on 2026-10-29, before any final evaluation ran. It covers four domains: Philosophy Lab,
Symbol Lab, job ads and Replik (Riksdag party-leader debates). Each domain's results are in its own
file: [Philosophy Lab](philosophy.md), [Symbol Lab](symbolic.md), [job ads](jobs.md) and
[Replik](debates.md). The public-research runs of 2026-10-12 to 2026-10-14 (debates, philosophy,
[municipalities and counties](regions.md)) have their own method section below. Existing pre-registrations (philosophy-moral, sweden-*, oldbailey, ai-act)
are separate projects and stay as they are.

## Champion and candidates

The champion of a domain is the pipeline its site page publishes today. A candidate replaces it
only when it meets every criterion in `configs/experiments/<domain>.yaml`. Those files were written
before the final evaluation and carry a `frozen_at` date; the acceptance report stores the file's
SHA-256, so a later edit is visible. Criteria are checked one by one and reported with both
values. There is no weighted total. A missing or non-finite (NaN) metric fails its criterion,
and a file without criteria is refused, so an empty rule set cannot pass a candidate. If no
candidate passes, the champion stays, and the rejected
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

The heavy path in GitHub Actions is the existing `heavy-compute.yml` `module` job on a standard
Ubuntu runner, CPU only. It pulls the domain's features folder from R2, runs, and pushes it back,
including checkpoints after a failure. Source texts stay under the storage rules of
`src/portfolio/storage/warehouse_store.py`: only text whose licence allows redistribution may be in
the public bucket.

## Runner measurements (2026-10-30)

Each domain's `select` step ran once from scratch on a standard Ubuntu runner (4 CPUs, no GPU),
from main after #199. It was started with the third word `repro`, so checkpoints and embeddings
went to separate `-repro-<run id>` folders and nothing was resumed. `select` registers nothing, so
the registries did not change. Times are the run step only; R2 pull and push add under a minute.

| Domain         | Actions run | Run step    | Fits    | Peak memory  |
| -------------- | ----------- | ----------- | ------- | ------------ |
| Philosophy Lab | 40998784012 | 9 min 42 s  | 48      | 3.57 GB      |
| Symbol Lab     | 40999907253 | 16 min 12 s | 7 units | 3.11 GB      |
| Replik         | 41001632612 | 2 h 12 min  | 25      | not recorded |
| Job ads        | 41014204044 | 53 min 43 s | 37      | not recorded |

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
and `final` judges candidates against an empty registry of its own. In `heavy-compute.yml` the
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

## Final on the runner (2026-10-30)

`final` then ran from scratch on the runner for every domain, from main after #201, each under its
own repro root (`repro:final-<domain>`). Each step was measured with GNU time. The stored
registries did not change. For jobs, `select` ran first in the same job because the picks belong to
a snapshot.

| Domain         | Actions run | Step    | Time        | Peak memory |
| -------------- | ----------- | ------- | ----------- | ----------- |
| Philosophy Lab | 41022958155 | final   | 4 min 0 s   | 2.16 GB     |
| Symbol Lab     | 41023837255 | prepare | 6 min 50 s  | 1.47 GB     |
|                |             | final   | 11 min 41 s | 3.07 GB     |
| Replik         | 41026327146 | final   | 50 min 52 s | 2.82 GB     |
| Job ads        | 41032672311 | select  | 1 h 7 min   | 3.96 GB     |
|                |             | final   | 30 min 40 s | 2.71 GB     |

Every other `prepare` step took under 15 s and under 0.5 GB. Each run finished inside one 255-minute
budget with no deadline stop.

The runner reached a different decision from the local run in every domain. Each candidate is
judged here against the refitted champion of the same run (`tmp/repro/compare.txt` locally):

- Philosophy Lab: same dataset. K-means 10, the local registry champion, fails "separation not
  worse": 0.026 against a champion at 0.061 with 0.03 allowed. bge-small passes and the repro promotes
  it. HDBSCAN 40 is rejected as before, now on seed stability too (0.41).
- Symbol Lab: same dataset. All three candidates pass against the refitted v4 run. Locally, all three
  were rejected. The masked, book-centred run had separation 0.033 here against 0.008 locally. The
  multilingual run had seed ARI 0.69 against 0.45 locally. These gaps are larger than the UMAP drift
  in Philosophy Lab. One likely cause is that the local embeddings came from a GPU and these from a
  CPU, but that was not tested.
- Replik: same dataset. sbert-party, the local registry champion, fails "a measured gain" because
  its party AMI gain is under 0.01. K-means 30 passes and the repro promotes it.
- Job ads: a newer snapshot (2,869 ads, 2,793 after deduplication, dataset `d1e98b56ca7c43f7`), so
  this is not a reproduction. Raw MiniLM-L12 K-means 8 and clean KBLab K-means 8 pass, and the first
  is promoted. Raw TF-IDF HDBSCAN fails, with its largest group at 54 %.

So the frozen margins are no wider than the difference between two machines running the same code
on the same data. The promotions in the stored Philosophy Lab and Replik registries rest on one
machine's numbers and do not reproduce. Both were rolled back on 2026-10-30
(`Registry.rollback` with `to`): every domain's registry champion is again its original pipeline. Cluster Visuals
shows the rerun result in the limitations of each affected run (`configs/experiments/reproduction.yaml`). Before any page
uses a registry champion, the decision needs a re-run on fixed hardware, or wider margins fixed in
advance.

The run also exposed a fault in Symbol Lab's `final`. It judged each candidate against the current
registry champion, so after one promotion the next candidate was judged against the new champion.
The repro registry shows three promotions in a row. The fault never fired locally, where nothing
passed. `final` now judges every candidate against the refitted v4 run, like the other domains,
and promotes only the first pass. Under that rule, the repro would have promoted the retuned
HDBSCAN 50.

A second runner rerun of `final` for Philosophy Lab and Symbol Lab (Actions runs 41051018576 and
41051992370, repro labels `final-<domain>-b`) matched the first to four decimals in every count,
noise share and seed ARI, and every acceptance verdict. The runner is therefore a fixed machine for
this code: on it, bge-small passes in Philosophy Lab and all three Symbol Lab candidates pass
against v4. Nothing was promoted from these runs. The criteria were frozen before any machine was
named, so choosing the runner after seeing its results is a decision for the owner, not for the
protocol. Replik and job ads were not rerun a second time.

## The runner decides (2026-10-30)

The owner chose the runner as the machine that decides. A second runner run of Replik's `final`
(Actions run 41073947884, label `final-debates-b`) matched the first in all 34 metrics of every
run, to four decimals, with the same verdicts. The stored registries of Philosophy Lab, Symbol Lab
and Replik are now the runner's repro registries. Each earlier local registry is kept beside it as
`registry-local-2026-10-29.json`. The run files in Cluster Visuals now come from the runner export
(same run ids), and each run whose decision differed carries the local result as a "Local run"
limitation (`configs/experiments/reproduction.yaml`).

| Domain         | Registry champion                                | Run id             |
| -------------- | ------------------------------------------------ | ------------------ |
| Philosophy Lab | bge-small-en-v1.5, work-centred, HDBSCAN 40/8    | `f367c26d34300562` |
| Symbol Lab     | retuned HDBSCAN (mcs 50)                         | `a224a1756ec00889` |
| Replik         | KBLab sentence-BERT, speaker-centred, K-means 30 | `b33f92b181b8e676` |
| Job ads        | unchanged; the runner used a newer snapshot      | `a35140926c6bf532` |

The Symbol Lab repro registry held the three chained promotions from the old `final`. It was
rolled back to the first pass (`Registry.rollback` with `to`, the later two kept as candidates),
which is what the fixed `final` promotes. As before, no site page changed: each page still
publishes its existing pipeline.

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

## Cluster Visuals: clustering experiments

The experiments view shows the runs that `ml/experiments` registers for four domains
(philosophy, symbolic, jobs, debates). The frontend code is in
`frontend/src/clusters/experiments/`.

### Addresses

- `#cluster-visuals` ends with a section that shows each domain's champion run.
  `?domain=jobs` picks the domain and `?group=3` picks a group of that champion.
- `#cluster-visuals-experiments` lists candidates and rejected runs with their status.
  `?domain=jobs` picks the domain. With no `run`, the first non-champion run opens.
- `#cluster-visuals-experiments?run=<run_id>&group=<n>` opens any registered run, champion
  included, and one of its groups. Picking a group in the table or under the map rewrites
  `group` in place, so the address can always be shared.

### Data

`frontend/public/data/cluster-experiments/index.json` loads with the page. A run's file,
`runs/<run_id>.json`, loads only when that run is opened. Both are written by
`ml/experiments/export.py`. The view reads them as they are:

- The coordinates note from the index appears above the maps. Each run's map is drawn
  again from its own points, and nothing moves from one run's map to another's.
- Group names say what the export says about them. A `generated...` status reads
  "Generated, not reviewed". Only `reviewed` or `human...` reads as reviewed.
- The table against the champion lists `acceptance.criteria` row by row: the rule from
  the frozen criteria file, the candidate value, the champion value and whether it passed.
  An `any_of` criterion is shown with its alternatives indented under it.

States: loading, "No runs registered yet." (a 404, a release without the file, or an
index with no runs), an error when the index or a run file fails, and "No champion yet"
for a domain without one.

### Delivery

The folder belongs to the `baseline` delivery group (`configs/delivery/baseline.json`
includes everything not excluded). The baseline spec validates `index.json` against
`configs/delivery/schemas/clusters/experiments-index.json`. Its check
`platform/publish/validate_cluster_experiments.py` validates every run file against
`experiments-run.json` and compares the index with the run files: the same statuses and
domains, and at most one champion per domain. With no folder the check passes. The
catalogue (`npm run data:catalog`) picks the files up by scanning `public/data`.

### Tests

`frontend/tests/cluster-experiments.spec.ts` uses synthetic route-mocked fixtures only.
It covers the champion default, the experiments list, a run and group deep link, the
empty and error states, phone width and axe. `CX_SCREENS=1` also saves screenshots to
`tmp/screens-experiments/`.

## Metod och återkörning för offentliga klustringsexperiment

### Frysta data och kvalitet

Debattunderlaget är de 108 partiledardebatter som de publicerade anförandekorten
och debattindexet identifierar. Deras 10 148 anföranden har hämtats som fulltext
genom projektets befintliga leveransmanifest. De frysta filerna omfattar
1993-10-06 till 2026-06-10. Ingen ny Riksdagsingestion körs. Det lokala
underliggande Riksdagslagret finns inte i detta workspace; analyserna utgår därför
från den publicerade fulltextsnapshoten, inte från en ny kontroll mot alla protokoll.

Observationsenheten är en icke överlappande passage, normalt 120 ord. Sista
delen slås ihop med föregående om den har färre än 40 ord. Endast anföranden med
ett av de åtta normaliserade partierna och tillräcklig text behålls: 9 986 anföranden
ger 26 592 passager; 162 anföranden utesluts. Varje id anger ursprungligt anförande
och teckenposition. Debatt, talare, parti, datum och källväg följer med. Inga av
dessa identifierare läggs till i modelltexten.

Råtextpiloten och TF-IDF-sökningen visade att 1 073 passager innehåller Word-fält
som `STYLEREF`/`MERGEFORMAT`. En större grupp dominerades av dessa fält.
Råtextsökningen stoppades vid checkpoint och behålls som kontrollmaterial i
`warehouse/cluster_lab/public-research-2026-10-12/`.
Huvudexperimentets separata snapshot tar bort kompletta Word-fält ur 1 049 passager och
återförenar avstavningar vid radbrytning i 6 225 passager. Id:n och antalet
observationer är oförändrade. I 24 passager återstår fältfragment efter passagegränser; de och risken för
felaktigt hopfogade sammansatta ord är kvarstående rengöringsbegränsningar.
Originalen behålls. Inga exakta råpassagedubbletter hittades. En TF-IDF-kontroll av
2 000 råpassager fann inga närmaste grannar med likhet minst 0,96 inom urvalet;
det visar inte att hela korpusen saknar närdubbletter. Passager från samma anförande
eller debatt är beroende observationer.

Länsunderlaget är 21 län under 2024, med sju årsindikatorer från Kolada.
2025 saknar sysselsättningsgrad och medianinkomst i det publicerade underlaget;
2024 är det senaste kompletta året för den valda uppsättningen:
öppen arbetslöshet 18-65 år, sysselsättning 20-64 år, ohälsotal i dagar,
medianförvärvsinkomst i kronor, ekonomiskt bistånd i procent, anmälda våldsbrott
per 100 000 och gymnasiebehörighet i procent. Alla 21 län har samtliga värden.
Ingen imputering görs. Riket, månadsserier, FoHM:s flerårsestimat och ESS:s
NUTS2-regioner ingår inte i modellmatrisen. Koladas publicerade länsvärden används;
kommunmedianer eller andelar med olika nämnare summeras inte. Indikatorernas
åldersgrupper och populationer skiljer sig och profilerna beskriver län, inte individer.

Projektets publicerade välfärdskörning redovisar 141 godkända dbt-tester.
Det är historisk kontraktsevidens, inte en ny dbt-körning i detta workspace.
Snapshotkontroller verifierar unik grain, saknade/icke-finita värden, andelar inom
0-100 och spårbara källhashar. ML- och datakontraktstester körs separat.

### Representation och jämförelse

Text jämförs med TF-IDF (1-2 gram, `min_df=2`, `max_df=0.9`, sublinear TF,
högst 20 000 termer), TruncatedSVD 128 och L2-normalisering; flerspråkig
MiniLM 384D; samt [KBLab:s svenska meningsmodell](https://huggingface.co/KBLab/sentence-bert-swedish-cased)
768D. Exakta modellrevisioner finns i config. Långa textinput kodas med det
befintliga tokenbaserade chunkflödet, utan att tyst kasta slutet. SVD-fitseed är
42 även när UMAP-seed ändras. Alla sparade representationer är float32.

Länsmatrisen använder StandardScaler eller RobustScaler på de sju numeriska
kolumnerna, utan L2-normalisering. Skalarna sparas. Ekonomiska mått är delvis
korrelerade, exempelvis arbetslöshet/sysselsättning omkring -0,70; lika vikt per
kolumn är därför inte lika vikt per välfärdsdimension. Inget sammanvägt må-bra-index
eller rangordning skapas.

Piloterna använder samma 600 debattpassager respektive alla 21 län.
Huvudsökningen jämför originalrepresentation, PCA och UMAP för klustring.
Debatt-UMAP: 10D, grannar 15/60, minsta avstånd 0/0,2, seeds 42/43/44.
K-means använder 20 grupper (MiniBatch på full textkorpus); HDBSCAN prövar
minsta storlek 50/100 och `min_samples=10`, både eom och leaf. Direkta
HDBSCAN-passningar på högdimensionell fulltext undviks av resursskäl; PCA är
densitetsbaslinjen. Läns-UMAP: 3D, grannar 3/7/14, minsta avstånd 0/0,2/0,5,
samma seeds. Baslinjerna är K-means med 2/3 grupper (`n_init=20`) och
HDBSCAN med minsta storlek 3, `min_samples=2`. RobustScaler används som
känslighetsbaslinje; dess UMAP-rymd söks inte lika omfattande.

Silhuett redovisas både i den frysta originalrepresentationen och i analyserad
rymd. På debattdata används cosinusavstånd i originalrepresentationen; på län
euklidiskt avstånd i skalerad profil. Brus utesluts från silhuett, vilket gör
jämförelser mellan tilldelade delmängder villkorliga. Textmåttet använder fasta
1 200 id:n; länsmåttet alla län. AMI mot debatt, talare, parti, tidsperiod och
ursprunglig anförandelängd söker möjliga störfaktorer och är ingen sakfrågeprecision.

Seedstabilitet jämför samma id:n med ARI inklusive brus som en gemensam grupp,
ARI på gemensamt tilldelade, deras andel och andelen som byter brusstatus.
Urvalskontroller håller undan hela debatter respektive ett län åt gången och
passar om representation/skalning där det behövs. Representativa och slumpade
exempel sparas per grupp. Automatiska termer är beskrivningar, inte verifierade namn.

### Återkörning och lokala artefakter

Förbered råsnapshoten med `public_research prepare`, skapa separat rensad
snapshot med `python -m ml.research.prepare_public_profiles`. Ändra inte en
snapshot som redan har körningar; använd nytt output för ändrat underlag.
Kör sedan:

```powershell
python -m ml.cluster_lab.public_research pilot --config configs/cluster_lab/public_research_clean.yaml
python -m ml.cluster_lab.public_research run --config configs/cluster_lab/public_research_clean.yaml
python -m ml.cluster_lab.public_research run --config configs/cluster_lab/public_research_clean_leaf.yaml
python -m ml.research.public_results resample --config configs/cluster_lab/public_research_clean.yaml
python -m ml.research.public_results analyze --config configs/cluster_lab/public_research_clean.yaml
```

Färdiga körningar återanvänds med checksummekontroll; avbrutna embeddings har
batchcheckpointar. Varje körning sparar `config.json`, `run.json`,
`assignments.parquet`, `metrics.json`, `profiles.json` och klustringsmodell.
Delad cache innehåller embeddingmatriser, TF-IDF/SVD-modell, skalar och reduktioner.
Ingen ny grafextraktion, promotion eller R2-uppladdning görs.
Resultatanalysen använder faktisk fit-täckning: länspiloten med alla 21 län är
redan en fullständig baslinje och återanvänds även när en full-körning begärs.
Körningens ursprungliga fas skrivs inte om. `frozen-ml-code.zip` och
`preparation_code.py` bevarar de använda källversionerna i det ignorerade registret.

2D-layouts varierar endast geometrin och bevarar id:n och assignments-checksumma.
De kan öppnas med det befintliga canvasgränssnittet i lokal Cluster Lab. Starta
en separat lokal Vite-server från reporoten:

```powershell
$env:CLUSTER_LAB_OUTPUT='warehouse/cluster_lab/public-research-clean-2026-10-12'
node node_modules/vite/bin/vite.js --config frontend/vite.config.ts --host 127.0.0.1 --port 5174 --strictPort
```

Öppna `http://127.0.0.1:5174/#cluster-visuals`. Huvudservern och startsidan
behöver inte ändras.

### Ämnesgrupper 2026-10-13: urval, förfining och återkörning

Urvalsmåttet i `ml/cluster_lab/evaluate.py` (`score`) är nu DBCV minus avdrag för
brus, största grupp och högsta AMI mot författare, talare eller översättare. DBCV
läses från HDBSCAN:s `relative_validity_`. Silhouette i originalrummet används bara
när DBCV saknas. Det gamla måttet belönade grupper som följde talarens namn.

`ml/cluster_lab/refine.py` gör två steg efter HDBSCAN:

- Grupper slås ihop när cosinuslikheten mellan deras medelcentrerade centroider
  passerar `merge_similarity` (0,7). Vid 0,6 slogs skilda ämnen ihop, till exempel
  Nato och Afghanistan.
- Brus återförs till närmaste centroid när likheten når gruppens 10:e percentil och
  ligger minst 0,05 över näst närmaste grupp. En femtedel av gruppassagerna göms
  först, så precision och täckning mäts i samma körning.

Kärnmedlemskap sparas i kolumnen `core` i `assignments.parquet`.

Stegen i `ml/research/topics.py`:

```
python -m ml.research.topics prepare --config configs/cluster_lab/public_topics.yaml
python -m ml.research.topics search --config configs/cluster_lab/public_topics.yaml --only debate
python -m ml.research.topics finalists --config configs/cluster_lab/public_topics.yaml --new-runs 1
python -m ml.research.topics layouts --config configs/cluster_lab/public_topics.yaml
python -m ml.research.regions
python -m ml.research.export_public_maps
```

`search` kör en seed över centrering, UMAP (15 eller 30 grannar, 5 eller 10
dimensioner) och HDBSCAN, och fortsätter där den avbröts. `finalists` kör de fem
bästa inställningarna på seeds 42, 43 och 44 med storlekstak 10 % per grupp och
väljer högsta medelpoäng bland dem med seed-ARI minst 0,75. Når ingen gränsen väljs
högsta seed-ARI och `pick-<namn>.json` får `stable: false`. `--new-runs 1` avslutar
processen med kod 3 efter varje ny körning, så minnet lämnas tillbaka. Upprepa
kommandot tills koden är 0.

Gruppnamn står i `configs/cluster_lab/public_topic_names.yaml` tillsammans med
körningens id. Exporten släpper namnen när id:t inte längre är den valda körningen.

Den anpassade UMAP-modellen (`model.joblib`, 100 till 330 MB per rum) tas bort efter
varje reduktion. Ingen kod läser den.

Filosofikorpusen hämtas med
`python platform/ingest/philosophy/ingest_corpus.py corpus_extended.json`.

### Konsensus 2026-10-14: tolv seeds, två nivåer och intrångstest

`ml/research/consensus.py` läser `configs/cluster_lab/public_consensus.yaml`:

```
python -m ml.research.consensus prepare
python -m ml.research.consensus seeds --new-runs 1
python -m ml.research.consensus consensus
python -m ml.research.consensus levels
python -m ml.research.consensus layout
python -m ml.research.consensus intrusion
python -m ml.research.regions
python -m ml.research.export_public_maps
```

`seeds` kör UMAP (5D, 30 grannar, `min_dist` 0) och HDBSCAN (`eom`, storlekstak 10 %)
för varje variant och seed 0 till 11 och sparar bara etiketterna. `--new-runs 1`
avslutar processen med kod 3 efter varje körning, så minnet lämnas tillbaka. Upprepa
tills koden är 0. På en dator med 16 GB minne behövs det.

`consensus` länkar grupper mellan körningar när deras Jaccard-likhet når
`link_jaccard` (0,3), behåller de länkade grupper som minst `support` (0,5) av
körningarna hittar och ger varje passage majoritetens grupp. Sedan körs samma
sammanslagning och återföring som i `ml/cluster_lab/refine.py`. Metoden följer
Strehl och Ghosh (2002), meta-klustring av basgrupper. Resultatet ligger i
`<variant>/result.json` och `<variant>/assignments.parquet` med kolumnerna `core`
och `vote`. `pick-<underlag>.json` skrivs när underlagets alla varianter har ett
resultat.

`multilingual-e5-large` läses i revision `3d7cfbdacd47fdda877c5cd8a79fbcc4f2a574f3`
med prefixet `query: ` och halv precision. Vektorerna sparas i `vectors/`.
Inbäddningen tar ungefär två timmar per underlag på ett GTX 1660 och har ingen
kontrollpunkt: avbryts den börjar den om.

`levels` klustrar varje grupp med minst 800 passager en gång till (åtta seeds, 15
grannar) och behåller delningen när split-half-ARI når 0,75. `intrusion` skriver
uppgifterna i `intrusion-<underlag>-tasks.json` och facit i en egen fil, så läsaren
inte ser facit. Svaren och träffarna ligger i `intrusion-<underlag>-result.json`.

De vanligaste orden per grupp räknas med c-TF-IDF. För svenska texter används
stoppordslistan `SWEDISH` i `consensus.py`.

`ml/research/regions.py` hämtar de fem nya indikatorerna från Kolada en gång till
`warehouse/cluster_lab/public-consensus-2026-10-13/sources/kolada_structure_2024.json`
(`configs/cluster_lab/public_regions.yaml`) och räknar nollfördelningen för silhouette per k.

### Leverans och kontroller

Det ignorerade resultatregistret innehåller 394 slutförda klustringskörningar,
varav 351 huvudsökningar, samt 60 separata 2D-layouter. `sweep.csv`,
`layout-sweep.csv`, `stability.json`, `resample-stability.json` och
`welfare-permutation.json` innehåller mätningar och körnings-id:n.
De 37 urvals-/indikatorjämförelserna och 200 permutationsreferenserna sparas
separat. Alla 60 layouter har verifierade observations-id:n, oförändrade
klustertilldelningar och checksummor. Textkartorna visade 5 000 av 26 592
passager och länskartorna alla 21 län i körningen 2026-10-12. De publicerade kartorna
visar nu 3 000 av 33 023 debattpassager, 3 000 av 21 260 filosofipassager och alla
280 kommuner (k=4); länen klustras inte längre.

Relevanta ML- och datakontraktstester: 39 godkända, ett överhoppat test eftersom
dess separata SymbolicAtlas-underlag saknas. Två befintliga frontendtester
godkändes mot det nya registret. Typkontroll, formateringskontroll och
diffkontroll godkändes. Lokal granskning i desktop- och mobilstorlek gav inga
sidfel, horisontell overflow eller axe-fynd. Länsprofilerna visar indikatorernas
ursprungliga enheter; större markörer för små dataset ändrar endast visningen.
Återupptagning av färdiga piloter kontrollerades utan nya körningsrader.
