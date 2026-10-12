# Granskning av kodstruktur

Datum: 11 oktober 2026. Gäller aktuell arbetskopia medan flera agenter arbetar i den. Produktkod, workflows och `.gitignore` har inte ändrats av denna granskning.

## Bedömning

Strukturen har en solid grund för en portfolio med flera analysprodukter. Gränsen mellan frontend och dataplattform är tydlig, de tyngre beräkningarna ligger huvudsakligen utanför browsern och många gemensamma funktioner är redan samlade. Strukturen är mindre konsekvent inom frontend och mellan äldre Python-byggare och dbt.

Rekommendationen är att behålla huvudmapparna och förenkla deras interna gränser stegvis. En total omorganisation skulle skapa många filflyttar utan att först lösa de konkreta problemen: dubbla definitioner av navigation, importkopplingar till en viss produkt, temporära filer och sammanblandning av dataleverans med byggets indata.

Underlag: fokuserade Graphify-frågor följda av riktade källkodsläsningar, Git-filförteckning, ignorekontroller, en lokal importgenomgång samt befintliga kontroller. Grafen är delvis äldre än koden. Ingen fullständig granskning av varje fil, hemlighet, datamodell eller browservy har gjorts.

Verifierat i arbetskopian: `npm run check` godkänd, `npm run format:check` godkänd och `npm run test:unit` rapporterade 91 godkända av 91. Python-, dbt- och e2e-sviterna har inte körts här. Data Engineer arbetar samtidigt med ingestionen; tidigare driftfynd ska jämföras med den agentens slutliga ändringar.

## Det som fungerar bra

- `frontend/`, `platform/` och `ml/` har tydliga huvuduppgifter. Separata ML-miljöer är rimliga när beroenden och körkostnad skiljer sig.
- `platform/ingest`, `models`, `publish` och `quality` beskriver stegen i dataplattformen. `legacy` gör återstående äldre bygge synligt.
- `frontend/src/projects/projectRegistry.ts` samlar projektinnehåll och identitet. Gemensamma komponenter finns i `ui/` och `charts/`.
- `frontend/src/dataSource.ts` samlar leveransupplösning. `platform/lib/common.py` och `rawstore.py` samlar filhantering, hashing och proveniens.
- TypeScript har strict, noUnusedLocals och noUnusedParameters i `frontend/tsconfig.json:8`. npm har en lockfil, och plattformens direkta Python-beroenden är versionslåsta.
- CI kontrollerar formatering, typer, enhetstester, bygge, browsertester, Python, datakontrakt och dbt. `.gitattributes` reglerar radslut även för hashade leveranser.

## Prioriterade förenklingar

### 1. Temporära filer syns i Git

`.gitignore` ignorerar warehouse, node_modules, buildresultat, dbt-state, Python-cache, env-filer och vissa ML-artefakter. Däremot är `/tmp/` inte ignorerad. Vid kontrollen fanns 1 593 filer under denna temporära katalog, inklusive nya ingestiontesters checkpoints. Antalet kan ändras medan tester körs.

Lägg till `/tmp/`. Överväg även `.venv/`, `venv/`, `.ruff_cache/`, `.mypy_cache/`, `.coverage`, `htmlcov/` och `*.egg-info/` när motsvarande verktyg används. Endast `ml/.venv/` är uttryckligen skyddad för virtualenv i dag; en miljö i reporoten skulle synas i Git. OS-filer som `.DS_Store` och `Thumbs.db` kan också ignoreras. Detta är förbättringsförslag, inte belägg för att alla dessa filer redan finns.

Graphify finns lokalt på flera nivåer och är inte ignorerat. Behåll kunskapsgrafen enligt repots instruktioner. Bestäm separat vilka grafartefakter som ska versioneras och vilka lokala mellanfiler som ska ignoreras; ignorera inte hela grafen eller alla JSON-filer på måfå.

`git ls-files --cached --ignored --exclude-standard` gav inga träffar vid kontrollen. Sökningen efter trackade `.env*`, `.pem`, `.key` och `.p12` gav inga träffar. Detta är en kontroll av filnamn och ignorebeteende, inte en komplett secretskanning.

### 2. Navigation och modellval definieras på flera ställen

Ett projekts beteende berör `projectRegistry.ts`, `topics.ts`, `router.ts`, `App.tsx` och ibland egna produktmenyer. `ProjectTech.tsx:87` läser dessutom `window.location.hash` och väljer datamodell med regex. En ny route kan alltså fungera i navigationen men få en annan teknisk förklaring än avsett.

