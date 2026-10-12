# Granskning av daglig ingestion

Granskad 11 oktober 2026. Underlag: befintlig Graphify-graf, aktuell arbetskopia, GitHub Actions-körningar och leveransfiler på `main` via GitHubs API. Produktkod och workflows har inte ändrats.

## Bedömning

Daglig hämtning är konfigurerad för arbetsmarknad, välfärd/parlament/skatt och nyheter. Arbetsmarknadens dagliga leverans fungerar i den kontrollerade körningen. De andra flödena har avbrott i den senaste historiken. Alla projekt får inte nya data varje dag.

Källkontroll, ändrat innehåll, ny export och lyckad publicering är separata händelser. En statistikmyndighet kan kontrolleras varje dag även när den senaste observationen är flera månader gammal.

## Schema och kontrollerat läge

| Flöde | Konfigurerad start, UTC | Läget vid kontrollen |
| --- | --- | --- |
| Arbetsmarknad | Dagligen 04:23 | Körningen 11 oktober lyckades. `jobs/market.json` på main har `generated_at` 2026-10-11T10:55:37+00:00. |
| Välfärd, parlament och skatt | Dagligen 04:37 | Körningen 11 oktober avslutades med timeout före export. Körningen 10 oktober publicerade till R2 men misslyckades i efterföljande datakontrakt; 7–9 oktober är markerade cancelled. |
| Nyheter | Dagligen 05:17 | Körningen 11 oktober väntade. Körningarna 9–10 oktober misslyckades. `parliament/news.json` på main är byggd 8 oktober. |
| DiVA | Manuellt | Ingen cron; datumintervallet anges vid start. |
| Hela warehouse, AI Act, tal och ML | Manuellt | `build-warehouse.yml` körs via workflow_dispatch och lagrar warehouse/raw/features i R2. Det workflowet committar inte webbplatsens leveransfiler. |

I Stockholm motsvarar de konfigurerade dagliga starttiderna 06:23, 06:37 och 07:17 under sommartid, en timme tidigare under vintertid. Faktisk start är senare i de kontrollerade Actions-körningarna. Tiderna är därför inga leveransgarantier.

Körningar:

- Arbetsmarknad: https://github.com/korv9/anton-portfolio/actions/runs/38133621191
- Offentliga data, pågående vid kontrollen: https://github.com/korv9/anton-portfolio/actions/runs/38133908645
- Offentliga data, fel 10 oktober: https://github.com/korv9/anton-portfolio/actions/runs/38046058185
- Nyheter, fel 10 oktober: https://github.com/korv9/anton-portfolio/actions/runs/38047584096

## Hur uppdateringen fungerar

Arbetsmarknaden återläser sparade räknare och streamstate från R2. `ingest_market.py` kontrollerar nya eller ändrade historiska arkiv och undviker att räkna om oförändrade arkiv. `ingest_stream.py` fortsätter från `fetched_until` i fönster om högst sex timmar. Annons-id dedupliceras. Den första observerade publiceringen räknas; senare ändringar ignoreras och borttagna annonser räknas fortsatt som tidigare publiceringar.

Streamdagar är preliminära och kan missa annonser som både publiceras och tas bort mellan hämtningarna. Den verifierade körningen täcker kompletta dagar 7–10 oktober. Hela arbetsmarknadens månadsserie slutar i september 2026. Streamen startade 7 oktober, så oktober är ännu inte en fullständig streammånad. Kvartalsarkiv ersätter streamvärden för sina perioder när de finns. Den äldre IT-rapporten byggs endast om när ett nytt årsarkiv finns, eller när force väljs.

Välfärdsflödet hämtar SCB, Folkhälsomyndigheten, Försäkringskassan, ESS och Kolada. Ett misslyckat källskript stoppar flödet före dbt. Därefter kör samma workflow parlament och skatt, exporterar JSON/Parquet och laddar upp till R2. Historik för avslutade riksdagssessioner cachas; öppna sessioner hämtas om.

