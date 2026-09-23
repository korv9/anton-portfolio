# Rapportformat — skiss

Sidan är upplagd som ett litet digitalt rapportarkiv. Rekryterarinformationen finns kvar, men rapporterna kommer först.

```text
┌────────────────────────────────────────────────────────────┐
│ AE  Anton Ernstsson           Rapporter  Projektlogg  CV ↓ │
├────────────────────────────────────────────────────────────┤
│ Jag undersöker saker     ┌───────────────────────────────┐ │
│ med data.                │ RAPPORTINDEX                  │ │
│                          │ R01 Partiledardebatterna 〰〰  │ │
│ Kort introduktion        │ R02 Techjobben          ﹨﹨  │ │
│                          └───────────────────────────────┘ │
├────────────────────────────────────────────────────────────┤
│ R01  FRÅGA + KÄLLA + PERIOD + ENHET                        │
│ [nyckeltal] [nyckeltal] [nyckeltal] [nyckeltal]            │
│ ┌────────────────────────────────────┬───────────────────┐ │
│ │ filter  filter                     │ VALT SEGMENT      │ │
│ │                                    │ ämne, talare      │ │
│ │        interaktiv huvudgraf        │ och källutdrag    │ │
│ └────────────────────────────────────┴───────────────────┘ │
│ Observation                         stödgraf                │
│ ▾ Metod och begränsningar                                   │
├────────────────────────────────────────────────────────────┤
│ R02  samma rapportgrammatik, ny data och nya kontroller     │
├────────────────────────────────────────────────────────────┤
│ Projektlogg                                      Om Anton   │
└────────────────────────────────────────────────────────────┘
```

## Visuell riktning

- Ljus rapportyta, tunna linjer och tät informationshierarki inspirerad av analysverktyg.
- Stora frågor som rubriker, små käll- och metodetiketter, få färger med tydlig funktion.
- Samma ordning i varje rapport: fråga, metadata, mått, graf, tolkning, metod.
- Graferna ska kunna förstås utan hover; interaktion ger extra detalj.
- Mobilvyn staplar rapporten i läsordning och behåller alla definitioner.

## Nästa naturliga rapportidéer

1. Följ hur ett valt debattämne växer och minskar mellan riksmöten.
2. Jämför partiernas ordandelar inom ett ämne utan att tolka dem som ståndpunkter.
3. Visa teknikandelar per år för dataannonser, med volymen bredvid så att små urval syns.

## Budget och debatt, tillagt i rapport 1

Fem samordnade vyer använder de publika exporterna `budgets/summary.json` och `budgets/speech-alignment.json`: budgetandel mot nyckelordsandel, största skillnader i procentenheter, partiernas avvikelse från regeringens förslag, utveckling för ett valt utgiftsområde och korrelation per tillgängligt riksmöte. Alla jämförbara partier för valt riksmöte visas från början. Partiväljaren ger en detaljvy, och valt utgiftsområde följer med mellan diagrammen. Partisammansättningen varierar mellan år eftersom bara partier med maskinläsbara budgetförslag ingår.

Nyckelordsandelen bygger på träffar i ett fast lexikon, inte på semantisk tolkning av hela anföranden. Den separata exporten `speech-keywords-all-parties.json` beräknas direkt från analysdatabasens kvalificerade anföranden, ordträffar och `budget_area_keywords`, så att alla åtta partiers debattandelar kan visas för valt utgiftsområde även utan separat budgetmotion. Ett kontrollsteg jämförde exporten mot den befintliga alignment-exporten; alla fullständiga budgetår stämde. Alla åtta partier har debattanföranden under de tolv undersökta riksmötena, men FiU1-tabellen har endast separata budgetförslag för vissa partier; `GOV` är ett gemensamt regeringsförslag och får inte kopieras till enskilda partier. Täckningstabellen visar varje parti och riksmöte, inklusive luckor. Åren 2014/15, 2015/16, 2020/21 och 2021/22 saknar maskinläst budgettabell. Importerna för 2017/18 och 2018/19 saknar flera utgiftsområden och används därför inte i andelsgraferna. Sex riksmöten har fullständiga ramar för aktörerna som faktiskt finns i FiU1-exporten. En gemensam UMAP för debatt- och budgettexter kräver nya textembeddings; en ekonomisk UMAP kräver modellering av budgetvektorer. Ingendera finns i nuvarande export.
