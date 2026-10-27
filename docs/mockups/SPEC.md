# Dashboard-spec per projekt

Ur mockuperna i canvasen (8–9 okt 2026). Värdena visar vad som räknades fram då. Räkna fram dem ur `frontend/public/data` och hårdkoda aldrig härifrån.

Specen gäller de projekt som finns på webbplatsen i dag (`frontend/src/projects/projectRegistry.ts`). Sidor som tagits bort sedan mockuperna står inte med; vilka de är och vart deras adresser leder står i [site-structure.md](../site-structure.md). DiVA Lakehouse (`#diva-lakehouse`) har ingen spec här.

Mockuperna för Arbetsmarknaden, Politik, EU AI Act och Välfärd togs bort i commit a2e25222, och de sidorna drogs tillbaka 2026-10-21. De två kvarvarande filerna, `DashSymbolic.dc.html` och `DashThesis.dc.html`, laddar `support.js`, som inte längre finns, så de renderar inte som de gjorde. `frontend/src/ui/dash/Dash.tsx` bygger fortfarande på kortrutnätet som specen beskriver.

### Symbolic Atlas (DashSymbolic.dc.html)
- KPI:er: Symbolförekomster: 72 926 | Största boks andel per kluster: 0,36 | Kluster: 130
- Huvudgraf: Atlaskartan (scatter), slicer: Visa
- Mätare: Kluster som spänner över böcker, Baslinjen, experiment-comparison
- Stapelkort 1: Bokdominans per modellversion, Medelandel för klustrets största bok, research-history
- Stapelkort 2: Korsande kluster per experiment, Kluster med förekomster från flera böcker
- Tekniskt kort: dbt Python-modeller för tolkning, NLP-pipeline i Python, resultat tillbaka in i dbt; fakta: int_symbol_occurrences; dims: int_symbolic_documents; marts: atlas_projection, mart_symbol_atlas, mart_symbol_profiles
- Lista: Korpus, Ett urval av texterna, med Gutenberg-id
- Fördjupning, KPI-rutor: Texter, Ord, Traditioner, Symboler, Förekomster, Punkter i kartan, Kluster, Brusandel, Silhouette, Trustworthiness, Medianmedlemskap, Största symbols andel
- Fördjupning, grafer: Experimenten (slicer: Mått) | Modellversioner (slicer: Mått)
- Fördjupning, grafer: Symbolerna (slicer: Mått) | Traditioner i korpusen (slicer: Mått)
- Utforska-tabeller: Texter, Kluster, Experiment, Symboler

### Examensarbete: klustring av IT-incidenter (DashThesis.dc.html)
- KPI:er: Produktionsincidenter: 21 000+ | Granskningskandidater: 72 | Silhouette, HDBSCAN: 0,706
- Huvudgraf: Från incidenter till granskning (grid)
- Mätare: Kluster med och utan problemkoppling, Av 121 kluster
- Stapelkort 1: Intern separation per metod, Silhouette, samma inbäddningar
- Stapelkort 2: Sållning i siffror, Antal i varje steg
- Tekniskt kort: Azure Databricks, notebooks och MLflow. Strukturen är publik, datan är det inte; fakta: Incidentdata (intern); dims: Kvalitetsbedömning; marts: UMAP 10D, HDBSCAN, Granskningslista
- Lista: Verktyg i flödet, Vad varje del gjorde
- Fördjupning, KPI-rutor: Incidenter, Kluster, Kandidater, Med problemkoppling, Silhouette HDBSCAN, Silhouette K-means, UMAP-dimensioner, Metodsteg
- Fördjupning, grafer: Kandidatandel
- Utforska-tabeller: Steg, Begränsningar

# Övriga projekt (utan canvas-mockup)

Samma upplägg som ovan: header, max 3 KPI:er, huvudgraf med slicer, mätare, två stapelkort, tekniskt kort, lista och Fördjupning med Explorer. Siffrorna nedan räknades ur `frontend/public/data` den 9 okt 2026 och är referens, inte värden att hårdkoda.