Nyheter hämtas från SVT, Ekot och Regeringskansliet och sammanfogas med ett månadsarkiv i R2. En enskild felande källa ger en varning och de andra fortsätter; om inga poster kommer från någon källa avbryts ingestionen. Flödena innehåller bara ett kort historiskt fönster, så längre avbrott kan lämna luckor som en senare körning inte återställer.

Råfiler registreras med URL, hämtningstid, SHA-256 och storlek. Den gemensamma HTTP-sessionen försöker igen vid bland annat 429 och tillfälliga serverfel. Identiska bytes skriver inte om råfilen. `store_version` bevarar flera innehållsversioner när den används; vanlig `store` ersätter ändrat innehåll.

Ändrade leveransfiler committas till main. Enligt hostingkonfigurationens dokumentation bygger Cloudflare webbplatsen från dessa commits. Denna granskning har inte verifierat Cloudflares senaste deploy. Webbplatsens datafiler har fem minuters cache enligt `_headers`.

## Fynd som påverkar färskheten

### AI-sammanfattningen blockerar nyheter

Nyhetsjobbet kör den valfria sammanfattningen före commit-steget. Den 10 oktober returnerade modellen `max_tokens`; skriptet avslutade med kod 1 och commit-steget kördes inte. Ingestionens arkivering i R2 sker tidigare, men webbplatsens JSON-leverans uteblev. Aktuell `summarize_news.py:152` returnerar fortfarande 1 vid detta stopp.

Förslag: publicera de hämtade nyheterna oberoende av sammanfattningen. Hantera sammanfattningen som ett separat resultat och behåll föregående version när den misslyckas.

### Datakontraktsfel efter R2-publicering stoppade sajtreleasen

Uppföljningen med stegutslag visar att upload och statuspublicering den 10 oktober lyckades. Felet med ett ogiltigt autentiseringsheader inträffade i det efterföljande steget Data contracts och hindrade commit. Den tidigare beskrivningen av detta som ett fel i själva upload-steget var felaktig. Nuvarande `upload.py:48` tar bort inledande/avslutande whitespace och validerar formatet; en ny komplett körning på main återstår att verifiera.

Direkt autentiserad R2-läsning senare den 11 oktober verifierade JobTech-state med fetched_until 2026-10-11T12:50:00, välfärdsstatus från 10 oktober och tre välfärds-Parquetfiler. Filerna gick att läsa som Parquet och deras innehåll matchade katalogens hashkonvention. Den normaliserar CRLF även för binärdata i build_catalog.py; en vanlig bytehash är därför inte samma kontroll. Detta är ett mindre stickprov, inte en fullständig objektgranskning. Jobs/market.json saknades i R2, vilket stämmer med nuvarande commitbaserade JSON-leverans.

Loggen den 10 oktober verifierade 4 654 uppladdade katalogobjekt med metadatahashar. Statusrapporten uppger 141 godkända dbt-tester. Dagens timeout inträffade före export/upload. De lokala workflowförbättringarna har ännu inte nått main: GitHubs main-version har fortfarande timeout-minutes 60.

### Gemensam kö kan ersätta väntande körningar

Workflows använder `concurrency.group: data-refresh` och `cancel-in-progress: false`. Det skyddar den aktiva körningen, men standardbeteendet tillåter endast en väntande körning i gruppen; en nytillkommen körning ersätter den väntande. Det kan påverka olika flöden eftersom gruppen delas. Se https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency.

Historiken visar avbrutna välfärdskörningar, men orsaken till dessa har inte fastställts. Körningen 9 oktober hade redan börjat och avbröts i upload-steget, vilket inte i sig förklaras av att en väntande körning ersatts.

Förslag: välj medveten köhantering och bevara serialisering där workflows delar publiceringsresurser. Att bara ge alla workflows separata grupper kräver först en bedömning av samtidiga R2- och git-skrivningar.

### Status och validering behöver följa hela publiceringen

Välfärdens incheckade `run.json` har exportdatum 26 september. Workflowet undviker commits när endast körningsrapport/katalog ändras och publicerar i stället `status/welfare-run.json` i R2 med no-cache. Den gamla incheckade rapporten bevisar därför inte ensam att källorna slutat hämtas.

