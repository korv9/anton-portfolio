# Granskning av examensarbetets portfolioinnehåll

Granskat 2026-10-11. Alla 45 PDF-sidor har lästs. Sidhänvisningarna nedan avser
PDF-sidor, inte innehållsförteckningens förskjutna kapitelhänvisningar.
Källa: `platform/products/thesis/private/Anton_Ernstsson_Examensarbete.pdf`.
Original, sidvis textextraktion och granskningsbilder ligger kvar i den ignorerade
privata mappen. Rapporten återger aggregerade uppgifter, inga incidenttexter.
Kontrollen gäller dokumentets stöd för portfolioinnehållet; källdata och MLflow-loggar
har inte granskats och inga nya modeller har tränats.

## Verifierade uppgifter och användning

| Område                           | Underlag i arbetet                                                                                                                                                                                                                                                                               | PDF-sidor               | Ändring i portfolion                                                                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kontext och syfte                | Explorativ fallstudie av Fora AB:s Freshservice-incidenter. Serviceförfrågningar, förändringsärenden och externa system avgränsas bort.                                                                                                                                                          | 6-8, 11-13              | Fora AB ersätter Avtalat som studiens organisation. Inledningen förklarar problemet, Antons flöde och utredningsunderlaget.                                                           |
| Population och urval             | 21 633 incidentposter i kvalitetsanalysen; 19 847 unika incidenter efter NLP-rensning; 16 811 i slutlig `text_weighted`. Antalet varierar mellan textkonfigurationer.                                                                                                                            | 13, 18, 26-29           | Tre skilda antal med rätt nämnare. Arbetsflödets start visar den valda körningens 16 811, inte hela kvalitetsunderlaget.                                                              |
| Pipeline                         | Freshservice REST API, inkrementell inläsning, Bronze/Silver/Gold och stjärnschema i Azure Databricks. NLP läser en materialiserad Delta-tabell. MLflow loggar körningar.                                                                                                                        | 8-14                    | Teknisk fördjupning med faktisk pipeline.                                                                                                                                             |
| Datarensning och personuppgifter | Larm, testärenden, återkallade poster och dubbletter filtreras i NLP-spåret. Regex och Presidio 2.2.362 med spaCy 3.8.14, svenska och engelska modeller, maskerar personuppgifter lokalt.                                                                                                        | 17, 26-27               | Beskriver maskering och intern bearbetning utan att garantera fullständig anonymitet eller rättslig efterlevnad.                                                                      |
| Representation                   | Fem konfigurationer: `subject_clean`, `description_clean`, `subj_desc_combined`, `desc_boosted`, `text_weighted`. Modellen är `paraphrase-multilingual-mpnet-base-v2`, 768 dimensioner. Slutligt recept: ämne ×3, analys ×4, beskrivning ×1, högst 3 000 tecken; manuell expansion av 70 termer. | 13-15, 27-28            | Modell, fältvikter, teckengräns och domänordlista behålls. Konversationsfältets oklara roll anges.                                                                                    |
| Klustring                        | UMAP: 10 dimensioner för klustring, 2 för visning, `n_neighbors=30`, cosinusavstånd. HDBSCAN prövar minsta klusterstorlek 10/20/30/50, med halva värdet som `min_samples`. Vald konfiguration 30/15 ger 121 kluster.                                                                             | 14, 29, 37, 42          | Parametrar anges; kluster förklaras som grupper av liknande ärenden. Ingen ny punktkarta fabriceras från PDF-bilderna.                                                                |
| Jämförelse och utvärdering       | `text_weighted`: K-means, 73 kluster, silhuett 0,5342; HDBSCAN, 121 kluster, 0,7060. HDBSCAN lämnar 27,7 % som brus. Måttet avser UMAP-rymden.                                                                                                                                                   | 16, 28-29, 38-39, 42-43 | Cirka 32 % högre silhuett förklaras som geometrisk separation. HDBSCAN utvärderar endast 72,3 % av ärendena, K-means alla. Ingen generell kvalitets- eller nyttovinst på 32 % påstås. |
| Problemkopplingar                | 49 av 121 kluster innehåller minst ett länkat ärende. 72 saknar koppling och omfattar 5 605 ärenden. Tabell och sammanfattning anger 12 grupper med 650 ärenden för fortsatt utredning.                                                                                                          | 30, 32-33, 36-39        | Kandidater presenteras som ett brett utrymme med artefakter och ännu otolkade grupper. De är inte 72 bevisade eller lösta problem.                                                    |
| Dokumentation                    | Analysfältets fyllnadsgrad är 4,2 % i hela kvalitetsunderlaget; 11,7 % år 2025 och 13,3 % under delåret 2026. RCA för högprioriterade ärenden är ett separat mått.                                                                                                                               | 19-20, 24-25            | Det gamla påståendet om 12-13 % av samtliga ärenden ersätts. Dokumentationsbrister beskrivs tillsammans med metodbegränsningar.                                                       |
| Verksamhetsvalidering            | Befintliga länkar är glesa och tidsmässigt ojämna. Planerade intervjuer genomfördes inte. Studien gäller en organisation; framtida kvalitativ validering föreslås.                                                                                                                               | 12, 16-17, 38-40        | Behov av verksamhetsgranskning anges. Ingen uppmätt tidsbesparing, bevisad gemensam rotorsak eller automatisk problemlösning tillskrivs resultaten.                                   |