### Philosophy Atlas: `#philosophy-atlas` (data: `philosophy/*.json`)
- KPI:er: Passager i urvalet: 2 600 av 7 795 | Grupper över flera verk: 6 → 19 efter centrering per verk | Spänningar: 11
- Huvudgraf: atlaskartan (`atlas.json`, scatter). Slicer: Variant (rå / centrerad per verk), färg per verk eller tradition.
- Mätare: grannar från samma verk, 47,6 % mot slumpens 7,7 % (`summary.json` run.evaluation, baseline). Slicern för variant styr även mätaren.
- Stapelkort 1: spänningar, medianposition per verk, divergerande. Slicer: spänning (`tensions.json` distribution).
- Stapelkort 2: passager och ord per verk (`summary.json` works).
- Tekniskt kort: modell, UMAP- och HDBSCAN-parametrar ur `run`, dbt-modellerna under `platform/` för atlasen, exempelrader ur `clusters.json`.
- Lista: korpusen, 13 verk med översättare och Gutenberg-källa.
- Fördjupning: KPI-rutor ur run.evaluation för båda varianterna (kluster, brusandel, största verkets andel, verksdominerade kluster). Grafer: klusterstorlek och största verkets andel per variant, spänningarnas poler. Explorer: Verk, Grupper (`clusters.json`), Poler (`tensions.json` poles), Fördelning.
- Regel: inga gruppnamn utan granskning (`review_status`). Visa distinkta termer, inte namn.

### Concept Constellation: `#concept-journey` (data: `concepts/*.json`)
- KPI:er: Begrepp: 28 | Korpusar: 4, med 1 893 stycken | Grannar i samma korpus: 93 % mot slumpens 25 %
- Huvudgraf: begrepp × korpus, andel av styckena där begreppet ligger topp 3 (`profiles.json`). Slicer: korpus.
- Mätare: andel grannar i samma korpus, före och efter centrering (93 % / 80 %).
- Stapelkort 1: rank1-lift per begrepp i vald korpus.
- Stapelkort 2: stycken per korpus (`summary.json` run.chunks).
- Tekniskt kort: modell, ankarmeningar sv/en (anchor_agreement 1,0), AI-förordningens version, relationstyperna.
- Lista: de fem relationstyperna med sin förklaring.
- Fördjupning: Explorer med Begrepp, Profiler, Par (`pairs.json`), Relationer och Länkar.

### DrugComb: `#drugcomb` (data: `products/drugcomb/*`)
- KPI:er: Kombinationer: 396 498 | Läkemedel och cellinjer: 4 188 och 119 | AUPRC för synergi: 0,50 mot 0,054 för baslinjen (slumpmässig uppdelning, LightGBM med alla features)
- Huvudgraf: modellerna jämförda (`report.json` metrics). Slicers: Uppdelning (random, cold pair, cold drug, cold cell) och Mått (Pearson, RMSE, AUPRC). Det här är projektets poäng: modellen tappar på läkemedel den inte sett.
- Mätare: andel synergistiska (5,4 %) och antagonistiska (9,5 %) kombinationer.
- Stapelkort 1: datatratten, från 498 865 råa rader till 396 498 (`funnel`).
- Stapelkort 2: synergi per vävnadstyp (`lineages`).
- Tekniskt kort: DuckDB-lagret, `sql_*`-tabellerna, revision och att träningen inte körts om i portfolion (`source.status`).
- Lista: de 22 publicerade tabellerna med rader och SHA-256.
- Fördjupning: grafer för feature importance, inlärningskurva, kalibrering och y-scramble. Explorer över tabellerna (top synergistic pairs, entity resolution, metrics by fold med flera).

### Homie API: `#homie`
- Ingen data i repot. KPI:er bara om de kan räknas ur homie-api-repot eller ur innehållet som finns i `HomieProject.tsx` (till exempel antal ruttgrupper som är klara).
- Huvudgraf: `HomieFlow`, flödet från request till databas.
- Tekniskt kort: OpenAPI-kontraktet (ruttgrupper och status), Alembic-migreringar, CI (pytest, Ruff, GitHub Actions), Dockerfile i flera steg.
