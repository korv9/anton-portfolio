# Flytta löpande data till R2

Datum: 11 oktober 2026. Förslag till migration av hela dataleveransen. Detta ersätter jobbdataplanens begränsade mål med en gemensam riktning för alla produkter. Ingen data har flyttats eller tagits bort genom denna planering.

## Mål

Git versionerar kod, modeller, scheman, dokumentation och små testfixtures. R2 lagrar rådata, warehousekopior, ML-artefakter och webbplatsens publicerade dataset. En godkänd datauppdatering blir synlig utan git commit, push eller sajtbygge. Kodändringar deployas fortfarande som vanligt.

Behåll ingestionens Python/dbt-miljö i GitHub Actions. R2 är lagringen och leveransplatsen, inte exekveringsmiljön för dbt. Schemaläggning kan ändras separat om driftkraven motiverar det.

## Befintligt stöd och luckor

`warehouse_store.py` kan redan spara och återläsa rådata, DuckDB och features. `upload.py` laddar redan upp katalogiserade fjärrfiler. `dataSource.ts` har en central URL-resolver. R2-publicering behöver därför utökas, inte byggas från början.

Nuvarande katalog har JSON-basen `data/`, medan Parquet och shards använder R2. Frontend hämtar fortfarande `data/delivery.json` från sajtbygget. `upload.py` väljer bara format med fjärrbas i katalogen. En ändring av JSON-basen räcker därför inte ensam: levande manifest, katalog, uppladdning, tester och äldre byggares indata måste också ändras.

## Fördelning

| Innehåll | Plats efter migration |
| --- | --- |
| Råfiler, checkpoints, källmanifest och warehouse | Privat R2-lagring med autentiserad åtkomst |
| Features och interna modellartefakter | Privat R2-lagring |
| Godkända JSON/Parquet, dokumentshards och publicerade analysfigurer | Publik R2-lagring |
| Kod, dbt-modeller, schemas, små seeds och testfixtures | Git |
| Secrets | GitHub/Cloudflare secrets |

Återanvänd det befintliga bucketupplägget när det passar, men separata prefix i en publik bucket är inte i sig privat åtkomst. Privat rådata bör ligga i en privat bucket eller bakom en verifierad åtkomstgräns. Inventera befintlig publicitet innan filer flyttas.

## Genomförande

### 1. Inventera alla byggindata och leveranser

Utgå från katalogen och befintliga exportkommandon. Skilj trackade upstreamsnapshots från genererade data och små testfixtures. Säkerställ att frysta källor kan hämtas autentiserat från R2 med verifierad hash innan deras arbetskopior tas ur Git.

Dokumentera vilka filer varje workflow äger, inklusive delade schemas och korsproduktresultat. Det manuella warehouse-jobbet sparar warehouse men ersätter inte automatiskt export och aktivering av alla frontendfiler.

### 2. Verifiera datadomän och läsåtkomst

Använd en R2 custom domain som `data.antonernstsson.com` för publika leveranser. Verifiera GET/HEAD, Range för Parquet och CORS för produktion, preview och localhost. Lokala tester ska kunna använda små fixtures utan nätverk.

Custom domains är Cloudflares rekommenderade produktionsväg; r2.dev är för utveckling. Att en autentiserad S3-klient fungerar bevisar inte att browsern kan läsa samma filer.

### 3. Publicera versionsbundna leveranser

Ladda först upp varje godkänd leverans till en ny versionsadress. Kontrollera schemas, datakontrakt, bytes och att samtliga refererade filer finns. Aktivera leveransen först därefter genom ett litet manifest.

Exempel på logiskt upplägg:

```text
releases/market/<release-id>/...
releases/public-data/<release-id>/...
releases/news/<release-id>/...
manifests/market-current.json
manifests/public-data-current.json
manifests/news-current.json
status/...
```

Gruppera filer som måste vara konsistenta tillsammans. Ett enskilt R2-objekt är starkt konsistent, men flera PUT-operationer är inte en flerfilstransaktion. Ett manifest som aktiveras sist gör att browsern kan läsa en sammanhängande version. Oförändrade filer kan återanvändas genom redan verifierade versionsadresser.

Använd en writer per publiceringsgrupp. Oberoende ämnen ska inte skriva över varandras manifest. Om ett gemensamt toppmanifest används måste uppdateringen sammanfoga aktiva versioner under ett gemensamt lås. Korsproduktleveranser kräver uttryckliga kompatibilitetskontroller.

Behåll tidigare versioner för rollback och fastställ retention. Ett misslyckat försök får uppdatera driftstatus, men ska inte aktivera delvis färdig data. Status ska skilja senaste försök från senaste godkända publicering.

