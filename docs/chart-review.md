# Diagram och KPI-vyer: öppna fynd och diagramval

Tre genomgångar från 11–12 oktober 2026 är sammanförda här: alla grafer och KPI-vyer,
politikens vyer samt Labour Market, Wellbeing och EU AI Act. Kodfynden kontrollerades på nytt
mot arbetskopian den 13 oktober 2026. Diagramförslagen längre ned har inte stämts av mot de
nya rapportsidorna (`JobsReport`, `WelfareReport`, `AiActReport`), som byggdes efter
genomgångarna. Källdatasetens riktighet ingick inte i någon av genomgångarna.

Färger och tokens bestäms i [design-system.md](design-system.md) och
`frontend/src/tokens.css`. Den här filen gäller diagramform, skalor och läsbarhet.

## Öppna kodfynd

Kontrollerade i koden 13 oktober 2026.

| Plats | Fynd | Föreslagen ändring |
| --- | --- | --- |
| `frontend/src/politik/dash/Heatmap.tsx:39` | Färgskalan går mellan visat lägsta och högsta värde. Samma värde får olika nyans i olika urval. | Visa färgnyckel och erbjud en fast skala för jämförelser. |
| `frontend/src/jobb/charts.tsx:117` | Varje minigraf har eget maximum. Höjder kan inte jämföras som volym. | Skriv ut "egen skala" och period. Erbjud gemensam skala för nivåer eller index för relativ utveckling. |
| `frontend/src/jobb/charts.tsx:123` | X-positionen bygger på radindex. Saknade månader ger jämna avstånd mellan de kvarvarande. | Använd kalenderavstånd och visa luckor som saknade data. |
| `frontend/src/welfare/CountyMultiples.tsx:107` | Saknade år filtreras bort innan linjen ritas, så linjen förbinder åren på var sida om luckan. | Bryt linjen vid luckor. |
| `frontend/src/products/DrugCombReport.tsx:936` | Inlärningskurvan ritas som grupperade staplar per träningsmängd. | Två linjer på en numerisk x-axel visar platå och gapet mellan träning och test. |
| `frontend/src/charts/TimeSeriesChart.tsx:33` | Standardfärgen `#4e79a7` ligger utanför sajtens tokens. | Använd en datatoken eller accenten. |
| `frontend/src/charts/MultiLineChart.tsx:78` | Slutetiketter finns bara för partiserier. | Lägg namn och senaste värde vid linjens slut även för regioner, med kollisionshantering. |
| `frontend/src/politik/ThemeLayout.tsx` | Teman skickar in `kpis`, men raden renderas inte. `frontend/tests/politik.spec.ts:22` kräver att `.theme-kpis` saknas, så det är ett val och inget fel. Koden som räknar måtten finns kvar. | Bestäm om måtten ska visas eller om beräkningen ska tas bort. |
| `frontend/src/politik/features/PollTrend.tsx:191`, `frontend/src/aiact/TimeSeries.tsx:125`, `frontend/src/jobs/ClusterMap.tsx:297` | Detaljvärden nås med pekare eller mus. | Ge samma information via tangentbord och en tabell eller lista. `MultiLineChart` har redan tangentbordsnavigering. |

Två fynd är ändrade sedan genomgångarna och har inte kontrollerats i webbläsare:

- Röstmodellens variabelbetydelse ritas nu med `RankBars` och träffsäkerheten som bullet mot
  majoritetsbaslinjen (`frontend/src/politik/modell/ModellTheme.tsx`).
- Välfärdsutforskarens seriefärg följer regionens plats i urvalet
  (`frontend/src/welfare/WelfareExplorer.tsx:175`). Genomgången fann att färgen kunde byta när
  en tidigare region togs bort. Koden har sedan dess en kommentar om att borttagning inte
  ändrar ordningen.

## Diagramform efter fråga

| Fråga | Form | Villkor |
| --- | --- | --- |
| Ett tal för senaste läget | Stort värde med enhet, period och jämförelse | Ett fristående antal behöver ingen graf. |
| Ett mått mot en verklig referens | Bullet: värde med referensmarkör | Referensen är en baslinje, en tidigare period eller ett mål. Hitta inte på mål eller statuszoner. |
| Två mättillfällen för flera kategorier | Dumbbell: två sammanbundna punkter per rad | Behåll staplar kring noll när bara förändringen ska rangordnas. Jämför inte delår mot helår. |
| Rangordning av kategorier | Horisontella staplar (`RankBars`) | Samma skala där raderna ska jämföras. |
| Små skillnader mellan kategorier | Rangordnat punktdiagram | Punkter tål en avgränsad skala. Staplar från en kapad nollpunkt förstorar skillnaden. |
| Sammansättning av en total | 100 % staplade staplar | Bara när delarna summerar. Kategorier som kan överlappa, som teknikomnämnanden, får separata staplar. |
| Utveckling över tid | Linjer | Direktetiketter och en vald serie. |
| Många överlappande tidsserier | Små separata linjegrafer | När läsaren ska följa varje trend. En gemensam graf passar när nivåerna ska jämföras vid samma tidpunkt. |
| Mönster över många kategorier och år | Heatmap | Ordnad skala från ljus till mörk, färgnyckel, markering för saknade värden. |
| Avvikelse från en referens | Staplar kring noll | Vattenfall först när vägen från startsumma till slutsumma är frågan. |
| Förutsagt mot observerat | Punktdiagram med diagonal | Kalibreringens kvartilspann är inget konfidensintervall. |
| Närhet i en representation | Projektion, med en lista bredvid | Visa klusterstorlek, exempel och kvalitetsmått. Kartavstånd är ingen KPI. |

