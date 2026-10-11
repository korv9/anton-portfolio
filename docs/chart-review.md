# Genomgång av grafer och KPI-vyer

Bedömning den 11 oktober 2026 av den aktuella frontendkoden. Projektgrafen användes först,
men innehåller också filer som har flyttats eller tagits bort. Hänvisningarna nedan har
verifierats i nuvarande kod. Detta är en genomgång av visualiseringarnas konstruktion och
analytiska presentation, utan visuell kontroll i webbläsare eller kontroll av källdatasetens
riktighet. Förslagen är inte genomförda i gränssnittet.

Efter precisering av uppdraget ligger fokus på valet av diagramtyp. Rekommendationerna
nedan bygger på publicerade riktlinjer och tillämpas på de granskade vyerna. De tidigare
kodfynden följer längre ned som kompletterande underlag.

## Val av diagramtyp efter genomgång av best practices

| Befintlig vy | Föreslagen form | Bedömning |
| --- | --- | --- |
| Modellens variabelbetydelse som radiella strålar | Rangordnade horisontella staplar | Byt. Värden på en gemensam axel ger en direkt jämförelse av storlek och rangordning. |
| DrugComb-inlärningskurva som grupperade staplar | Två linjer med punkter mot numerisk träningsmängd | Byt. Ordningen och avstånden i träningsmängd ska synas, liksom platån och gapet mellan träning och test. |
| Yrkes- eller länsjämförelse mellan två perioder | Dumbbell/range plot med en rad per kategori | Lägg till för före/efter. Två punkter och sträckan mellan dem visar nivåerna och skillnaden samtidigt. Behåll förändringsstaplar om enbart förändringen ska rangordnas. |
| Modellträffsäkerhet mot baslinje eller KPI mot mål | Bullet-diagram med värde och referensmarkör | Använd vid en faktisk jämförelse. Referensen kan vara baslinje, tidigare period eller mål; kvalitetszoner är valfria och behöver sakligt stöd. |
| Röstfördelning som separat rangordning av ja/nej/avstod/frånvaro | 100 % staplade staplar per parti | Lägg till som sammansättningsöversikt. Behåll separata staplar eller punkter för exakta jämförelser av en svarstyp. |
| Överlappande tidsserier | Små separata linjegrafer, en per serie | Använd när läsaren ska följa varje trend. Behåll gemensam linjegraf när seriernas nivåer vid samma tidpunkt ska jämföras. |
| Träffsäkerhet per modell eller utskott med små skillnader | Rangordnat punktdiagram | Överväg byte från staplar. Punktposition kan visas på en avgränsad skala utan att stapellängd från en kapad nollpunkt förstorar skillnader. |
| Budgetskillnader per område | Nuvarande staplar kring noll | Behåll. Vattenfall behövs bara om bidragen ska förklara vägen från en startsumma till en slutsumma. |
| DrugComb-kalibrering | Nuvarande punktdiagram med diagonal | Behåll. Axlarna visar förutsagt och observerat värde direkt; diagonalen visar överensstämmelse. |
| Stor matris med många kategorier/år | Nuvarande heatmap | Behåll för att läsa mönster. För en enskild period och rangordning passar staplar eller punkter bättre. |
| Vävnadsandelar på kroppskartan | Rangordnade staplar som primär kvantitativ vy | Byt huvudvy om uppgiften är att jämföra andelar. Behåll kroppskartan för vävnadernas anatomiska placering. |

Underlaget för valen:

- [Naomi Robbins: Dot Plots: A Useful Alternative to Bar Charts](https://www.perceptualedge.com/articles/b-eye/dot_plots.pdf)
  beskriver hur punktdiagram kan göra jämförelser mindre täta och synliggöra små skillnader.
- [Datawrapper: How to create a range plot](https://www.datawrapper.de/academy/how-to-create-a-range-plot)
  rekommenderar sammanbundna punkter när gapet mellan två jämförbara värden är huvudfrågan.
- [Stephen Few: Bullet Graph Design Specification](https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf)
  definierar en kompakt linjär jämförelse av ett mått med exempelvis mål eller tidigare utfall.
- [ONS: Stacked bar charts](https://service-manual.ons.gov.uk/data-visualisation/chart-types/stacked-bar-charts)
  rekommenderar formen för sammansättning, men beskriver att segment i mitten saknar gemensam baslinje.
- [ONS: Line chart](https://service-manual.ons.gov.uk/data-visualisation/chart-types/line-chart)
  rekommenderar linjer för tidsutveckling och range plots eller staplar när endast två tidpunkter visas.
  Bytet för inlärningskurvan är vår tillämpning av principen om en ordnad numerisk axel.
- [Datawrapper: Small multiple line charts](https://www.datawrapper.de/blog/what-to-consider-when-creating-small-multiple-line-charts)
  skiljer mellan att läsa varje series trend och att jämföra seriernas nivåer vid en viss tidpunkt.

Idea: Prioritera diagrambyten efter jämförelseuppgiften: dumbbell för två perioder, bullet för KPI mot referens, linjer för inlärningskurvan och staplar för modellens variabelbetydelse.

## Konkreta fynd

| Prioritet | Plats | Fynd och föreslagen ändring |
| --- | --- | --- |
| Hög | `frontend/src/welfare/WelfareExplorer.tsx:175`, `:320` | Seriefärgen beror på index i urvalet. När en tidigare region tas bort byter efterföljande regioner index och färg. Knyt färgen till regionens identitet under jämförelsen. |
| Hög | `frontend/src/politik/dash/Heatmap.tsx:39`, `frontend/src/jobb/charts.tsx:175` | Färgskalan använder visade min- och maxvärden. Samma värde kan därför få olika nyans i olika urval. Visa färgnyckel och erbjud en fast skala för jämförelser. Även politikens `max` lämnar nedre gränsen beroende av urvalet. |
| Hög | `frontend/src/jobb/charts.tsx:117` | Varje minigraf har eget maximum. Det fungerar för att läsa den egna utvecklingen, men grafhöjder kan inte jämföras som volym. Skriv ”egen skala” och visa period; erbjud gemensam skala för nivåer eller index för relativ utveckling. |
| Hög | `frontend/src/jobb/charts.tsx:120` | Minigrafernas x-position bygger på radindex, inte datum. Om månader saknas får de kvarvarande observationerna jämna avstånd. Använd kalenderavstånd och visa luckor som saknade data. |
| Hög | `frontend/src/products/DrugCombReport.tsx:936` | Inlärningskurvan är grupperade staplar över träningsmängd. Två linjer på en numerisk x-axel gör platå och tränings-/testgap lättare att läsa. Behåll detta som en separat graf; tidsseriekomponenten kräver datum och passar inte direkt. |
| Medel | `frontend/src/politik/modell/ModellTheme.tsx:66` | Variabelbetydelse visas med strålbredd och opacitet. Rangordnade horisontella staplar gör storleksskillnader lättare att jämföra. Förklara att betydelse avser modellen, inte politisk påverkan eller orsak. |
| Medel | `frontend/src/charts/MultiLineChart.tsx:78`, `:314` | Slutetiketter finns för partiserier, men inte för vanliga regionserier. Lägg namn och senaste värde vid slutet även för regioner, med kollisionshantering och en enklare mobilvariant. |
| Medel | `frontend/src/charts/TimeSeriesChart.tsx:33` | Standardfärgen är hårdkodad blå, utanför sajtens tokens. Använd en befintlig datatoken eller accent för denna serie. |
| Medel | `frontend/src/politik/ThemeLayout.tsx:19`, `frontend/src/ui/dash/Dash.tsx:65` | KPI-modellerna är olika. Teman har bara värde och etikett, dashboarden även en not. Ett gemensamt format bör stödja enhet, period och referensvärde där sådana finns. |
| Medel | `frontend/src/politik/features/PollTrend.tsx:188`, `frontend/src/aiact/TimeSeries.tsx:125`, `frontend/src/jobs/ClusterMap.tsx:297` | Flera detaljinteraktioner bygger på pekare eller mus. Ge samma information via tangentbord och en tillgänglig tabell/lista. Den gemensamma `MultiLineChart` har redan tangentbordsnavigering att utgå från. |

## Färgschemat

Utgå från `frontend/src/tokens.css` och den fastställda riktningen i `docs/design-system.md`.

- Elfenben som huvudyta och mörk text för etiketter, axlar och värden.
- Oliv för den valda serien eller den observation analysen handlar om.
- Havre, pistage, gult och puder som lugna stödytor. För tunna linjer behövs kontroll av
  kontrast mot underlaget; en färg som fungerar som yta fungerar inte automatiskt som linje.
- Befintliga `--series-*` för kategorier som behöver särskiljas. Samma kategori behåller
  sin färg när urvalet ändras. Komplettera med namn, linjestil eller markör.
- Partifärger behålls för partier. En röstfördelning som färgas efter svarstyp behöver
  i stället identifiera partierna med etikett eller logotyp.
- En heatmap behöver en ordnad ljus-till-mörk-skala. En blandning av pasteller kodar
  kategorier och passar därför inte för stigande värden.
- Uppgång och nedgång visas med tecken och text. Fler jobbannonser, högre skatt och fler
  sjukfall har olika betydelse; färgen bör inte automatiskt kalla en uppgång bra.

ONS rekommenderar begränsat antal färger, tydlig kontrast och konsekvent färg per kategori:
[Using colours in charts](https://service-manual.ons.gov.uk/data-visualisation/colours/using-colours-in-charts).
Använd riktlinjerna tillsammans med sajtens befintliga palett.

## Graftyp efter fråga

| Vy eller analys | Rekommenderad form | Skäl och villkor |
| --- | --- | --- |
| En KPI för senaste läget | Stort värde, enhet, period och jämförelse | Ett fristående antal behöver inte en graf. Lägg till en liten trend om historik finns. |
| KPI jämfört med ett verkligt mål | Horisontell målstapel med målmarkör | Målet och avståndet blir synliga. Skapa inga mål eller statusgränser utan stöd i data. |
| Två mättillfällen för flera kategorier | Två sammanbundna punkter per rad | Både tidigare och aktuellt värde syns. Lämpligt för exempelvis före/efter per yrke eller län. |
| Yrken, teknik, skatter och budgetområden | Behåll rangordnade staplar | Långa namn och exakta värden passar den befintliga `RankBars`. Använd samma skala där jämförelser ska göras. |
| Budgetavvikelser mot regeringen | Behåll staplar kring noll | Tydlig form för mer/mindre per område. Vattenfall passar först när startsumma, bidrag och slutsumma är själva frågan. |
| Röstfördelning per parti | 100 % staplade horisontella staplar som översikt | Visar ja, nej, avstod och frånvaro samtidigt. Behåll dagens separata rangordning när frågan gäller en svarstyp. |
| Partisympatier och mandathistorik | Behåll linjer | Tid är huvudfrågan. Direktetiketter, vald serie och nedtonade övriga hjälper; flera paneler passar när linjerna blir svåra att följa. |
| Annonser per månad | Behåll månadsstaplar | Varje månad är ett separat flöde. Märk senaste ofullständiga månaden och jämför samma månader mellan år. |
| Jobbområden över tid | Små linjegrafer | Behåll panelerna, men skilj mellan egen trend, gemensam volymskala och ett tydligt angivet basindex. |
| Länens välfärdsutveckling | Behåll små grafer med gemensam skala | `CountyMultiples` har redan en gemensam skala och en befolkningsviktad jämförelselinje. Lyft senaste värde, avvikelse och referensens namn. |
| Många partier/år/kategorier samtidigt | Behåll heatmap | Bra för mönster. Lägg skalnyckel, fasta jämförelsegränser och tydliga markeringar för saknade värden. |
| AI Act, politiska omnämnanden och jobbomnämnanden | Behåll separata tidsserier med gemensam tidsaxel | Måtten har olika nämnare. Visa andel tillsammans med antal träffar och totalantal, samt vilken utjämning som används. Milstolpar ger tidskontext, inte bevis för orsak. |
| Modellträffsäkerhet mot baslinje | Värde och förbättring i procentenheter; stapel med referensmarkör | En hög träffsäkerhet behöver bedömas mot en enkel baslinje och testmängdens storlek. |
| DrugComb-kalibrering | Behåll punktdiagram med diagonal | Förutsagt mot observerat framgår direkt. Den extra decilvyn med grupperade staplar kan göras till en detaljtabell eller avvikelsegraf för att minska upprepning. |
| DrugComb-inlärning | Två linjer mot träningsmängd | Visar hur testresultat och träningsresultat utvecklas. Förklara vad gapet mäter. |
| DrugComb-anrikning bland topprankade par | Punkt- eller linjegraf med baslinje | Topprocenten är numerisk; en sådan axel visar avstånd mellan urvalsstorlekarna. Staplar fungerar om varje urval behandlas som ett separat beslut. |
| DrugComb-vävnader på kroppskartan | Behåll karta som ingång, komplettera med rangordning | Läget visar vävnad, men cirkelstorlek och bågar är svårare att jämföra än staplar. Rangordna mätantal och synergiandel i separata mått. |
| Symbol-, filosofi-, jobb- och läkemedelskluster | Behåll projektion för utforskning, komplettera med lista | Kartan visar närhet i representationen. Visa klusterstorlek, representativa exempel och kvalitetsmått bredvid; använd inte kartavstånd som KPI. |
| Concept Journey och relationer mellan begrepp | Behåll en vald resa och filtrerbara relationer | Tydliggör vad varje relation betyder och ge textbelägg. Ett helt nätverk passar som fördjupning. |
| Datakvalitet och analytisk validitet | Behåll statusmatris, ord och symboler | Godkänd, varning och ej mätt är olika tillstånd. Visa kontrollens resultat och skäl, utan att slå ihop allt till en procentsiffra. |
| Flöden, beslutsträd och datamodeller | Behåll process-/träd-/schemavyer | Det är samband och ordning som ska läsas. Visa en huvudväg först, med tekniska detaljer i fördjupningen. |

`GaugeCard` finns i komponentbiblioteket men har inga funna anrop i den aktuella frontendkoden.
Den är en segmenterad halvring som visar sammansättning, inte ett målvärde. Inför den inte
som standard för KPI:er; använd en målmarkör när uppgiften är att jämföra utfall mot mål.

## Analys nära grafen

Låt varje huvudgraf ge läsaren en fråga, mått/enhet, period, jämförelse och en kort tolkning.
`Feature` och `ThemeLayout` har redan mycket av denna struktur. Återanvänd den i specialvyer.

Visa nämnaren för andelar och skilj procent från procentenheter. För tillväxt behöver både
föregående och aktuellt antal vara tillgängliga, så att en liten bas inte döljs bakom en stor
procentuell förändring. Jobbens yrkesvy gör redan jämförelsen med samma månader föregående år.

Visa saknade värden som ”saknas”, aldrig som noll. Linjer bör inte förbinda observationer över
en lucka utan förklaring. Osäkerhetsband ska beskrivas efter vad de faktiskt representerar:
kalibreringens kvartilspann är inte ett konfidensintervall.

Flytta en kort begränsning nära slutsatsen när den påverkar läsningen, exempelvis underlagets
storlek, olika mätperioder eller att textlikhet inte bevisar idéöverföring. Metoddetaljer kan
fortsätta ligga i fördjupningen.

## Föreslagen ordning

1. Rätta färgidentitet och tydliggör skalor, perioder och saknade observationer.
2. Samordna KPI-format och slutetiketter; behåll grafer som redan passar frågan.
3. Byt modellstrålar till staplar och inlärningsstaplar till linjer.
4. Lägg till röstfördelningsöversikt och rangordnade komplement till kartorna.
5. Kontrollera verkliga vyer på mobil och desktop, kontrast på respektive underlag och
   att samma detaljer går att nå med mus, touch och tangentbord.

Finding: Välfärdsutforskarens seriefärger beror på urvalsindex och kan ändras när en tidigare region tas bort.
Finding: Heatmaps och jobbens minigrafer använder urvalsberoende eller separata skalor som behöver förklaras vid jämförelse.
Idea: Använd den befintliga paletten med stabil kategoriidentitet, en tydlig fokusfärg och en separat ordnad skala för heatmaps.
Idea: Byt modellens variabelstrålar till rangordnade staplar och DrugComb-inlärningskurvan till linjer mot träningsmängd.
Idea: Samordna KPI-presentation med enhet, period och jämförelse; använd målmarkör endast där ett faktiskt mål finns.