## Motsägelser och öppna begränsningar

- HDBSCAN-svepet: tabell 4.2.3 på s. 29 placerar `0,443` under brus och
  `27,7 %` under Davies-Bouldin för vald rad. Dessa kolumner kan inte användas som
  ett sammanhängande svepresultat. Brus 27,7 % stöds separat av tabell 4.2.4,
  diskussionen på s. 38 och figurhuvudet på s. 42.
- Domänexpansion: s. 15, 28 och 37 kallar ökningen i bästa klustrets
  PRB-kopplingsgrad från 36,1 % till 52,4 % isolerad. Tabell 4.2.2 visar dock olika
  populationer, 17 757 respektive 16 811, och olika K-means-antal, 60 respektive 81.
  Portfolion beskriver expansionen utan att tillskriva den en isolerad vinst på
  16 procentenheter. Bästa klustrets värde är inte hela modellens träffsäkerhet.
- Kandidater och artefakter: s. 32 beskriver tre ghost clusters som exkluderade,
  medan s. 33 listar fyra med 291 ärenden i kandidattaxonomin. C68 återkommer som
  verksamhetskandidat på s. 34 och 38 trots artefaktklassning på s. 32. Uppgiften
  om 54 aktionsbara kluster/2 260 ärenden på s. 33 går inte att förena med tabellen
  och sammanfattningens 12/650 på s. 36. De senare återges som den delmängd
  arbetet lyfter fram, utan påstående om slutligt godkänd kandidatlista.
- XGBoost: tabell 4.2.10 på s. 35 anger ROC-AUC 0,882, PR-AUC 0,426,
  precision 0,26, recall 0,58 och F1 0,36. Brödtexten på samma sida anger 0,897,
  0,428, precision 0,42 och recall 0,38; s. 12 anger F1 0,40. Split, eventuell
  tidsuppdelning och skydd mot informationsläckage redovisas inte tillräckligt för
  att bedöma oberoende generalisering. Portfolion beskriver kontrollens syfte
  utan att välja ett entydigt prestandavärde eller kalla den ett facit för rotorsaker.
- Slutlig textinput: s. 22, 25 och 27 inkluderar konversationer i beskrivningen
  av förberedda fält. Receptet på s. 28 listar bara ämne, analys och beskrivning.
  Exakt användning av konversationsloggar i slutkörningen lämnas öppen.
- Tid och reproducerbarhet: s. 13 och 18 anger slutdatum 2026-04-14, medan
  årstabellen på s. 20 anger 2026-04-22. Portfolion använder intervallet
  2020-2026. UMAP-seeds, fullständig konfiguration, urvalsorsaker från 19 847
  till 16 811 och oberoende seed-/urvalsstabilitet är inte fullt redovisade.
- Förslag är inte uppmätta resultat: borttagning av platshållartokens, större
  domänordlista, lokal språkmodell och intervjuer föreslås på s. 39. Deras effekt
  har inte verifierats här. Den tidigare startsidetexten om ett fel som hanterats
  i tre år ersätts med den aggregerade kandidatbeskrivningen; s. 38 dokumenterar
  liknande symptom över 2021-2024 men fastställer inte en gemensam rotorsak.

## Utökning av ISO-resultat och Education

Thesis-sidan har ett eget navigerbart avsnitt om generell datakvalitet, före
modellutvärderingen. Det förklarar de fem valda dimensionerna och skiljer giltiga
systemvärden från innehåll som går att använda för analys:

