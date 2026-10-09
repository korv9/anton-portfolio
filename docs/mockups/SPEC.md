# Dashboard-spec per projekt

Ur mockuperna i canvasen (8–9 okt 2026). Värdena visar vad som räknades fram då. Räkna fram dem ur `frontend/public/data` och hårdkoda aldrig härifrån.

### Arbetsmarknaden i jobbannonser — JobbDashboard.dc.html
- KPI:er: Nya annonser jan–sep 2026: 416 139 | Data/IT jan–sep 2026: 23 534 | Annonser räknade av pipelinen: 5 059 005
- Huvudgraf: Annonser per månad (dots), slicer: Bransch
- Mätare: Arbetstid i annonserna — jan–sep 2026, mart_market_conditions_yearly
- Stapelkort 1: Yrkesfält som rör sig mest — jan–sep 2026 mot 2025, av 21 fält
- Stapelkort 2: Störst län — Annonser jan–sep 2026, mart_market_region_yearly
- Tekniskt kort: 11 dbt-modeller i DuckDB och 18 tester, taggade market; fakta: stg_market_ads; dims: dim_market_field, dim_market_occupation_group; marts: mart_market_field_monthly, mart_market_daily, mart_market_occupation_yearly, mart_market_region_yearly, mart_market_conditions_yearly, mart_market_archives
- Lista: Senast lästa källfiler — Proveniens per arkiv: URL, SHA-256 och antal
- Fördjupning, KPI-rutor: Annonser 2020–2026, Platser jan–sep 2026, Annonser 2023, Annonser 2024, Annonser 2025, Annonser 2026, Yrkesgrupper (SSYK 4), Län, Heltid, Erfarenhet krävs, Arkiv lästa, Rader i exporten
- Fördjupning, grafer: Yrkesgrupper som växer och krymper (slicer: Bransch) | Anställningsform (slicer: Bransch)
- Fördjupning, grafer: Annonser per län (slicer: År) | Annonser per år
- Utforska-tabeller: Yrkesgrupper, Län × yrkesfält, Dagliga annonser, Arkiv

### Svensk politik i siffror — DashPolitik.dc.html
- KPI:er: Anföranden i modellen: 246 350 | Voteringar med partiposition: 1 436 | Opinionsmätningar: 104
- Huvudgraf: Väljarstöd per mätning (dots), slicer: Parti
- Mätare: Riksdagen efter valet 2026 — Mandat per parti, fct_election
- Stapelkort 1: Mandat 2022 till 2026 — Förändring per parti, fct_election
- Stapelkort 2: Röstar som Moderaterna — Andel voteringar 2025/26 där partiet tog samma ställning som M
- Tekniskt kort: 25 parlamentsmodeller och 12 politikmodeller i dbt, exporten kontrolleras byte för byte; fakta: fct_party_roll_call; dims: dim_parliament_session, dim_government; marts: fct_roll_call, mart_party_session_record, mart_party_pair_session, fct_party_poll, fct_election
- Lista: Levererade dataset — Det som sajten läser, per källa
- Fördjupning, KPI-rutor: Kammardebatter, Inlägg i debatterna, Anföranden totalt, Analyserade segment, Voteringar, Reservationer, Budgetrader, Utgiftsområden, Skattebeslut, Kommunalskatter, Lagbestämmelser, Betydelsetester
- Fördjupning, grafer: Statsbudgetens utfall (slicer: År) | Skatteintäkter över tid (slicer: Skatt)
- Fördjupning, grafer: Vem tar ordet i kammaren (slicer: Riksmöte) | Röstar med regeringen, per sakområde (slicer: Sakområde)
- Fördjupning, grafer: Vad debatterna handlar om
- Utforska-tabeller: Debatter, Sakområden, Budgetmotioner, Skattebeslut, Kommunalskatt, Partiaktivitet

