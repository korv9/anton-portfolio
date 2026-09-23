# Källgranskning · 2026-09-21

Projektpåståenden har granskats mot följande GitHub-träd och filer. Endast kod/dokumentation lästes; inga av källprojekten kördes. En implementerad funktion är inte därmed produktionsverifierad.

## Swedish Job Market Analytics

Repository: https://github.com/korv9/swedish-job-market-analytics

Granskad commit: `59ffcf5a896c28449b424d0dcf1dd284dcc19b58`.

Lästa filer: `README.md`, `docs/role-scope.md`, `scripts/export_analytics.py`, `models/marts/mart_skill_trends_monthly.sql`, `models/marts/mart_skill_year_comparison.sql`, `.gitignore`, samt det fullständiga rekursiva filträdet (inte trunkerat).

Belagt: Python-ingestion, DuckDB, dbt, dimensional modell, historiskt upplägg 2024–2025, tre rollfamiljer, månadsandelar och årsvisa förändringar i procentenheter, export till Power BI. Årsandelen beräknas av summerade annonsantal, inte medelvärdet av månadsandelar.

**Databeslut:** inga `data/powerbi/*.csv`, ingen `export_manifest.json`, ingen historisk databas och ingen `reports/generated/trends.html` finns i det granskade Git-trädet. `data/` och `reports/generated/` ignoreras av Git. `fixtures/jobs.json` beskrivs uttryckligen som fyra påhittade annonser. `powerbi/` innehåller rapportdefinitioner och en semantisk modell, inte publicerade aggregat. README länkar till `docs/quality-review.md`, men den filen saknas i trädet. Den används därför inte som kvalitetsbevis.

Inga historiska resultat räknades fram från syntetiska data eller rekonstruerades. Portfolion visar tomlägen och specificerar vilka exporter som behövs.

## Allegoria

Repository: https://github.com/korv9/allegoria

Granskad commit: `61a31f316c2c3da5da9dc740cc676ce2c4b375c2`.

Lästa filer: `README.md`, `docs/status.md`, samt filträdet.

Belagt: forskningsupplägg för rekursiv omskrivning av normativa texter, källadaptrar för svensk författningstext och RFC, medallion-lager, Parquet/DuckDB och en konfigurerbar körmotor med spårbarhet. Lexikala markörer hjälper urvalet. Statusfilen säger att riktningsmåttet inte implementerats och att mänsklig granskning av annoteringarna saknas. Databricksdelen är enligt samma källa inte verifierad. Webbplatsen hävdar inga normativa effektresultat, produktionskörningar eller godkända modellmått.

## Homie API

Repository: https://github.com/korv9/homie-api

Granskad commit: `3c6da1ae24869107bd4b5f0fad10f0f7ed2de1af`.

Lästa filer: `README.md`, `app/api/routers/tasks.py`, samt filträdet.

Belagt: FastAPI/PostgreSQL, autentisering och databasens hälsokontroll. Hushåll, uppgifter, utförandehändelser och analys är stubbar. Uppgiftsskrivningar returnerar förhandsvisningar och lagrar inte ändringar. Databasintegration anges inte som lokalt verifierad i projektets README. Portfolion tillskriver inte detta API-repository det separata frontendprojektet.

## DrugComb

Repository: https://github.com/korv9/DrugComb-Synergy-Prediction

Granskad commit: `2b104d90485a9b66386cce12d3492d7942d8a511`.

Lästa filer: README (”WORK IN PROGRESS”), `BRAclean.py`, samt filträdet. Påståenden på sajten begränsas till vad bearbetningskoden visar: strängnormalisering, kanoniska läkemedelspar, aggregering per par/cellinje och klassificeringsetiketter från ZIP-poäng. Inga modellresultat eller medicinska slutsatser används.

## Examensarbete och personuppgifter

Källa: Antons uppgiftsbeskrivning i denna arbetsuppgift. Ingen examensrapport eller publik resultatkälla har tillhandahållits. Föreslagen disposition och syntetisk illustration är märkta som sådana. Inga kvalitetsdimensioner, modeller, parametrar, antal kluster, precisionstal eller verksamhetseffekter har hittats på.

Profilen bygger endast på Antons angivna namn, juniora inriktning, erfarenhet från Fora/Avtalat och skillnaden mellan dataerfarenhet och frontendstudier/egna projekt. Ingen titel, anställningsperiod eller arbetsgivarendorsement har lagts till.
