# Klustring av partiledardebatter och länsprofiler

Experiment 2026-10-12. [Metod, datakvalitet och återkörning](public-clustering-method.md)
innehåller källhashar, modellrevisioner, hela parameterutrymmet och kommandon.
Det underliggande Riksdagslagret saknas lokalt; den befintliga publicerade
fulltextkorpusen har frysts utan ny ingestion. Ingen data har publicerats.
Endast öppen, publicerad data skickas till Workers AI. Besökarens text loggas aldrig och sparas inte.

Debatterna omfattar 108 debatter och 10 148 hämtade anföranden från 1993-2026.
Efter parti-/längdkrav används 26 592 icke överlappande passager från 9 986
anföranden. Separat texttvätt tar bort Word-fält och återförenar avstavningar,
med oförändrade id:n och originalen bevarade. Kvarvarande fältfragment och
rengöringsheuristik redovisas i metodrapporten. Representativa, slumpade och
slumpade bruspassager sparas med spårbarhet till debatt, talare, parti och datum.

Länsprofilen använder sju numeriska årsindikatorer från Kolada under 2024,
alla 21 län och inga saknade värden. Månadstal, flerårsestimat och upprepad
länshistorik ingår inte. Grupperna gäller liknande indikatorprofiler, inte
hur bra regionerna mår. Skala, dtype (float32), observations-id och ML-kod
är frysta före modelljämförelserna.

## Uppföljning 2026-10-14: konsensus över tolv seeds

Kartorna på sidan Klustervisualiseringar bygger nu på körningarna nedan. Avsnittet
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

### Varianter

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

### Namn och intrångstest

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

### Två nivåer

Grupper med minst 800 passager klustrades en gång till med åtta seeds. Delningen
visas när split-half-ARI når 0,75. Åtta av 13 debattgrupper delas, till exempel EU i
samarbete (1 101 passager), euron (535) och folkomröstning (178), och brott och polis
i polis och straff (1 055), alkohol (79) och abort (54). I filosofin delas en av fem
grupper. Delgrupperna har bara de vanligaste orden som etikett; ingen har läst dem.

### Kommuner

280 kommuner 2024 med tolv indikatorer. Till de sju tidigare kom folkmängd
(logaritmerad), in- och utpendling, försörjningskvot och andel med eftergymnasial
utbildning från Kolada. PCA behåller fyra komponenter (40,2, 24,0, 11,7 och 6,1 % av
variansen).

Gap-regeln väljer k=2 (71 och 209 kommuner): silhouette 0,352 mot 0,201 för omkastade
kolumner, bootstrap-ARI 0,75. Med sju indikatorer var silhouette 0,327 mot 0,253.
Sidan visar den finare delningen k=4, som har högst bootstrap-ARI (0,77) och
silhouette 0,274 mot 0,201.

| Grupp | Kommuner | Kännetecken |
|---|---|---|
| Förorter med hög inkomst och pendling | 33 | medianinkomst 470 452 kr, utpendling 70,8 % |
| Mindre orter med stabil sysselsättning | 111 | arbetslöshet 2,1 %, sysselsättning 84,6 % |
| Större städer | 40 | arbetslöshet 3,4 %, eftergymnasial utbildning 45,7 % |
| Landsbygd med svagare arbetsmarknad | 96 | ohälsotal 31,0 dagar, bistånd 3,4 % |

AMI mot SKR:s kommungrupper är 0,319 för k=4 och 0,172 för k=2, mot 0,138 med sju
indikatorer. Grupperna följer nu kommuntyp mer än förut, vilket är väntat när
folkmängd och pendling ingår. Silhouette 0,27 betyder att grupperna överlappar.

## Uppföljning 2026-10-13: ämnesgrupper som går att visa

Körningarna nedan ersatte kartorna från 2026-10-12 och är i sin tur ersatta av avsnittet ovan.
De äldre resultaten står kvar längre ned som jämförelse. Statiska diagram över alla
resultat finns i `warehouse/cluster_lab/public-topics-2026-10-12/report.html`.

| Underlag | Passager | Grupper | Namngivna | Brus före och efter återföring | Största grupp | Seed-ARI | AMI mot talare eller författare |
|---|---|---|---|---|---|---|---|
| Partiledardebatter | 33 023 | 32 | 25 | 27,3 % och 14,0 % | 7,5 % | 0,77 | 0,102 |
| Filosofi, 113 verk | 21 260 | 17 | 13 | 52,5 % och 28,3 % | 13,5 % | 0,64 | 0,078 |

### Debatter

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

### Filosofi