### EU AI Act Observatory — DashAiAct.dc.html
- KPI:er: Artiklar tolkade: 119 | Skyldigheter med källcitat: 51 | Artiklar ändrade sedan 2024: 42
- Huvudgraf: Hur ofta AI nämns (dots), slicer: Signal
- Mätare: Skyldigheter per riskklass — mart_ai_act_obligations
- Stapelkort 1: Vem ska göra vad — Skyldigheter per aktör, bridge_ai_act_article_actor
- Stapelkort 2: Ändringar som följs — Per typ, mart_ai_act_changes
- Tekniskt kort: 4 bronze-, 6 silver- och 13 gold-modeller. Silver är dbt Python-modeller som tolkar XHTML; fakta: mart_ai_act_obligations; dims: dim_ai_act_actor, dim_ai_act_risk_class, dim_ai_act_article; marts: mart_ai_act_changes, mart_ai_act_timeline, bridge_ai_act_article_actor, bridge_ai_act_article_reference, bridge_ai_act_article_guidance
- Lista: Lagtextens versioner — CELEX-nummer från EUR-Lex och Cellar
- Fördjupning, KPI-rutor: Artiklar, Skäl, Bilagor, Aktörer, Skyldigheter, Milstolpar, Dokument, Vägledningar, Ändrade artiklar, Nya artiklar, Oförändrade, Tecken i artiklarna
- Fördjupning, grafer: Vilka skyldigheter (slicer: Aktör) | När artiklarna börjar gälla
- Fördjupning, grafer: Artiklar per kapitel
- Utforska-tabeller: Artiklar, Skyldigheter, Ändringar, Tidslinje, Signaler per månad

### Hur mår Sverige? — DashValfard.dc.html
- KPI:er: Indikatorer på gemensam axel: 80 | Rader i fct_indicator: 1 271 081 | dbt-tester gröna: 141 / 141
- Huvudgraf: Riket per månad (dots), slicer: Mått
- Mätare: Indikatorer per källa — dim_indicator, dim_source
- Stapelkort 1: Arbetslöshet 2025 per län — Skillnad mot befolkningsvägt snitt 8,9 %, mart_county_year_overview
- Stapelkort 2: Rådata per källa — Megabyte vid senaste hämtning
- Tekniskt kort: 45 modeller och 141 tester, dbt 1.12.4; fakta: fct_indicator; dims: dim_region, dim_period, dim_indicator; marts: fct_labour_force, fct_sick_pay_rate, fct_sick_leave_cases, fct_kolada, mart_county_year_overview
- Lista: Senaste hämtning per källa — Ur run.json: filer, storlek och tid
- Fördjupning, KPI-rutor: fct_indicator, fct_sick_pay_rate, fct_labour_force, fct_sick_leave_cases, fct_kolada, fct_population, fct_social_survey_country, fct_health_survey, Källor, Seeds, Tabeller i katalogen, Byggtid
- Fördjupning, grafer: Län för län (slicer: Mått) | Arbetslöshet över tid (slicer: Län)
- Fördjupning, grafer: Tillit till andra människor i Europa
- Utforska-tabeller: Län × år, Indikatorer, Riket per månad, Datakatalog

### Symbolic Atlas — DashSymbolic.dc.html
- KPI:er: Symbolförekomster: 72 926 | Största boks andel per kluster: 0,36 | Kluster: 130
- Huvudgraf: Atlaskartan (scatter), slicer: Visa
- Mätare: Kluster som spänner över böcker — Baslinjen, experiment-comparison
- Stapelkort 1: Bokdominans per modellversion — Medelandel för klustrets största bok, research-history
- Stapelkort 2: Korsande kluster per experiment — Kluster med förekomster från flera böcker
- Tekniskt kort: dbt Python-modeller för tolkning, NLP-pipeline i Python, resultat tillbaka in i dbt; fakta: int_symbol_occurrences; dims: int_symbolic_documents; marts: atlas_projection, mart_symbol_atlas, mart_symbol_profiles
- Lista: Korpus — Ett urval av texterna, med Gutenberg-id
- Fördjupning, KPI-rutor: Texter, Ord, Traditioner, Symboler, Förekomster, Punkter i kartan, Kluster, Brusandel, Silhouette, Trustworthiness, Medianmedlemskap, Största symbols andel
- Fördjupning, grafer: Experimenten (slicer: Mått) | Modellversioner (slicer: Mått)
- Fördjupning, grafer: Symbolerna (slicer: Mått) | Traditioner i korpusen (slicer: Mått)
- Utforska-tabeller: Texter, Kluster, Experiment, Symboler