Direktläsning av webbplatsens JSON och statusobjektet på den R2-adress som delivery.json anger gav HTTP 403 från granskningsmiljön. Det begränsar granskningen; det fastställer inte att vanlig browseråtkomst är trasig. Kontrollera aktuell R2-status och fungerande frontendåtkomst i en browser.

Workflowet laddar upp och publicerar status före `npm run data:check`. dbt-tester körs tidigare, men ett senare datakontraktsfel kan inträffa efter att R2 redan ändrats. Flytta alla relevanta leveranskontroller före publicering. Bedöm därefter behovet av versionsbundna leveranser och en sista aktivering för att undvika blandade filversioner.

En misslyckad körning uppdaterar inte dagens separata körningsrapport eftersom det steget bara nås efter lyckade tidigare steg. En gemensam rapport bör skilja senaste försök, senaste lyckade hämtning, senaste godkända publicering och senaste observation i källan. Lägg till larm för utebliven lyckad leverans med gränser per dataset. Befintliga kvalitetsmått för ålder ersätter inte sådan daglig driftbevakning.

## Prioritet

### Uppföljning: dagens offentliga data nådde timeout

Körning 38133908645 är nu avslutad med cancelled. Check-annoteringen säger uttryckligen: "The job has exceeded the maximum execution time of 1h0m0s". Jobbet började 10:59:18 UTC och avslutades 11:59:32 UTC. Välfärdssteget tog cirka 20 minuter och parlamentet cirka 38 minuter. Skattesteget började 11:57:59 och stoppades 11:59:30. Export, upload och commit hoppades över.

`refresh-welfare.yml` har `timeout-minutes: 60` för hela det sekventiella jobbet. Det är alltså inte ett belagt fel i skatte-API:t. Den aktuella körningen visar att tidsbudgeten redan nästan var förbrukad när skatt började.

Flödet är i huvudsak full hämtning och återbygge av de valda ämnena. Det bygger inte alla produkter i repot. dbt-konfigurationen har views i bronze/silver och tables i gold; detta är inte ett genomgående inkrementellt warehouse-flöde.

`taxes_ingest.py` laddar OECD:s hela valda tidsserier, kommunala skattesatser, HUT 2021 och 21 beloppssidor. För äldre withholding-år finns en skipregel när lokala filer redan finns, men workflowet återställer inte skatterådata från R2 eller cache. Regeln hjälper därför inte mellan rena runners. Riksdagens votes/studies har cache; välfärd och skatt har ingen motsvarande återläsning här. Hashjämförelsen i rawstore sker efter hämtningen och sparar därför inte nätverkstid.

Reviderad prioritet för offentliga data: ge tillfälligt jobbet tillräcklig tidsbudget för en komplett leverans, spara/återställ verifierade råfiler och dela därefter välfärd, parlament och skatt i egna leveranser. Definiera hämtpolicy per källa: aktuella perioder regelbundet, historik vid första import och kontrollerad historisk revision. Behåll periodiska fullkontroller för retroaktiva rättelser.

Finding: Offentliga data den 11 oktober stoppades av jobbets verifierade entimmesgräns innan export och publicering.
Finding: Äldre skattetabeller har en lokal skipregel, men det dagliga workflowet återställer inte deras råfiler mellan runners.

1. Låt nyheter publiceras även när sammanfattningen misslyckas.
2. Verifiera att offentliga data slutför hela kedjan efter R2-ändringen.
3. Lägg leveranskontroller före upload och gör köhanteringen uttrycklig.
4. Visa och bevaka färskhet per dataset, inklusive misslyckade försök.
5. Dokumentera manuell uppdatering separat för AI Act, tal, atlaser och DiVA.

Finding: Arbetsmarknadens leverans på main byggdes 11 oktober 2026 och streamen täcker kompletta dagar till 10 oktober.
Finding: Nyhetsleveransen på main är från 8 oktober; körningen 10 oktober stoppades av AI-sammanfattningens max_tokens före commit.
Idea: Publicera nyheterna oberoende av den valfria AI-sammanfattningen och bevaka senaste lyckade leverans per dataset.
Open question: När slutfördes senast en godkänd R2-publicering och Cloudflare-deploy för offentliga data?