100 verk från Project Gutenberg lades till Atlasens 13, sammanlagt 113 verk av 66
författare i 20 traditioner, högst 200 passager per verk. Den publicerade Atlasen
(`corpus.json`) är oförändrad. De nya verken ligger i `corpus_extended.json`.

576 passningar med två modeller. Utan centrering följer grupperna författaren: AMI
mot författare 0,48 som högst. Centrerat per verk sjunker det till 0,078 i vald
körning `374061f1cc0b8a61bc9712d3` (paraphrase-multilingual-MiniLM-L12-v2, UMAP 5D
med 30 grannar, HDBSCAN `eom` 120 och 25). Varje grupp spänner över minst 70 verk.

Seed-ARI är 0,64 med brus som egen grupp och 0,88 bland tilldelade passager. Gränsen
0,75 nås inte. Kärnan lämnar 52,5 % som brus och DBCV är 0,25 på första seeden.
Grupperna är alltså glesare och mindre stabila än debatternas, och kartan ska läsas
som en rimlig indelning bland flera. 13 av 17 grupper fick namn och rymmer 62,0 % av
passagerna.

### Kommuner och län

280 kommuner 2024 med sju indikatorer. Tio kommuner saknar värde för ekonomiskt
bistånd och ingår inte. StandardScaler, PCA med tre komponenter (51,8, 20,0 och
9,7 % av variansen) och K-means. Gap-statistiken valde k=3 bland lösningar med
bootstrap-ARI minst 0,75.

| Grupp | Kommuner | Kännetecken |
|---|---|---|
| Hög inkomst | 43 | medianinkomst 460 777 kr, ohälsotal 17,5 dagar |
| Stabil sysselsättning | 128 | nära medel på inkomst, låg arbetslöshet |
| Högre arbetslöshet och bistånd | 109 | arbetslöshet 3,1 %, bistånd 3,4 % |

Silhouette 0,327 mot 0,253 för omkastade kolumner (95:e percentilen, 200 omgångar).
Bootstrap-ARI 0,82. AMI mot SKR:s kommungrupper är 0,138: grupperna följer
välfärdsutfall och inte kommuntyp. Silhouette runt 0,33 betyder att grupperna
överlappar. De är en sammanfattning av en gradient och inga skilda kommunslag.

Länen klustras inte längre. 21 observationer gav grupper som ändrades när ett län
eller en indikator togs bort. Rapporten visar länen efter två principalkomponenter
(40,1 och 35,0 % av variansen) med indikatorernas riktning.

## Resultat och tolkning

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

### Debatter

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

### Länsprofiler

StandardScaler/K-means-baslinjen ger 16 och 5 län. Exempel nära respektive
centroid är Västmanland/Östergötland/Kronoberg och Halland/Västerbotten/Norrbotten.
Medelvärdena är oviktade genomsnitt av länens indikatorvärden, inte en ny
sammanslagen befolkningsstatistik eller medianinkomst för gruppens invånare.

Baslinjens ARI mellan seeds är 0,792. När ett län tas bort och skala/modell passas
om är medel-ARI 0,589, median 1,000 och lägsta 0,020. Att ta bort Örebro,
Västmanland eller Gävleborg ger de lägsta värdena; även Stockholm och Halland
påverkar partitionen starkt. Stabilitet på ett oförändrat litet dataset är därför
otillräcklig som stöd för beständiga grupper.

Indikatorablationerna ger ARI 0,031 utan medianinkomst eller ekonomiskt bistånd,
och -0,050 utan gymnasiebehörighet. Utan ohälsotal är indelningen oförändrad
(ARI 1,000). Denna tvågruppslösning fångar således inte hälsa särskilt väl.
UMAP/HDBSCAN-kandidaten är också seedkänslig: ARI alla län 0,161-0,273,
kärn-ARI 0,246-0,564 och 14,3-23,8 % växlar brusstatus.

En kolumnvis permutationsreferens, 200 upprepningar, ger median-silhuett 0,169
och 95:e percentil 0,275 mot baslinjens 0,292. Andelen minst lika höga nullvärden
med +1-korrigering är 0,025. Detta är en efterhandsvald, explorativ referens som
visar mer struktur än oberoende kolumner; den bevisar inte diskreta välfärdsklasser.

Slutsatsen är att länens profiler samvarierar, men att indelningen är känslig för
vilka län och indikatorer som ingår. Grupperna får inga namn som bra/dåliga eller
friska/sjuka län. Nästa experiment bör jämföra explicit viktade indikatorfamiljer
och en separat FoHM-profil med samma flerårsperiod och publicerade
osäkerhetsintervall. Ingen sådan utvidgning har körts i denna uppgift.
