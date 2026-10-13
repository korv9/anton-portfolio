# Labour Market, Wellbeing och EU AI Act: diagramval

Granskat den 12 oktober 2026 i aktuell frontendkod och lokala webbvyer. Bedömningen gäller
vilka diagram som passar jämförelserna. Inga diagram har ändrats. Källdatasetens riktighet
och AI-förordningens rättsliga innehåll har inte verifierats i denna genomgång.

Projektgrafen användes först. Den saknar namnet JobMarketProduct; den aktuella produkten
heter JobsProduct. Koden har verifierats separat från grafens äldre index.

## Labour Market

Temavyerna beräknar KPI:er men visar ingen KPI-rad, eftersom de använder ThemeLayout.
Små grafer per område visar värde och förändring i sina bildtexter. IT-rapporten har däremot
fyra synliga nyckeltal: annonser i urvalet, unika arbetsgivare, förändring i utvecklarannonser
och andel juniora annonser. I det lokala urvalet var de 35 726, 2 862, −52,6 % och 4,1 %.

Föreslagna ändringar:

- Yrken och län mellan två perioder: lägg till dumbbell-diagram med föregående och aktuellt
  antal på samma rad. Behåll staplar kring noll när uppgiften enbart är att rangordna tillväxt.
- Villkor: ersätt den gemensamma listan av anställningsform, arbetstid och erfarenhet med
  separata diagram. Använd 100 % staplade staplar för anställningsform respektive arbetstid
  när flera år eller yrkesområden jämförs. Erfarenhetskrav får en separat andelsstapel.
  Teknikomnämnanden ska fortsatt vara separata staplar eftersom samma annons kan nämna flera tekniker.
- IT-rapportens utvecklarförändring: visa basår och jämförelseår med sammanbundna punkter.
  Juniorandelen kan visas med en enkel andelsstapel. Annons- och arbetsgivarantal fungerar som tal.
- Områdenas minigrafer: erbjud ett tydligt basindex för relativ utveckling. Gemensam skala
  passar för att jämföra volym; dagens egna skalor passar för att läsa varje områdes trend.
- Års-/områdesmatris: behåll heatmap för mönster över flera år, använd rangordnade staplar
  när ett enda år är valt.
- Klusterkartan: behåll för textlikhet och utforskning. Rangordnade staplar för antal annonser
  per kluster ger en bättre kvantitativ jämförelse än kartans punktmoln.

Behåll månadsstaplarna och de befintliga yrkesrangordningarna. Lägg inte till nya grafslag
enbart för att variera utseendet.

Kodfynd:

- `frontend/src/jobb/themes.tsx:591` kombinerar villkor med olika nämnare i samma lista.
- `frontend/src/jobb/charts.tsx:117` ger varje minigraf en egen y-skala.
- `frontend/src/jobb/charts.tsx:120` fördelar månader efter radindex; saknade månader
  behöver kalenderavstånd, så att grafen inte döljer tidsluckor.

## Wellbeing

Det finns ingen gemensam KPI-rad. Arbetslöshet och sjukfrånvaro visas som 21 små tidsserier
med ett värde per län och gemensam skala. Utforskaren visar upp till fem regioners linjer
och en tabell med senaste värde och eventuellt konfidensintervall. Regionvyn jämför fyra
mått i en tabell med staplar inne i cellerna.

Föreslagna ändringar:

- Regionala skillnader: byt cellstaplarna till punktdiagram per indikator, med samma länordning
  mellan panelerna. Använd osäkerhetsintervall där de finns, särskilt för arbetslöshet.
- Senaste värde i utforskaren: erbjud en punkt-/intervallvy för att jämföra regioner direkt.
  Värden från olika perioder ska inte läggas i en gemensam rangordning som om perioden var densamma.
- Förändring mellan två år: använd dumbbell-diagram per län och indikator.
- För många överlappande regionlinjer: använd separata små linjegrafer. Behåll den gemensamma
  linjegrafen när huvudfrågan är vilken region som ligger högst vid samma tidpunkt.
- Jämförelse mot länssnittet: en avvikelsegraf kring noll kan visa vilka län som ligger
  över eller under referensen tydligare än att läsaren jämför två linjer i varje panel.