Samla route, temainformation och analysens tekniska metadata i en gemensam definition där det faktiskt minskar dubbla uppgifter. Skicka explicit route eller analys-id till teknikkortet. Låt appen behålla en enkel koppling mellan sida och lazy komponent; ett avancerat plugin- eller routersystem behövs inte för detta.

Acceptans: ett nytt tema får sin titel, adress och relevanta modellförklaring utan duplicerade routevillkor. Befintliga alias och delade filteradresser fortsätter fungera.

### 3. Gemensam UI-kod ligger i politikprodukten

`frontend/src/jobb/themes.tsx:8` importerar layout, kontroller och filterhantering från `politik`. `jobb/charts.tsx` använder dess storlekshook och `JobsProduct.tsx` importerar politikens CSS. De två produkterna delar därmed mer än analyskomponenter.

Flytta enbart bekräftat generiska delar till `ui/`, `charts/` eller en liten gemensam hookmodul. Låt produktens frågor och mått stanna i produkten. Konsolidera sedan `jobb`/`jobs` och dokumentera gränsen mellan `politik`, `politics` och `parliament`. Skillnaderna har en del historiska skäl, men namnen förklarar inte ansvar tillräckligt väl för en ny utvecklare.

Acceptans: arbetsmarknadsprodukten kräver inte politikens övergripande stylesheet eller produktlayout för att rendera.

### 4. Python körs till stor del som lösa skript

En genomgång fann 131 `sys.path.insert/append`-rader i 103 plattformsfiler, inklusive tester och vendorerad kod. Det är en indikator på ett återkommande importmönster, inte 131 separata fel. Exempel finns i `platform/publish/export_market.py:26` och flera ingestionentrypoints.

Inför en liten installerbar Python-paketstruktur med tydliga entrypoints för den egna plattformskoden. Välj ett paketnamn som inte krockar med stdlib-modulen `platform`. Migrera nya och ofta ändrade kommandon först. Behåll CLI-kompatibilitet under övergången. Det vendorerade DrugComb-projektet har redan sin egen `pyproject.toml`, vilket passar dess separata beroenden och ursprung.

Det finns ingen gemensam Python-lint- eller typkonfiguration för hela den egna plattformen i den kontrollerade filförteckningen. DrugComb har en lokal Ruff-konfiguration. Lägg till en begränsad gemensam kontroll och undanta upstreamkod; undvik att formatera om allt som ett första steg.

### 5. Äldre bygge läser från frontendleveranser

`platform/legacy/build_gold.py:24` sätter SOURCE till `frontend/public/data`. Kod i plattformen använder alltså webbplatsens leveransfiler som indata till nytt bygge. Det gör lokal reproduktion och en framtida övergång till enbart R2-leveranser mer beroende av var kopior råkar finnas.

Följ den dokumenterade ämnesvisa migreringen till dbt med jämförelse mot befintliga resultat. Låt rådata och warehouse vara byggindata och frontendfiler vara leverans eller uttryckliga fixtures. Ta inte bort legacy innan dess resultat reproduceras och kontrollerna har en ersättning.

### 6. Några frontendfiler bär många uppgifter

Vid kontrollen hade `aiact/views.tsx` cirka 1 350 rader, `DrugCombReport.tsx` cirka 1 190 och `jobb/themes.tsx` cirka 840. `aiact.css` hade cirka 1 550 rader och flera globala stylesheets laddas från `main.tsx:4`.

Dela efter avgränsade vyer och ansvar när filerna ändras. Flytta beräkningar som kan användas eller testas separat till lokala analysmoduler. Ta bort oanvänd CSS efter en faktisk selector- och browserkontroll. Filstorlek ensam motiverar inte en omskrivning eller att väldefinierade skatteregler delas godtyckligt.

### 7. Språkhanteringen har flera konventioner

`i18n.ts` använder `l(en, sv)` och en strängbaserad översättningsordbok. `home/content.ts`, `home/orbitContent.ts` och projektregistret definierar var sin Bilingual och `t(sv, en)`. `HomePage.tsx:17` väljer alltid text.en.

Samla en bilingual typ och en namngiven språkresolver. Använd samma argumentkonvention och explicit språkdata för nytt innehåll. Bedöm om gamla ordboksposter behövs innan de tas bort. Målet är att en textändring inte ska bryta översättningen genom att ändra en lookupsträng.

## Vad kan tas bort?

En lokal sökning som följer relativa imports från `main.tsx` hittade två TS-filer utanför den nåbara kedjan: `frontend/src/politik/analytics/areas.ts` och `frontend/src/politik/analytics/load.ts`. Den kompletterande textsökningen hittade inga importreferenser till dessa två filer.

