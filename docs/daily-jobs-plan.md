# Plan för dagliga jobbdata utan datacommits

Datum: 11 oktober 2026. Förslag till genomförande; ingen pipeline eller frontend har ändrats.

## Rekommendation

Behåll ingestion och dbt i GitHub Actions. Publicera den validerade arbetsmarknadsfilen direkt till R2 och låt frontend läsa den därifrån. En kodrelease behövs för att byta läsväg. Därefter ska dagliga datauppdateringar fungera utan git commit, push eller Cloudflare-build.

Detta återanvänder befintliga Python-skript, dbt-modeller, R2-klient och frontendens dataläsare. En ny databas eller ett nytt API behövs inte för att leverera den enda sammanhållna filen `jobs/market.json`.

## Vad daglig uppdatering betyder

Målet gäller hela arbetsmarknadens dagliga annonsstatistik. Den senaste godkända leveransen ska innehålla kompletta streamdagar till föregående kalenderdag i Europe/Stockholm. Visa separat vilken period månadsstatistiken täcker.

Nuvarande ingestion innehåller redan daglig stream och frontend har `RecentDays`. Månadsserien använder bara hela täckta månader. Ett färskt datum på exporten innebär inte att den senaste månaden är fullständig.

Detta är statistik över publicerade annonser, inte en katalog över alla just nu aktiva jobb. Streamen räknar första observerade publicering och behåller tidigare räknade annonser även efter borttagning. Annonser som hinner publiceras och tas bort mellan hämtningarna kan missas; dagliga tal ska fortsatt märkas preliminära.

Den äldre IT-rapportens årsarkiv och ML-kluster får ett separat flöde. Daglig publicering av marknadsfilen ska inte vänta på att ett stort årsarkiv eller klusterexperiment blir klart.

## Alternativ

| Lösning | Vad den innebär | Bedömning |
| --- | --- | --- |
| Fortsätta med datacommits | Data läggs i frontendbygget och varje uppdatering publicerar sajten | Fungerar men kopplar dataleverans till git och deploy |
| Actions bygger, R2 levererar | Befintlig pipeline skriver JSON direkt till objektlagring | Rekommenderas för denna produkt |
| Worker läser från R2 på samma domän | Ett litet data-endpoint framför samma filer | Alternativ om direkt R2-läsning hindras av domänåtkomst eller CORS |
| Flytta ingestion till Cloudflare Cron | Schemalagd Worker eller annan Cloudflare-körmiljö hämtar data | Separat driftprojekt; befintlig Python/dbt-kedja behöver bedömas för den körmiljön |

Cloudflare Cron erbjuder schemalagda handlers, men schemaläggning och var Python/dbt faktiskt körs är olika val. Vi kan byta schemaläggare senare utan att byta datakontraktet.

## Leveranskedja

`JobTech → sparad streamstate i R2 → Python/dbt → kontrollerad market.json → R2 → frontend`

Kod och data har därefter egna livscykler. Git behåller kod, schemas och lämpliga testfixtures. R2 behåller publicerade data och körningshistorik. Varje leverans registrerar kodens commit-SHA för spårbarhet, men skapar ingen ny commit.

### 1. Verifiera R2 som publik leverans

Kontrollera `data.antonernstsson.com` eller konfigurera en fungerande R2 custom domain. Granskningen av ingestionen fick HTTP 403 vid direktläsning från granskningsmiljön, så browseråtkomst måste verifieras innan läsvägen byts.

Kontrollera GET och HEAD från produktionssajten, preview och localhost, inklusive tillåtna origins i `platform/publish/r2-cors.json`. Konfigurera kort cache för den aktuella jobbfilen och no-cache för driftstatus. Kontrollera både objektets headers och Cloudflares cache-regler; R2-cache styrs inte av frontendens `_headers`.

Acceptans: browsern kan läsa en testfil via den avsedda produktionsvägen utan CORS- eller behörighetsfel. Ett ersatt testobjekt blir synligt inom högst fem minuter med den valda cachekonfigurationen.

### 2. Publicera marknadsfilen som en egen leverans