## Implementerat och verifierat lokalt, 11 oktober 2026

Ändringarna nedan finns i arbetskopian. Ingen push, produktionspublicering eller ändring av secrets har gjorts. Timeouten i körning 38133908645 är fortfarande den senaste verifierade produktionsobservationen i detta uppdrag; en lyckad körning av den ändrade kedjan på GitHub återstår.

### Tidsbudget och sparade rådata

`refresh-welfare.yml` har nu 240 minuter för hela jobbet. Välfärd, parlament och skatt har steggränser på 70, 90 respektive 60 minuter. ämnesstegen använder `continue-on-error`, så senare ingestion kan köras även om ett tidigare ämne misslyckas. En sista grind kräver att alla tre byggen har lyckats före export.

Workflowet återläser rådata och manifest från befintlig R2-lagring före ingestion. Riksdagens återläsning omfattar votes, reports, studies och formation samt deras checkpoints och proveniens; talarkivet hämtas inte av detta workflow. Rådata sparas efter välfärd och parlament och i ett avslutande `always()`-steg, även vid käll- eller dbt-fel. Lagringen får bara köras efter en helt lyckad återläsning, så en misslyckad restore inte kan skriva över bucketens manifest. Det manuella warehouse-jobbet sparar också offentliga rådata vid fel efter lyckad restore.

R2-nedladdningar gör till temporära filer. Storlek och tillgänglig SHA-256 kontrolleras före atomiskt namnbyte. Rawstore kontrollerar därefter de faktiska, uppackade bytesen mot källans proveniens. äldre R2-objekt utan hashmetadata kan läsas tillbaka, men får bara användas som cache om rawstores manifest och payload stämmer. Avbrutna temporära filer laddas inte upp. `push --only raw --prune --path ...` tar bort utgångna sidor och ogiltigförklarade checkpoints inom de återlästa mapparna; andra rådatamappar berörs inte.

En sidindelad årgång eller lista återanvänds först när ett completion-record finns och samtliga namngivna filer har rätt hash. Påbörjad uppdatering tar bort föregående completion-record. Skatteverkets svar måste ha oförändrat `resultCount` och rätt antal rader på varje sida. Riksdagens listor kontrolleras mot `@traffar` när det finns. PxWeb-svar måste innehålla alla efterfrågade celler. En befintlig fil eller första sida räcker inte som bevis på komplett historik.

### Refreshpolicy

| Källa | Normal körning | Historisk revision |
| --- | --- | --- |
| SCB/FoHM via PxWeb | Metadata hämtas dagligen. Senaste två kalenderåren hämtas varje körning, även när de ryms tillsammans med historik i en liten tabell. äldre tidsdelar återanvänds när URL, body, headers och hash stämmer. | Historik hämtas igen efter 90 dagar eller vid ändrad query/dimensionsuppsättning. |
| OECD och FK:s stora tabellsvar | Verifierade svar återanvänds i högst sju dagar. FK:s metadata hämtas varje körning. CSV/JSON valideras före lagring och vid återanvändning. | Hela svaren hämtas vid utgången refreshperiod. Aktuella observationer i dessa två bulkkällor kan därmed ha upp till sju dagars hämtningsfördröjning. |
| ESS | Portalens studie- och filversioner kontrolleras varje körning. Samma filversion och variabelurval återanvänds med verifierad hash. | Ny filversion, nytt variabelurval eller 90 dagars ålder utlöser nytt download-jobb. |
| Kolada | Metadata och blocket som innehåller aktuella år hämtas varje körning. Fullständiga äldre årblock återanvänds. | Historiska block hämtas efter 90 dagar. Ett block kan omfatta 25 år; all äldre data kan därför inte undantas från det aktuella blocket. |
| Skatteverket och HUT | Kommunala skattesatser, aktuella beloppssidor och årets withholding-tabeller hämtas varje körning. Fullständiga äldre withholding-år, äldre beloppssidor och HUT 2021 återanvänds. | Historik hämtas efter 90 dagar. |
| Riksdagen | Två senaste riksmöten och två senaste utgivningsår kontrolleras varje körning. Historiska votes behöver också kompletta reports för att hela riksmötet ska kunna hoppas över. SOU, Ds och RiR har egna completion-records. | Komplett historik hämtas efter 90 dagar. Propositionsberedning läses om vid historisk revision. |