De är kandidater för borttagning, inte slutligt bevis för att de saknar varje användning. Kontrollera testentrypoints, scripts och eventuell planerad ersättning, ta sedan bort dem i en liten ändring och kör relevanta kontroller. Många gamla mappnamn finns kvar som tomma kataloger på disken; Git versionerar inte tomma kataloger.

För övrigt finns inget underlag för en stor blind utrensning. Behåll använd datakod, frysta upstreamkällor, testfixtures, licenser och vendorerade paket. Behåll också dokumenterade routealias som skyddar gamla länkar. Genererade data kan flyttas till R2 genom en leveransmigrering; `.gitignore` ensam gör inte flytten och tar inte bort redan trackade filer.

## Hårdkodning

Det går inte att ge en meningsfull procentsiffra från en textsökning. Skilj på typerna:

| Typ | Exempel | Bedömning |
| --- | --- | --- |
| Redaktionell | Projekttexter, CV-länkar, grupper | Rimligt för en personlig portfolio; centralisera där samma uppgift används flera gånger |
| Analytisk | Skatteregler, modeller, trösklar, urval | Rimligt om källa, version och test finns; inte godtyckligt flyttbart till miljövariabler |
| Källkontrakt | API-adresser, tabell-id, årsfönster | Behövs, men ska vara källans dokumenterade konfiguration och ha uppdateringspolicy |
| Drift | R2 development-URL i `build_catalog.py:36` | Produktionsval ska komma från konfiguration; en fallback behöver vara uttrycklig |
| Koppling mellan produkter | Route-regex i teknikkort och återanvändning av politik-CSS | Onödig koppling som bör förenklas |

Den riktade sökningen i frontend, egna bibliotek, legacy, publish och ML hittade inga citerade absoluta användarspecifika hemmapaths. Sökningen är begränsad och bevisar inte att sådana aldrig förekommer i hela repot.

## Skalbarhet

För fler läsare är statisk frontend och objektlagring en bra grund. Ingen trafik- eller kapacitetsmätning ingår här, så inga volymgränser kan garanteras.

För fler produkter är läget blandat. Domänmappar, gemensamma diagram och kontrakt hjälper, men routingens flera definitioner, produktövergripande CSS och många skriptentrypoints ökar kostnaden för att lägga till eller ändra en produkt.

För mer data behöver ingestion, checkpointing och leverans skiljas från sitebuild. DuckDB passar analytiska batchjobb, men samtidiga writers och långa arbetsflöden behöver kontrollerad körning. Skicka sammanfattningar och avgränsade filer till browsern; större datamängder ska inte automatiskt bli större JSON-filer i git eller mer arbete på huvudtråden.

Git-filförteckningen innehöll 2 089 JSON/JSONL/Parquet-filer. Det inkluderar både nödvändiga frysta källor och leveranser och är inte 2 089 städfynd. Exempel på större trackade filer är en 29,2 MB upstreamkälla och två filer omkring 5,4 MB. Separera dataartefakter från kod där reproducerbarhet och leverans redan har ett kontrollerat alternativ. Ingen historikomskrivning rekommenderas som första åtgärd.

## Föreslagen ordning

1. Täpp till ignoreluckan för tmp och relevanta lokala verktygsartefakter.
2. Låt Data Engineer färdigställa ingestion och godkänd publicering.
3. Flytta jobbdatans dagliga leverans till R2 enligt den separata planen.
4. Samla routemetadata och frikoppla gemensam UI-kod från politikprodukten.
5. Ta bort de verifierat oanvända filerna och rensa CSS med browserkontroll.
6. Standardisera Pythonentrypoints och språkhantering i små ändringar.
7. Fortsätt legacy-migreringen ämne för ämne.

Visuella element ska byggas med HTML/CSS, SVG eller canvas när de återges i produkten. Screenshots används som referens och granskningsunderlag; de ska inte ersätta dessa element med lågupplösta bitmapbilder.

Finding: Aktuell frontend passerade typkontroll, formatering och 91 enhetstester den 11 oktober 2026.
Finding: Tmp-katalogen var inte ignorerad och innehöll 1 593 filer vid granskningen.
Idea: Behåll huvudarkitekturen och förenkla routing, gemensam UI-kod och Pythonentrypoints stegvis.
Idea: Ta bara bort kod efter verifierad användningskontroll; börja med de två isolerade kandidaterna i politikens analytics.
