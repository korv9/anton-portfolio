# Metod och återkörning för offentliga klustringsexperiment

## Frysta data och kvalitet

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

## Representation och jämförelse

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

## Återkörning och lokala artefakter

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

## Ämnesgrupper 2026-10-13: urval, förfining och återkörning

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

## Konsensus 2026-10-14: tolv seeds, två nivåer och intrångstest

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
`sources/kolada_structure_2024.json` och räknar nollfördelningen för silhouette per k.

## Leverans och kontroller

Det ignorerade resultatregistret innehåller 394 slutförda klustringskörningar,
varav 351 huvudsökningar, samt 60 separata 2D-layouter. `sweep.csv`,
`layout-sweep.csv`, `stability.json`, `resample-stability.json` och
`welfare-permutation.json` innehåller mätningar och körnings-id:n.
De 37 urvals-/indikatorjämförelserna och 200 permutationsreferenserna sparas
separat. Alla 60 layouter har verifierade observations-id:n, oförändrade
klustertilldelningar och checksummor. Textkartorna visar 5 000 av 26 592
passager; länskartorna visar alla 21 län.

Relevanta ML- och datakontraktstester: 39 godkända, ett överhoppat test eftersom
dess separata SymbolicAtlas-underlag saknas. Två befintliga frontendtester
godkändes mot det nya registret. Typkontroll, formateringskontroll och
diffkontroll godkändes. Lokal granskning i desktop- och mobilstorlek gav inga
sidfel, horisontell overflow eller axe-fynd. Länsprofilerna visar indikatorernas
ursprungliga enheter; större markörer för små dataset ändrar endast visningen.
Återupptagning av färdiga piloter kontrollerades utan nya körningsrader.
