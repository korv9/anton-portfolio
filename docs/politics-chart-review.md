# Politikgrafer och KPI:er

Granskat den 12 oktober 2026 i aktuell kod och den lokala utvecklingsvyn.
Skattevyns KPI-rad har även kontrollerats visuellt vid 1440 och 390 pixlars bredd.
Visade tal nedan beskriver lokala urval, inte en separat verifiering av källdatan.

## Hur KPI:erna faktiskt visas

Synliga KPI-rader har stora, mörka värden på elfenbensbakgrund, med etikett ovanför
och en mindre not under. De är öppna textrader utan inramade kort, diagram eller mätare.
På desktop ligger skattevyns fyra mått bredvid varandra. På mobil ligger de i en kolumn.
Modellvyn använder en separat lista med etikett och värde.

I skattevyn visar det granskade urvalet:

| Mått | Värde |
| --- | --- |
| Sverige, alla skatter | 41,4 % av BNP |
| Placering | 8 / 36, högst först |
| Sverige mot snittet | +7,4 procentenheter av BNP |
| Högst | Danmark, 45,2 % |

Väljar-, röst- och taltemat beräknar också KPI:er, men `ThemeLayout` renderar inte
`props.kpis`. Testet `frontend/tests/politik.spec.ts:25` kräver att `.theme-kpis` saknas.
Det är därför inget belägg för ett oavsiktligt UI-fel. Koden som beräknar måtten finns kvar.
Budgetens detaljtema använder samma komponent, medan huvudvyn använder `BudgetBoard`
med en synlig KPI-rad.

## Vilken form passar varje politikvy?

| Vy | Nuvarande KPI:er eller mått | Rekommenderad visuell form |
| --- | --- | --- |
| Partier | Riksdagsmandat, valandel, kommunmandat, antal kommuner, antal kommuner där partiet är störst | Behåll fristående antal. För mandat och valandel före/efter: två sammanbundna punkter. För representation i kommuner: horisontell andelsstapel. |
| Väljare | Beräknar största rörelse sedan föregående mätning och största partiets felmarginal; raden visas inte | Senaste stöd: rangordnade staplar eller punkter med osäkerhetsintervall. Föregående mot senaste stöd: dumbbell per parti. Historik: behåll linjer. |
| Röster | Beräknar partiparet som röstar mest respektive minst lika; raden visas inte | Alla partipar: heatmap. Ett valt partis likhet med övriga: rangordnade staplar eller punkter. Ja/nej/avstod/frånvaro: 100 % staplade staplar för sammansättning. |
| Budget | Huvudvyn visar partiet med högsta och lägsta nettoskillnad | Gör jämförelsen mellan alla budgetalternativ till staplar kring noll. Behåll divergerande staplar per område. Vattenfall passar bara om nettot ska förklaras med delbidragen. |
| Skatter | Sverige, placering, avvikelse från snitt och högsta landet | Dumbbell för Sverige mot jämförelsesnitt, gärna en rad per skattetyp. Behåll landrangordningen som punkter och historiken som linjer. Placering fungerar som ett fristående tal. |
| Tal | Beräknar antal lästa tal samt högsta och lägsta ämnesandel; raden visas inte | Behåll rangordnade staplar för senaste riksmötet och linjer för utveckling. Små separata linjediagram passar om partiernas linjer överlappar mycket. Antal lästa tal behöver ingen egen graf. |
| Sakdebatter | Antal analyserade debatter, yttranden och största ämnesområde; debattlistan har även antal beslutskopplingar | Behåll antal som tal. För största ämnesområde: andelsstapel. Beslutskopplade debatter kan visas som andel av urvalet i en horisontell stapel. |
| Partiledardebatter | Replikerar mest och får flest repliker | Rangordnade staplar visar hela jämförelsen bättre än två vinnarsiffror. Behåll heatmap när frågan är vem som replikerar på vem. |
| Utredningar | Publicerade hittills, föregående helår, andel citerade i proposition samt median till lag | Andelen kan visas med andelsstapel. För ledtid är punktdiagram eller boxplot mer informativt än en ensam median, om observationerna finns. Behåll årsvolymer som staplar. Jämför inte delår mot helår med ett före/efter-diagram. |
| Nyheter | Antal den här veckan och mest omnämnda parti senaste 30 dagar | Veckovolym: små tidsstaplar om historik finns. Partiomnämnanden: rangordnade staplar över alla partier. |
| Röstmodell | Testträffsäkerhet, majoritetsbaslinje, ROC AUC, tränings- och testantal | Bullet-diagram för träffsäkerhet med baslinje som referensmarkör. Rangordnade punkter för utskott. Byt variabelbetydelsens radiella strålar till horisontella staplar. |

I modellvyns granskade urval var träffsäkerheten 68,9 %, majoritetsbaslinjen 56,0 %
och ROC AUC 0,769. Ett bullet-diagram gör den ungefärliga förbättringen på 12,9
procentenheter synlig direkt. ROC AUC har en annan skala och ska visas separat.

## Ett problem med vad en KPI jämför

`frontend/src/politik/debatter/Partiledardebatter.tsx:103` beräknar mottagna repliker
endast från partier i `present`, alltså det valda urvalet. Med ett enda valt parti kan
”Får flest repliker” därför bli noll trots att andra partier har replikerat på det.
Avgivna repliker summeras däremot över alla mottagare. Måtten jämför olika populationer.
Det behöver avgöras om jämförelsen ska avse hela debatten eller bara de valda partierna.
En annan diagramtyp ändrar inte detta beräkningsproblem.

## Best practices som stöder förslagen

- [Datawrapper: range plots](https://www.datawrapper.de/academy/how-to-create-a-range-plot)
  använder två sammanbundna punkter när skillnaden mellan jämförbara värden ska läsas.
  Det är grunden för förslagen om väljarrörelser, före/efter-mandat och Sverige mot snittet.
- [Stephen Few: Bullet Graph Design Specification](https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf)
  definierar en kompakt jämförelse mellan ett mått och mål, tidigare utfall eller annan referens.
  För röstmodellen är majoritetsbaslinjen en faktisk referens; inget nytt mål behöver införas.
- [ONS: stacked bar charts](https://service-manual.ons.gov.uk/data-visualisation/chart-types/stacked-bar-charts)
  rekommenderar 100 % staplade staplar för sammansättning. Mittsegment saknar gemensam
  baslinje, så en svarstyp jämförs mer exakt med separata staplar eller punkter.

Förslagen är inte genomförda. De viktigaste bytena är modellmått till bullet-diagram,
skattejämförelser till dumbbell och repliksiffror till rangordnade staplar.

Finding: Politikens ThemeLayout visar inte de KPI:er som väljare-, röster-, tal- och budgetdetaljtemat skickar in; befintligt test kräver frånvaron av KPI-raden.
Finding: KPI:n för mottagna repliker räknar bara avsändare i partiurvalet, medan avgivna repliker summeras över alla mottagare.
Idea: Visa röstmodellens träffsäkerhet mot majoritetsbaslinjen som bullet-diagram och Sveriges skattenivå mot snittet som dumbbell-diagram.