Behåll CountyMultiples som trendvy. Mått med olika enheter ska ha egna skalor; ett gemensamt
radardiagram för arbetslöshet, sjukpenningdagar och mående skulle göra jämförelsen svårare.

Kodfynd:

- `frontend/src/welfare/WelfarePage.tsx:184` normaliserar cellstaplarna mellan lägsta och
  högsta värdet och ger dem dessutom en minsta bredd. Stapellängden motsvarar inte storleken
  från noll. Punkter på en synlig skala passar denna avgränsade jämförelse bättre.
- `frontend/src/welfare/WelfareExplorer.tsx:175` kopplar seriefärg till urvalsindex.
  Färgen kan bytas när en tidigare vald region tas bort.
- `frontend/src/welfare/CountyMultiples.tsx:108` filtrerar bort saknade år innan linjen ritas;
  kvarvarande år förbinds över luckorna. Luckorna bör bryta linjen.

## EU AI Act

Huvudöversikten är en projektingång. Undervyerna visar framför allt datum, status,
antal skyldigheter per roll och andelar AI-omnämnanden. De har ingen gemensam numerisk
KPI-rad. Artikelstatus anges som antal i en mening och som statusmarkering vid varje artikel.

Föreslagna ändringar:

- Artikelstatus: visa helt gällande, delvis gällande och kommande artiklar som en segmenterad
  statusstapel. För jämförelse mellan kapitel passar en stapel per kapitel. Det visar modellens
  statusfördelning, inte organisationens efterlevnad.
- Roller och skyldigheter: komplettera rollkorten med rangordnade staplar för antal skyldigheter.
  En roll–skyldighetsmatris med markeringar passar när frågan är vilka skyldigheter roller delar.
  En skyldighet kan beröra flera roller, så rollantal ska inte summeras till en 100 %-fördelning.
- Datum: fördela tidslinjens markeringar på rader för tillämpning, frister och dokument
  när många händelser sammanfaller. Behåll verkliga datum på en gemensam tidsaxel.
- Jobb- och politikomnämnanden: använd dumbbell för jämförelse av samma mått mellan två
  perioder. Behåll linjer när hela utvecklingen ska läsas.
- Begrepp per parti: behåll heatmap som översikt, använd rangordnade staplar när ett begrepp
  eller en ordgrupp väljs. Ordgrupper kan överlappa och ska inte bli en 100 %-fördelning.
- Signaltidslinjen: behåll separata paneler med gemensam tidsaxel. Lägg till indexerade linjer
  bara om frågan är relativ förändring inom varje serie; använd en gemensam, icke-noll basperiod.

Behåll balansstaplarna kring noll för ordpar i inramningsvyn. De visar redan riktning och
storlek för det beräknade balansmåttet. Undvik mätare som skulle antyda ”procent färdig lag”
eller ”procent efterlevnad” utifrån antal artiklar eller passerade datum.

## Underlag för diagramval

- [Datawrapper: range plots](https://www.datawrapper.de/academy/how-to-create-a-range-plot)
  för skillnader mellan två jämförbara värden.
- [ONS: stacked bar charts](https://service-manual.ons.gov.uk/data-visualisation/chart-types/stacked-bar-charts)
  för sammansättning av en total. Överlappande kategorier passar inte denna form.
- [Datawrapper: small multiple line charts](https://www.datawrapper.de/blog/what-to-consider-when-creating-small-multiple-line-charts)
  för separata trender och avvägningen mot jämförelser vid samma tidpunkt.
- [Naomi Robbins: Dot Plots](https://www.perceptualedge.com/articles/b-eye/dot_plots.pdf)
  för kategorijämförelser på en gemensam skala, inklusive avgränsade skalor där staplar missleder.

Finding: Labour Markets temavyer visar inga KPI-rader; IT-rapporten visar fyra nyckeltal, medan Wellbeing främst visar senaste värden i diagram och tabeller.
Finding: Wellbeing-regiontabellens cellstaplar visar min–max-normaliserade skillnader snarare än värdenas storlek från noll.
Idea: Separera Labour Markets villkorsmått, använd punkt-/intervallgraf för Wellbeing-regioner och visa AI Act-artiklarnas status i segmenterade staplar.