- Fullständighet: lösningsfältets 82,2 % rå fyllnad och 3,8 % manuell fyllnad,
  samt analysfältets 4,2 % (PDF-s. 19-20, 27).
- Exakthet: symptom kontra teknisk orsak, grova 15/50 kategorier och avsaknad
  av oberoende facit per ärende (PDF-s. 21-22).
- Konsistens: 100 % giltiga status-/prioritetsvärden följer systemtvång och
  fastställer inte kvaliteten i agenternas bedömningar (PDF-s. 23).
- Unikhet: 92,8 % icke-dubbletter enligt källsystemets tidsfönster och
  ämnesradsdetektering; 82,8 % år 2021 och 89,8 % år 2025 (PDF-s. 23-24).
- Spårbarhet: 5,1 % problemkoppling över perioden och 15,7 % under delåret 2026. Avsaknad av registrerad länk är inte avsaknad av känt fel (PDF-s. 24-25).
- Förändring över tid: klassificeringsfältens 99,9 % fyllnad år 2026 och
  analysfältets skilda årsandelar (PDF-s. 20). Detta är ett perspektiv på de fem
  dimensionerna, inte en sjätte utvärderad ISO-dimension.

Education återger klustringsresultat, långvariga symptom, ISO-mätning,
modelljämförelse och teknikstack. Dokumentation och processmognad beskrivs som
en huvudbegränsning i fallstudien, utan att avfärda modellens begränsningar.
Formuleringen om genomförda verksamhetsintervjuer införs inte: PDF-s. 12 anger
att intervjuerna exkluderades och s. 39 föreslår dem som framtida validering.

## Visuell kontroll och frontend

Tabeller på PDF-s. 19, 20, 28, 29, 32, 33 och 35 samt bilagorna på s. 41-45
har granskats som renderade sidor med PyMuPDF; Poppler saknades på PATH.
Figurhuvudena på s. 42-43 bekräftar slutresultatens 121/73 kluster och
0,7060/0,5342. PRB-figuren på s. 44 visar länkar per punkt, vilket inte är samma
sak som att hela gruppen saknar koppling. S. 45 visar tidigare 1 000-punktsförsök,
som inte används som slutkörningens evidens. Inga PDF-bilder används på webbplatsen.

Designriktningen är den befintliga redaktionella portfolion för rekryterare och
tekniska granskare, med dials 5/3/5. ProjectHero introducerar arbetet,
arbetsflödet skiljer population från resultat och StageFacts visar exakta mått
utan fyllda jämförelsestaplar. ProjectDepth innehåller tekniken. Inga tokens,
stilar, CV-länkar eller dokumentplaceringar ändras.

Kontroller:

- `npm run check`: godkänd typkontroll.
- `npm run format:check`: alla frontendfiler följer Prettier. Även rapporten är
  formaterad med Prettier.
- `npm run test:unit`: 92 godkända tester.
- Riktad Playwright-körning av `project-structure.spec.ts`, `portfolio.spec.ts`
  och `accessibility.spec.ts`: 9 godkända tester efter ISO-/Education-utökningen.
  Svenska och engelska på desktop/mobil, sektionens adress efter omladdning,
  populationer, jämförelsens avgränsning och avsaknad av privata dokumentlänkar
  kontrolleras, inklusive den nya datakvalitetsadressen. Education-textens
  teknikstack och länk till thesis samt dess placering bredvid Experience
  kontrolleras. Axe hittar inga överträdelser på thesis eller startsidan.
- De-ai-scannern: 0 träffar i thesis-texten och rapporten efter att rapportens
  etiketter i fetstil tagits bort.
- Visuell kontroll av thesis-sidan och Education vid 1440 px och 390 px:
  läsbar hierarki och 0 px horisontell överströmning. Swap/squint/signature/token-
  kontroller använder sidans befintliga typsnitt, numeriska arbetsflöde och
  CSS-variabler. Ingen ny färg, ikon, rörelse eller stylesheet har införts.
- UI-granskning enligt web-design-guidelines: inga nya fynd i ändrad
  thesis-markup i `frontend/src/products/CaseStudies.tsx:53`.
- `git diff --check`: inga whitespacefel i de ändrade innehållsfilerna och testet.
  `git check-ignore` bekräftar att original och privata granskningsartefakter
  ignoreras. Ingen push, merge, uppladdning eller produktionspublicering görs.