Återanvänd `platform/publish/upload.py` för R2-klient och credentials. Lägg till en avgränsad publicering av jobbfilen. Nuvarande uploader väljer katalogfiler efter deras formatbas; den skickar inte automatiskt den lokalt klassificerade jobb-JSON-filen till R2.

Föreslagen struktur:

```text
jobs/market.json                   senaste godkända fullständiga fil
jobs/releases/<release-id>.json    sparad version av samma fil
status/jobs-run.json               senaste försök och senaste godkända publicering
```

Validera exporten, spara en version och läs tillbaka den med hashkontroll. Ersätt sedan den stabila `jobs/market.json` med hela godkända filen. Eftersom produktens data ligger i ett objekt behövs ingen flerfilstransaktion eller separat dynamisk pekare i första versionen. R2 har stark read-after-write-konsistens, men eventuell CDN-cache måste hanteras separat.

Registrera release-id, schema_version, kod-SHA, publiceringstid, senaste kompletta dag och innehållshash. Behåll exempelvis 30 dagars versioner som föreslagen retention; fastställ policyn vid genomförandet. Rollback kopierar en tidigare godkänd version till den stabila filen och verifierar den publika läsvägen.

Acceptans: ingen aktuell fil ändras om export eller kontroll misslyckas. En tidigare version kan återställas utan sajtdeploy.

### 3. Byt endast jobbfilens läsväg

Utöka den gemensamma resolverns leveranskontrakt med en explicit URL för `jobs/market.json`, eller använd motsvarande befintlig mekanism om sådan tillkommit. Verifierade filer att utgå från: `frontend/src/dataSource.ts`, `platform/publish/build_catalog.py` och `frontend/src/jobb/data.ts`.

Flytta inte alla JSON-filer till R2 genom att ändra den globala JSON-basen. Det skulle samtidigt ändra flera andra produkters leverans. Modellera jobbfilens avvikelse uttryckligt och håll generator, resolver och katalogvalidering överens.

Behåll en daterad lokal fixture för tester och lokal utveckling. Om produktion inte kan läsa fjärrfilen ska besökaren få ett tydligt felläge eller föregående data med dess verkliga datum. En gammal lokal snapshot får inte presenteras som en färsk leverans.

`loadMarket()` behåller nu ett Promise under hela sidans livstid. Tillåt återförsök efter ett misslyckande och ny hämtning när sidan åter blir aktiv efter den valda cachetiden. Undvik aggressiv polling; ny sidladdning och återgång till en äldre öppen flik ska räcka för daglig statistik.

Acceptans: ett nytt R2-objekt syns på en oförändrad sajt inom cachegränsen. Navigering, filter och lokala tester fungerar fortfarande.

### 4. Dela daglig ingestion från tunga analyser

Ändra `.github/workflows/refresh-jobs.yml` till följande sekvens:

1. Läs sparad streamstate och arkivräknare från R2.
2. Hämta nya/ändrade arkiv och streamfönster.
3. Spara giltiga checkpoints så nästa försök kan fortsätta efter ett avbrott.
4. Bygg `tag:market`, kör dbt-tester och exportera jobbfilen.
5. Kontrollera exportens schema, datum och summeringar.
6. Publicera och verifiera R2-leveransen.
7. Skriv driftstatus; vid fel behåll senaste lyckade leverans och registrera det misslyckade försöket.

Ta bort commit/push från detta dagliga jobb efter att frontendbytet verifierats. Minska GitHub-tokenens behörighet till läsning. Flytta den äldre IT-rapportens arkivbygge till ett separat workflow så dess fel inte hindrar daglig statistik.

Dagliga jobbet ska inte dela den generella `data-refresh`-kön med oberoende ämnen. Ge det en egen grupp och behåll en aktiv writer för JobTech-state och marknadsleverans. Det manuella warehouse-jobbet skriver samma JobTech-state och måste respektera samma lås eller avstå från dessa skrivningar. Att bara byta grupp på refresh-jobbet räcker inte.

