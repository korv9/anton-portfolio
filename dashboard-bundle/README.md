# Dashboard-bunt

En JSON per projekt för att skissa dashboards. Byggd 2026-10-16T18:59:59+00:00 från commit `eb2f4e0` ur `frontend/public/data`, `platform/target/manifest.json` och `platform/pipeline.yml`.

Varje fil har `meta`, `kpis` (högst 5), `charts` (högst 300 rader per serie), `list`, `tech` och `gaps`.

## jobs.json (44 kB)

Räknar varje annons i Arbetsförmedlingens historiska arkiv (JobTech) sedan 2020 per månad, yrkesområde, yrkesgrupp och län, och fyller på dagligen från JobTech-strömmen.

Källor: `jobs/06_top_technologies.csv`, `jobs/market.json`

Serier: `ads_monthly` (line, 81 rader), `field_change_ytd` (diverging, 21 rader), `region_ads` (bar, 22 rader), `top_occupations` (table, 40 rader), `conditions` (bar, 9 rader), `data_role_tech` (bar, 64 rader)

Luckor:

- Rekrytering eller anställningar: en annons är inte en anställning (method i market.json).
- Arbetsgivare per län eller yrke: marknadsexporten har inga arbetsgivare.
- Helårsjämförelse för 2026: året är ofullständigt, därför jämförs samma månader.
- Teknik- och juniorserierna (01–06 CSV) slutar 2025 och tillhör jobs_analysis, som körs för hand.
- Korn saknas för 8 av 11 modeller: det står bara där dbt har ett unique-test.
- 5 filer skiljer sig från catalog.json: katalogen är inte ombyggd sedan filerna ändrades.

## thesis.json (3 kB)

Grupperar personuppgiftsmaskerade incidenter med embeddings, UMAP och HDBSCAN och jämför grupperna med registrerade problemkopplingar.

Källor: `frontend/src/home/orbitContent.ts`, `frontend/src/products/CaseStudies.tsx`

Serier: `silhouette` (bar, 2 rader), `candidates` (bar, 2 rader)

Luckor:

- Ingen datamapp, dbt-modell eller pipeline-steg: arbetet kördes i Databricks hos Fora, utanför repot.
- Bara de publika talen ovan; ingen intern Avtalat-data och inga incidenttexter.
- Tidsserier, klusterstorlekar och kategorier finns inte publicerade, så inga fler serier går att räkna fram.
- Siffrorna kommer ur sidtexten i frontend/src, inte ur frontend/public/data.

## welfare.json (161 kB)

Samlar arbetsmarknad, sjukskrivning, hälsa och tillit från SCB, Försäkringskassan, Folkhälsomyndigheten, ESS och Kolada i en stjärnmodell per region och period.

Källor: `welfare/county-year.json`, `welfare/ess-countries.json`, `welfare/headlines.json`, `welfare/national-month.json`, `welfare/panel-county-year.json`, `welfare/run.json`

Serier: `labour_monthly` (line, 300 rader), `county_kolada` (table, 22 rader), `county_panel` (line, 294 rader), `sick_leave_monthly` (line, 242 rader), `ess_trust` (scatter, 5 rader), `headlines` (table, 80 rader)

Luckor:

- Indikatorer i olika enheter och perioder (månad, år, ESS-omgång) kan inte läggas på samma axel utan omräkning.
- Konfidensintervall saknas för de flesta indikatorer (ci_low/ci_high är null i headlines.json).
- Länsserierna slutar 2025; allvarlig psykisk påfrestning saknas i 400 av 441 rader i county-year.json.
- Kommunnivå är inte med: bunten har bara riket och län.
- Korn saknas för 35 av 45 modeller: det står bara där dbt har ett unique-test.
- 2 filer skiljer sig från catalog.json: katalogen är inte ombyggd sedan filerna ändrades.

## symbolic.json (63 kB)

Hittar 20 symboler i 101 folkloretexter från Project Gutenberg, bäddar in varje förekomst med en språkmodell och grupperar dem med UMAP och HDBSCAN.

Källor: `symbolic/book-centered-clusters.json`, `symbolic/experiment-comparison.json`, `symbolic/model-comparison.json`, `symbolic/summary.json`

Serier: `symbols` (bar, 20 rader), `traditions` (bar, 12 rader), `model_comparison` (table, 8 rader), `experiment_comparison` (table, 4 rader), `book_centered_clusters` (scatter, 114 rader), `cluster_sizes` (bar, 130 rader)

Luckor:

- Inga rader direkt ur mart_symbol_atlas: punkterna finns bara i parquet (symbolic/v4) och databasen finns inte lokalt.
- Granskade kluster: 0; review_status är tom tills en människa granskat.
- Bokstavlig mot symbolisk betydelse är inte mätt: needs a hand-labelled sample of occurrences; none exists yet
- Klustren är numrerade, inte namngivna (book-centered-clusters.json note).
- Korn saknas för 1 av 5 modeller: det står bara där dbt har ett unique-test.
- 8 filer skiljer sig från catalog.json: katalogen är inte ombyggd sedan filerna ändrades.

## politik.json (42 kB)

Samlar val, opinionsmätningar, voteringar och budget från Riksdagen, SCB och Valmyndigheten.

Källor: `parliament/elections.json`, `parliament/now.json`, `parliament/polls.json`

Serier: `election_now` (bar, 9 rader), `polls` (line, 45 rader), `elections` (bar, 133 rader), `latest_votes` (table, 15 rader)

Luckor:

- Namn på personer är utelämnade (statsminister, talare).
- Budget, voteringar per parti och debatter (politics/, gold/marts) är inte med; politik är bara referens.
- Korn saknas för 29 av 37 modeller: det står bara där dbt har ett unique-test.
- 1 filer skiljer sig från catalog.json: katalogen är inte ombyggd sedan filerna ändrades.

## aiact.json (73 kB)

Hämtar AI-förordningen och dess ändringar från EU:s Cellar, delar texten i artiklar och knyter skyldigheter, datum, riksdagsdebatt och platsannonser till dem.

Källor: `ai-act/jobs/monthly.json`, `ai-act/obligations.json`, `ai-act/politics/monthly.json`, `ai-act/politics/party-year.json`, `ai-act/summary.json`, `ai-act/timeline.json`

Serier: `obligation_grid` (table, 41 rader), `timeline` (table, 16 rader), `riksdag_ai_share` (line, 109 rader), `party_ai_share` (bar, 88 rader), `jobs_ai_act` (line, 79 rader)

Luckor:

- Artikeltexterna (article-text-*.json, 390 kB) är inte med: för stora och inga tal.
- Juridisk bedömning: navigatorn är ett hjälpmedel, inte rådgivning.
- Korn saknas för 5 av 23 modeller: det står bara där dbt har ett unique-test.
- 13 filer skiljer sig från catalog.json: katalogen är inte ombyggd sedan filerna ändrades.