Katalogens hashning normaliserar nu CRLF för alla filer. Ändra verifieringskonventionen så binärfiler som Parquet hashas över exakta bytes; eventuell textnormalisering måste vara explicit och konsekvent. Versionshöj katalogkontraktet vid behov och bevara verifieringen av tidigare leveranser under övergången.

### 4. Låt frontend läsa levande manifest från R2

Ändra `dataSource.ts` och kataloggeneratorn gemensamt. Frontend behöver en stabil bootstrapadress för fjärrmanifesten; dagens inbyggda `delivery.json` får inte behöva deployas på nytt för varje datarelease.

Behåll de logiska paths som komponenterna redan använder. Resolvern väljer aktiv leveransgrupp och dess versionsbas. Bind ihop läsningarna inom en vy till samma release. Hämta nya manifest vid återgång till en äldre flik eller explicit uppdatering; uppdatera inte bara halva en beroende datamängd.

Versionsfiler får lång cache. Aktiveringsmanifest och status får kort cache eller revalidering. Verifiera Cloudflares cache-regler tillsammans med objektets headers. Frontendens `_headers` styr inte R2-domänens cache.

Granska direkta URL:er, nedladdningslänkar och `parquet.ts`, som i dag kan falla tillbaka till sajtens lokala kopia. Produktionsfel ska visa ett tydligt felläge eller en daterad tidigare version, inte tyst blanda lokalt och fjärrpublicerat innehåll.

### 5. Gör workflows oberoende av datacommits

Byt samtliga datarefreshers från commit/push till export, validering, uppladdning och aktivering. Detta gäller jobb, offentliga data, nyheter och DiVA. Koppla även manuella export- och ML-flöden till samma publiceringskontrakt när deras resultat ska bli publika.

Rådata/checkpoints sparas separat från publicerad analys. Kontrollera återstart och lås mellan scheduled refresh och manuellt warehousebygge. En uppdatering av en valfri AI-sammanfattning ska inte stoppa aktivering av godkända nyhetsposter.

Efter migrationen behöver refreshjobben normalt inte contents: write. Behåll read för kodcheckout och ge publiceraren R2-behörighet för de objekt den ansvarar för.

### 6. Frikoppla byggen och tester från frontend/public/data

Flytta genererade exporter till en uttrycklig stagingplats, exempelvis under warehouse/delivery, och konfigurera publiceraren att läsa där. Anpassa kataloggenerator och exportskript genom gemensamma paths, utan att samtidigt skriva om deras analyslogik.

`legacy/build_gold.py` använder fortfarande frontendleveranser som byggindata. Låt det återläsa den avsedda låsta källversionen eller migrera ämnet till warehousemodeller innan motsvarande lokala indata tas bort.

En ren checkout ska kunna bygga frontend med Node och köra beräkningstester med små fixtures. Data-integrationstester får hämta en uttrycklig release från R2; dessa ska separeras från vanliga offlinekontroller. CI får inte börja läsa en rörlig produktionsversion när det avser att verifiera reproducerbarhet.

### 7. Ta genererad data ur Git sist

Publicera först parallellt och jämför resultaten. Byt frontend i en kodrelease, verifiera verklig browserläsning och minst en efterföljande datauppdatering utan sajtdeploy. Därefter kan genererade data tas ur Git-index och ignoreras. Behåll fixtures, schemas och avsedda seeds genom tydliga undantag eller egna mappar.

`.gitignore` påverkar inte redan trackade filer. Flytten kräver en engångscommit som ändrar kod och tar bort genererade filer från den aktuella trädversionen. Tidigare Git-historik ligger kvar; historikomskrivning är ett separat beslut och behövs inte för att stoppa nya datacommits.

## Acceptanskriterier

- En ren checkout bygger frontend utan produktionsdataset i Git.
- Alla publika analysfiler läses från en godkänd R2-release.
- En datauppdatering når browsern utan ny kod-SHA eller sajtdeploy.
- Avbruten upload lämnar föregående godkända release aktiv.
- Rollback och nätverksfel är verifierade.
- Byggindata och fixtures är versionsbundna och reproducerbara.
- Dagliga workflows gör inga datarelaterade git push.

## Källor

- https://developers.cloudflare.com/r2/buckets/public-buckets/
- https://developers.cloudflare.com/r2/reference/consistency/
- Repo: dataSource.ts, build_catalog.py, upload.py, warehouse_store.py och befintliga refreshworkflows.

Decision: Målriktningen är att lagra löpande rådata, bearbetade dataset och publika analysleveranser i R2 och behålla kod samt små fixtures i Git.
Idea: Aktivera versionsbundna leveranser per beroendegrupp med ett litet fjärrmanifest som publiceras sist.
Idea: Ta genererade data ur Git först efter verifierad R2-läsning, reproducerbara tester och rollback.