Acceptans: två samtidiga JobTech-körningar kan inte skriva över varandras checkpoints; nyheter och välfärd blockerar inte jobbstatistiken. Ett avbrott kan köras om utan dubbelräkning.

### 5. Gör färskhet synlig och bevakad

Visa nära den dagliga grafen:

- Senast lyckade publicering.
- Senaste kompletta statistikdag.
- Senaste hela månad i historik/månadsserien.
- Att streamvärden är preliminära.

Skriv status även när hämtningen misslyckas. Skilj senaste försök, senaste lyckade hämtning och senaste lyckade publicering. Noll annonser en dag är ett möjligt värde och får inte förväxlas med att data saknas.

Föreslagen driftregel: varna när senaste kompletta dag ligger mer än två kalenderdagar efter dagens datum, eller när ingen godkänd publicering skett på 36 timmar. Gränserna är föreslagna produktkrav. Ett larm måste nå en övervakad kanal; välj mottagare vid konfigureringen. Ingen extern notifiering har skickats i denna planering.

Behåll ett dagligt huvudschema och lägg till ett senare återhämtningsförsök som är idempotent. GitHub varnar för att schemalagda körningar kan fördröjas eller tappas. För ett bindande leveransmål före ett visst klockslag behövs oberoende bevakning och eventuellt en extern trigger; ytterligare en cron i samma system ger inte den garantin.

Acceptans: ett simulerat misslyckande ger gammal men tydligt daterad data och ett detekterbart driftfel. En lyckad återkörning återställer färskheten.

## Kontroller och införande

Återanvänd `platform/tests/ingest/test_jobtech_stream.py`. Komplettera där det saknas kontroller för återstart/checkpoints och utbytet mellan stream och arkiv. Verifiera exportens fält, giltiga dagar och att totalsiffrorna stämmer mot källräknarna. Kräv täckning till gårdagen när en körning påstår att den har hämtat fram till i dag. Datumet ska komma från ingestionens täckning, inte från den senaste dag som hade minst en annons.

Testa läsvägen och rollback med två olika godkända leveranser. Testa nätverksfel, cache och en browserflik som varit öppen över en publicering. Läs tillbaka och verifiera publicerade bytes; metadata med en sparad hash är inte ensam en kontroll av payloaden.

Inför i denna ordning:

1. Publicera parallellt till R2 under flera dagliga körningar. Behåll dagens commitbaserade leverans under provperioden och jämför filernas innehåll.
2. Lägg frontendbytet i en separat kodrelease och granska preview med R2-data.
3. Efter verifierad produktionsläsning, stäng av datacommits för marknadsfilen.
4. Verifiera flera följande dagliga körningar, ett återförsök och en rollback. Uppdatera `docs/storage-and-serving.md`, `docs/deploy.md` och ingestiongranskningen.

För frontend- och pipelineändringar används repots ordinarie typ-, format-, unit-, Python- och e2e-kontroller. Inga sådana implementationstester har körts för denna plan, eftersom ingen produktkod har ändrats.

## Källor

- https://developers.cloudflare.com/r2/buckets/public-buckets/ beskriver custom domains och att r2.dev är för utveckling.
- https://developers.cloudflare.com/r2/reference/consistency/ beskriver objektkonsistens och hur cache kan ge gamla svar.
- https://developers.cloudflare.com/r2/buckets/cors/ beskriver browseråtkomst och CORS.
- https://docs.github.com/en/actions/how-tos/troubleshoot-workflows beskriver fördröjda eller tappade schemakörningar.
- https://developers.cloudflare.com/workers/configuration/cron-triggers/ beskriver alternativet Cloudflare Cron.

Idea: Publicera arbetsmarknadens dagliga JSON direkt till R2 från befintlig Actions-pipeline, med en separat kodrelease för frontendens läsväg.
Idea: Skilj den dagliga marknadsleveransen från äldre IT-rapporter och tunga klusterbyggen.
Idea: Behåll daterade leveransversioner och gör rollback möjlig utan git eller sajtdeploy.
Open question: Räcker daglig uppdatering med återförsök, eller krävs ett leveransmål före ett bestämt klockslag?