### Examensarbete: klustring av IT-incidenter — DashThesis.dc.html
- KPI:er: Produktionsincidenter: 21 000+ | Granskningskandidater: 72 | Silhouette, HDBSCAN: 0,706
- Huvudgraf: Från incidenter till granskning (grid)
- Mätare: Kluster med och utan problemkoppling — Av 121 kluster
- Stapelkort 1: Intern separation per metod — Silhouette, samma inbäddningar
- Stapelkort 2: Sållning i siffror — Antal i varje steg
- Tekniskt kort: Azure Databricks, notebooks och MLflow. Strukturen är publik, datan är det inte; fakta: Incidentdata (intern); dims: Kvalitetsbedömning; marts: UMAP 10D, HDBSCAN, Granskningslista
- Lista: Verktyg i flödet — Vad varje del gjorde
- Fördjupning, KPI-rutor: Incidenter, Kluster, Kandidater, Med problemkoppling, Silhouette HDBSCAN, Silhouette K-means, UMAP-dimensioner, Metodsteg
- Fördjupning, grafer: Kandidatandel
- Utforska-tabeller: Steg, Begränsningar

---

# Övriga projekt och sidor (utan canvas-mockup)

Samma upplägg som ovan: header, max 3 KPI:er, huvudgraf med slicer, mätare, två stapelkort, tekniskt kort, lista och Fördjupning med Explorer. Siffrorna nedan räknades ur `frontend/public/data` den 9 okt 2026 och är referens, inte värden att hårdkoda.

### Philosophy Atlas — `#philosophy-atlas` (data: `philosophy/*.json`)
- KPI:er: Passager i urvalet: 2 600 av 7 795 | Grupper över flera verk: 6 → 19 efter centrering per verk | Spänningar: 11
- Huvudgraf: atlaskartan (`atlas.json`, scatter). Slicer: Variant (rå / centrerad per verk), färg per verk eller tradition.
- Mätare: grannar från samma verk, 47,6 % mot slumpens 7,7 % (`summary.json` run.evaluation, baseline). Slicern för variant styr även mätaren.
- Stapelkort 1: spänningar, medianposition per verk, divergerande. Slicer: spänning (`tensions.json` distribution).
- Stapelkort 2: passager och ord per verk (`summary.json` works).
- Tekniskt kort: modell, UMAP- och HDBSCAN-parametrar ur `run`, dbt-modellerna under `platform/` för atlasen, exempelrader ur `clusters.json`.
- Lista: korpusen, 13 verk med översättare och Gutenberg-källa.
- Fördjupning: KPI-rutor ur run.evaluation för båda varianterna (kluster, brusandel, största verkets andel, verksdominerade kluster). Grafer: klusterstorlek och största verkets andel per variant, spänningarnas poler. Explorer: Verk, Grupper (`clusters.json`), Poler (`tensions.json` poles), Fördelning.
- Regel: inga gruppnamn utan granskning (`review_status`). Visa distinkta termer, inte namn.

### Concept Constellation — `#concept-journey` (data: `concepts/*.json`)
- KPI:er: Begrepp: 28 | Korpusar: 4, med 1 893 stycken | Grannar i samma korpus: 93 % mot slumpens 25 %
- Huvudgraf: begrepp × korpus, andel av styckena där begreppet ligger topp 3 (`profiles.json`). Slicer: korpus.
- Mätare: andel grannar i samma korpus, före och efter centrering (93 % / 80 %).
- Stapelkort 1: rank1-lift per begrepp i vald korpus.
- Stapelkort 2: stycken per korpus (`summary.json` run.chunks).
- Tekniskt kort: modell, ankarmeningar sv/en (anchor_agreement 1,0), AI-förordningens version, relationstyperna.
- Lista: de fem relationstyperna med sin förklaring.
- Fördjupning: Explorer med Begrepp, Profiler, Par (`pairs.json`), Relationer och Länkar.