Alla tre `run_*.py` stöder `--full-refresh` och aliaset `--force`. `PORTFOLIO_FULL_REFRESH=1` gör samma sak för underliggande ingestion. Både Refresh public data och Build and store the warehouse har ett manuellt `full_refresh`-input. Det tvingar omhämtning även av giltig, färsk historik. åldersgränserna ger dessutom automatiska revisionskontroller vid ordinarie dagliga körningar.

Riksdagens propositionsberedning sparas efter varje 25 behandlade propositioner och vid avslutat försök. Saknade och misslyckade propositioner registreras som `pending_bills`; ett misslyckat försök för inget completion-record och stoppar dbt/publicering för ämnet. Redan lästa, giltiga propositioner kan återanvändas vid återstart. Tidigare giltiga poster behålls medan deras ersättare hämtas.

### Leveransgrind och samtidighet

`npm run data:check` körs nu före upload och publicering av körningsstatus. Den nya `validate_public_data.py` kontrollerar ämnenas JSON-kontrakt, ändliga JSON-tal, tabellradernas bredd och de exporterade Parquet-filernas radantal och kolumner. dbt build kör fortfarande ämnenas tester före export. Råcheckpoint är ett återstartunderlag; det innebär inte att exporten blivit godkänd.

Tre helt självständiga leveranser har bedömts men inte införts i denna ändring. Parlamentets export läser välfärdens gold-tabeller och skattebeslutens modeller använder parlamentets propositioner, studier och voteringar. Oberoende runners behöver ett kontrakt för vilken validerad version av dessa beroenden som används. Att byta till tre separata jobb utan det kontraktet skulle bryta bootstrap på en tom runner eller blanda oprövade versioner. Välfärd kan brytas ut först; därefter behöver parlament/skatt använda uttryckliga snapshots eller avgränsade modeller. Den nuvarande gemensamma exportgrinden betyder att ett ämnesfel fortfarande stoppar webbplatsens samlade leverans, även om senare ingestion och checkpointlagring fortsätter.

`concurrency.group: data-refresh` och `cancel-in-progress: false` är oförändrade i både det dagliga jobbet och det manuella warehouse-jobbet. De skriver överlappande SCB/Riksdagen-manifest och R2-objekt. Låset behöver omfatta båda writer-vägarna även efter en framtida uppdelning. Köfrågan i den ursprungliga granskningen är inte löst här. GitHub erbjuder numera `queue: max`, men ingen sådan ändring har gjorts i detta uppdrag: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#concurrency.

Dagliga jobbdata utan datacommits är fortsatt ett separat projekt. Den befintliga commitbaserade leveransen för offentliga data är kvar. Versionsbunden flerfilspublicering och driftstatus för misslyckade publiceringsförsök är också separata förbättringar; dagens upload är inte en transaktion över flera R2-objekt.

### Kontroller och kvarvarande verifiering