Nära varje huvudgraf: frågan, måttet och enheten, perioden, jämförelsen och en kort tolkning.
Visa nämnaren för andelar och skilj procent från procentenheter. Saknade värden skrivs
"saknas", aldrig noll. En uppgång färgas inte som bra: fler jobbannonser, högre skatt och fler
sjukfall betyder olika saker.

## Förslag per produkt

Förslagen var inte genomförda 12 oktober 2026.

### Politik

- Väljare: föregående mot senaste mätning som dumbbell per parti. Senaste stöd som punkter med
  osäkerhetsintervall.
- Röster: 100 % staplade staplar för ja, nej, avstod och frånvaro per parti som översikt.
  Behåll heatmap för alla partipar.
- Skatter: Sverige mot jämförelsesnittet som dumbbell, gärna en rad per skattetyp. I det
  granskade lokala urvalet var Sveriges skatter 41,4 % av BNP, plats 8 av 36, 7,4
  procentenheter över snittet, och Danmark högst med 45,2 %.
- Partiledardebatter: rangordnade staplar för repliker per parti. Behåll heatmap för vem som
  replikerar på vem.
- Utredningar: ledtid till lag som punktdiagram eller boxplot när observationerna finns. En
  ensam median säger mindre.
- Röstmodell: i det granskade urvalet var träffsäkerheten 68,9 %, majoritetsbaslinjen 56,0 %
  och ROC AUC 0,769. ROC AUC har en annan skala och visas separat.

### Labour Market

- Yrken och län mellan två perioder: dumbbell med föregående och aktuellt antal på samma rad.
- Villkor: skilj anställningsform, arbetstid och erfarenhet åt. De har olika nämnare.
- IT-rapporten visade fyra nyckeltal i det lokala urvalet: 35 726 annonser, 2 862 unika
  arbetsgivare, −52,6 % utvecklarannonser och 4,1 % juniora annonser. Visa
  utvecklarförändringen med basår och jämförelseår som sammanbundna punkter.
- Klusterkartan: behåll den för utforskning. Rangordnade staplar för annonser per kluster ger
  den kvantitativa jämförelsen.

### Wellbeing

- Regionala skillnader: punktdiagram per indikator med samma länsordning mellan panelerna, och
  osäkerhetsintervall där de finns.
- Förändring mellan två år: dumbbell per län och indikator.
- Mot länssnittet: avvikelse kring noll.
- Lägg inte värden från olika perioder i en gemensam rangordning. Mått med olika enheter får
  egna skalor.

### EU AI Act

- Artikelstatus: segmenterad stapel för helt gällande, delvis gällande och kommande artiklar,
  en stapel per kapitel vid jämförelse. Den visar modellens statusfördelning, ingen
  organisations efterlevnad.
- Roller och skyldigheter: rangordnade staplar för antal skyldigheter. En skyldighet kan
  beröra flera roller, så rollantalen summeras inte till 100 %.
- Tidslinjen: egna rader för tillämpning, frister och dokument när händelser sammanfaller.
- Undvik mätare som antyder "procent färdig lag" eller "procent efterlevnad".

### Drug Synergy Lab

- Anrikning bland topprankade par: punkter eller linje med baslinje på en numerisk axel.
- Vävnader: behåll kroppskartan som ingång och lägg rangordnade staplar för mätantal och
  synergiandel bredvid.

## Underlag

- [Naomi Robbins: Dot Plots](https://www.perceptualedge.com/articles/b-eye/dot_plots.pdf)
- [Datawrapper: range plots](https://www.datawrapper.de/academy/how-to-create-a-range-plot)
- [Stephen Few: Bullet Graph Design Specification](https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf)
- [ONS: stacked bar charts](https://service-manual.ons.gov.uk/data-visualisation/chart-types/stacked-bar-charts)
- [ONS: line chart](https://service-manual.ons.gov.uk/data-visualisation/chart-types/line-chart)
- [ONS: using colours in charts](https://service-manual.ons.gov.uk/data-visualisation/colours/using-colours-in-charts)
- [Datawrapper: small multiple line charts](https://www.datawrapper.de/blog/what-to-consider-when-creating-small-multiple-line-charts)
