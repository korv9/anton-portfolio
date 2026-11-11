# Kommuner och län: klustringsresultat (sv)

Från de offentliga experimenten 2026-10-12 till 2026-10-14. Data, skalning och kommandon står i [method.md](method.md#metod-och-återkörning-för-offentliga-klustringsexperiment); debattdelen och kandidattabellen från 2026-10-12, med länsraderna, i [debates.md](debates.md#partiledardebatterna-i-de-offentliga-experimenten-2026-10-12-till-2026-10-14-sv).

## Kommuner, 2026-10-14

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

## Kommuner och län, 2026-10-13

280 kommuner 2024 med sju indikatorer. Tio kommuner ingår inte: sju saknar värde för
ekonomiskt bistånd och tre för valdeltagande. StandardScaler, PCA med tre komponenter (51,8, 20,0 och
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

## Länsprofiler, 2026-10-12

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