### DrugComb — `#drugcomb` (data: `products/drugcomb/*`)
- KPI:er: Kombinationer: 396 498 | Läkemedel och cellinjer: 4 188 och 119 | AUPRC för synergi: 0,50 mot 0,054 för baslinjen (slumpmässig uppdelning, LightGBM med alla features)
- Huvudgraf: modellerna jämförda (`report.json` metrics). Slicers: Uppdelning (random, cold pair, cold drug, cold cell) och Mått (Pearson, RMSE, AUPRC). Det här är projektets poäng: modellen tappar på läkemedel den inte sett.
- Mätare: andel synergistiska (5,4 %) och antagonistiska (9,5 %) kombinationer.
- Stapelkort 1: datatratten, från 498 865 råa rader till 396 498 (`funnel`).
- Stapelkort 2: synergi per vävnadstyp (`lineages`).
- Tekniskt kort: DuckDB-lagret, `sql_*`-tabellerna, revision och att träningen inte körts om i portfolion (`source.status`).
- Lista: de 22 publicerade tabellerna med rader och SHA-256.
- Fördjupning: grafer för feature importance, inlärningskurva, kalibrering och y-scramble. Explorer över tabellerna (top synergistic pairs, entity resolution, metrics by fold med flera).

### Uppsatser i DiVA — `#diva`
- Läser `diva/clusters.json` via `fetchData`. Filen finns inte i `public/data` idag, så kontrollera om den finns i R2 (`offloaded.json`).
- Om datan finns: KPI:er för uppsatser, kluster och år, huvudgraf över kluster med slicer för år, och klustrens ord.
- Om datan saknas: header, status "Inläsningen har inte körts", tekniskt kort med pipelinen (OAI-PMH → TF-IDF → SVD → K-means → c-TF-IDF, GitHub Actions). Inga KPI:er.

### Homie API — `#homie`
- Ingen data i repot. KPI:er bara om de kan räknas ur homie-api-repot eller ur innehållet som finns i `HomieProject.tsx` (till exempel antal ruttgrupper som är klara).
- Huvudgraf: `HomieFlow`, flödet från request till databas.
- Tekniskt kort: OpenAPI-kontraktet (ruttgrupper och status), Alembic-migreringar, CI (pytest, Ruff, GitHub Actions), Dockerfile i flera steg.

### Allegoria / RFC-drift — `#rfc-drift` (data: `reports/rfc-drift.json`)
- Status-pill: "Pågående".
- KPI:er: Krav i RFC 2965: 78 | Krav i RFC 6265: 47 | Bindande andel: 42,3 % → 27,7 %
- Huvudgraf: staplade staplar per version (bindande, svag, saknas).
- Lista: scenarierna (BINDING → WEAK och så vidare).
- Tekniskt kort: metoden ur `method` och SHA-256 per version.
- Inget mer: matched_changes är tom, så visa inte ändringslistan.

### RAG-studieassistent och Pumpljud-CNN (MIMII)
- Ingen route och ingen data i repot. Ge dem varsin enkel projektsida med samma skal: header, stack som taggar, tekniskt kort med pipelinen ur registret och länk till koden (MIMII har GitHub, RAG har ingen publik kod).
- Inga KPI:er om inte Anton ger siffror. Fråga i sammanfattningen.

### Plattformssidor (egen grupp i sidebaren: "Plattform")
- **Datakvalitet `#quality`** (`quality/*.json`):
  - KPI:er: Kontroller: 42, varav 39 godkända | Produkter: 7 | Diagnostiker: 27, varav 10 varningar
  - Huvudgraf: produkt × ISO 25012-dimension. Slicer: status.
  - Explorer: kontroller och validitet.
- **Datamodell `#datamodel` och ER `#er`** (`schema/*.json`, `gold/*`):
  - KPI:er: dbt-modeller: 124 | Tester: 274 | Rader: 22 343 310
  - Huvudgraf: ER-diagrammet som finns. Explorer: modeller.
- **Arkitektur `#data-constellation`** (`DataConstellationPage`, `architecture/graph.json`): 356 noder, 894 kanter, 9 lager. Lager per domän som huvudgraf.
- **Datakatalog `#data-catalogue`** (`catalog.json`): 5 344 filer. Explorer över filerna.
- **Idea Lineage `#idea-lineage`** (`idea-lineage/events.json`): 18 händelser som tidslinje.