- Python: hela `platform/tests` passerade lokalt med 266 tester och två avsiktliga skips. På Windows används UTF-8-läge och en ny lokal basetemp, eftersom systemets gemensamma pytest-temp inte var läsbar.
- Reproducerbar cache-/återstartkontroll: `python -X utf8 -m pytest platform/tests/ingest/test_public_refresh.py platform/tests/python/test_warehouse_store.py platform/tests/architecture/test_public_refresh_workflow.py platform/tests/python/test_public_data_contracts.py -q --basetemp <ny-lokal-testmapp>`. Testerna täcker tom cache, andra körningen, aktuell data, avbrutna sidor/propositioner, force, utgången policy, ändrad query, korruption, saknad proveniens, avbrutet manifest, gamla R2-sidor och återläsning på en ny runner.
- dbt: hela projektet kunde parsas. `python -X utf8 platform/tests/ingest/verify_public_refresh_dbt.py` byggde verkliga bronze/gold-modeller från små lokala rowstore-fixtures. Befintliga plausibilitets- och unikhetstester passerade. Resultatet innehåll 290 kommuner för både historiskt och aktuellt år; andra körningen behåll historiska 32 procent och uppdaterade aktuella 33 procent. Fixturevärdena finns bara i testets temporära warehouse.
- Nätverksbesparing: rowstore-testet gör från sex sidförfrågningar vid bootstrap till tre vid andra körningen, samtliga för aktuellt år. PxWeb-testet gör från två datadelar till bara den aktuella delen. R2-testet återläser en komplett årgång till en ny runner och gör noll nya historiska källförfrågningar. OECD/FK hoppar över sina stora svar inom sju dagar; ESS hoppar över download-jobbet när den publicerade versionen stämmer. Ingen tung full ingestion har körts här. Produktionsruntime har därför ingen ny uppmätt minutangivelse.

Återstående externa beroenden är fungerande käll-API:er, GitHub-runnern och R2-behörighet för läsning, skrivning och borttagning inom rådataprefixen. Nästa verifiering är en godkänd körning av den ändrade kedjan i GitHub Actions och därefter en andra daglig körning med återanvändning. Bootstrap kan behöva hämta tidigare råfiler en gång om deras gamla manifest eller completion-records saknas. Global `npm run data:check` och komplett live-dbt har inte körts lokalt mot produktionskällor; workflowet kräver dem före leverans.

Decision: Behåll gemensamt writer-lås och leveransgrind tills ämnenas korsberoenden har ett uttryckligt snapshotkontrakt.
Decision: återanvänd verifierade rådata med completion-records och tidsbegränsad refreshpolicy, med full-refresh för revisioner.
Finding: Lokal verifiering visar att komplett historik återanvänds efter runnerbyte och att avbrutna sidor eller propositioner inte blir komplett cache.
Open question: Hur lång tid tar bootstrap respektive nästa dagliga körning med dessa ändringar i GitHub Actions?


### Ändrade filer i denna implementation

- Workflows: `.github/workflows/refresh-welfare.yml`, `.github/workflows/build-warehouse.yml`.
- Cache och hämtpolicy: `platform/lib/rawstore.py`, `platform/lib/pxweb.py`, `platform/ingest/run_welfare.py`, `platform/ingest/run_parliament.py`, `platform/ingest/run_taxes.py`, `platform/ingest/taxes/taxes_ingest.py`, `platform/ingest/ess/ess_ingest.py`, `platform/ingest/fk/fk_ingest.py`, `platform/ingest/kolada/kolada_ingest.py`, `platform/ingest/riksdagen/history_ingest.py`, `platform/ingest/riksdagen/studies_ingest.py`.
- Lagring och leveranskontroll: `platform/publish/warehouse_store.py`, `platform/publish/export_welfare.py`, `platform/publish/validate_public_data.py`.
- Verifiering: `platform/tests/ingest/test_public_refresh.py`, `platform/tests/ingest/verify_public_refresh_dbt.py`, `platform/tests/architecture/test_public_refresh_workflow.py`, `platform/tests/python/test_warehouse_store.py`, `platform/tests/python/test_public_data_contracts.py`.
- Dokumentation: `docs/ingestion-review.md`. Filens tidigare granskning och timeoutuppföljning har bevarats; implementerat slutläge har lagts till.

Den lokala dbt-kontrollen använde dbt-core 1.12.5 och dbt-duckdb 1.11.0. Workflowets requirements ligger kvar på repots dbt-core 1.12.4. dbt rapporterade befintliga deprecations för generic test-argument i andra ämnen. Dokumentationens språkgranskare rapporterade noll träffar. `git diff --check` passerade för implementationens spårade filer. Inga frontend-, design- eller CV-filer har ändrats av detta uppdrag.
