# Versionsbunden dataleverans från R2

Implementerat 13 oktober 2026. Kontraktet använder befintlig R2-bucket och
`upload.client()`. Ingen produktionsaktivering eller extern konfiguration har
gjorts i denna uppgift. Workflowintegration och första driftprov ägs av koordinatorn.

## CLI och gruppägarskap

`platform/publish/release.py` publicerar godkända exporter från en uttrycklig
stagingrot. Roten kan vara `frontend/public/data` eller `warehouse/delivery/public`.
Alla paths i spec och manifest är relativa till dataroten, exempelvis
`jobs/market.json`, `parliament/news.json` och
`politics/parliament/issues/1993-94/gh092.json`.

```sh
python platform/publish/release.py materialize --root warehouse/delivery/public --spec configs/delivery/jobs.json --catalog frontend/public/data/catalog.json
python platform/publish/release.py publish --group jobs --root warehouse/delivery/public --spec configs/delivery/jobs.json
```

Exportören skriver sina nya resultat i stagingroten före `publish`. Materialisering
behövs när en grupp också omfattar filer som tidigare flyttats till R2. Befintliga
lokala exporter ersätts aldrig av materialiseringen. Kommandot läser tillbaka
saknade filer, kontrollerar hash och storlek och skriver bara verifierade bytes.
Ett avbrott kan lämna en delvis fylld stagingrot, men påverkar inget aktivmanifest.

För återställning före ny ingestion finns `materialize --prefer-active`. Flaggan
ersätter även befintliga lokala filer med gruppens aktiva hashverifierade bytes.
Nyhetsjobbet ska använda den före fetch/sammanfattning: om AI-steget misslyckas
behålls därmed den senaste godkända R2-sammanfattningen, även när checkouten har
en äldre kopia. Materialisering efter en ny export ska använda standardläget,
som bevarar färska lokala filer. Om filen ännu inte har en aktiv R2-version
behåller även `--prefer-active` en befintlig lokal export.

`publish --code-sha` accepterar en Git-SHA. Utan flaggan återanvänds
`warehouse_store.git_commit()`. Resultatet är JSON på stdout och fel ger exitkod 1.
Uppladdningsklienten läser samma befintliga R2-miljövariabler som `upload.py`.
Ingen bucket, domän, credential eller betaltjänst skapas.

Grupperna ersätts som helheter. Den dagliga gruppen `jobs` äger endast
`jobs/market.json`; årsrapporter och ML-filer får en separat grupp, exempelvis
`jobs-analysis`. `news` äger `parliament/news.json` och, om den finns, tidigare
godkänd `parliament/news-summaries.json`. `public-data` omfattar välfärd,
parlamentets sex publika kontrakt, skatter, deras Parquet och exporterade schemas.
`diva` och andra manuella grupper använder samma kontrakt. `baseline` kan hålla
övriga godkända exporter vid migrationen. Exakta workflowval ligger i
`configs/delivery`, som koordinatorn äger.

Två grupper får aldrig äga samma logiska path. `files`, `include` och `exclude`
ska uttrycka filägarskapet, inklusive index, shardfiler, alla Parquetdelar och
filer för nedladdning. Att katalogen omfattar en fil betyder inte att den är
tillåten att publicera utan gruppens explicita urval.

## Spec version 2

```json
{
  "schema_version": 2,
  "files": ["parliament/news.json"],
  "optional_files": ["parliament/news-summaries.json"],
  "schemas": {"parliament/news.json": "configs/delivery/schemas/news.json"}
}
```

`files` kräver att varje fil finns. `include` och `exclude` är fnmatch-mönster:
`welfare/*` matchar även underkataloger; `*` täcker hela stagingroten.
Varje include måste matcha minst en känd fil. Urvalet omfattar både lokala filer
och katalogiserade, offloadade paths. En saknad vald fil stoppar publiceringen.
`exclude` tillämpas sist. Kontrollfilerna `catalog.json`, `delivery.json` och
`offloaded.json` får inte publiceras som dataset.

`optional_files` tillåter en fil som aldrig har funnits att vara frånvarande.
En fil som finns lokalt, i katalogen eller i gruppens tidigare aktiva leverans
får däremot inte tappas av misstag. Saknade tidigare filer ska materialiseras.
Det bevarar en äldre nyhetssammanfattning med dess ursprungliga datum när den
valfria sammanfattningen misslyckas. Publishern utför ingen AI-sammanfattning.

`schemas` mappar JSON-path till ett lokalt JSON Schema. `checks` är en lista av
argv-listor; `{root}` ersätts med stagingrotens absoluta path. De körs utan shell,
före uppladdningen. Källorna till kontrollskripten och schemana stannar lokalt;
manifestet innehåller inga lokala sökvägar eller kommandon.

Alla JSON-filer parsas med förbud mot NaN/Infinity. Parquet läses med befintlig
PyArrow. För `public-data` krävs hela det befintliga kontraktet i
`validate_public_data.py`; kontrollerna omfattar kolumner, rader och godkända
dbt-tester. Efter kontrollerna kontrolleras att de frysta exportbytesen inte
ändrades på disk. Befintliga specialkontroller kan kopplas in genom `checks`.

`references` mappar en fil till andra paths som måste ingå i samma grupp.
Dokumentindex med `path`, `index_path` eller `shard_path` kontrolleras automatiskt,
liksom Parquetreferenser i `welfare/datasets.json`. Relativa indexpaths löses mot
den närmaste produktroten. Alla filer som hör ihop ska följa med gruppen.

`dependencies` mappar andra gruppnamn till fullständiga release-id:n, 64 hextecken.
Både den nya gruppens beroenden och befintliga gruppers beroenden kontrolleras
mot hela kandidaten. En uppdatering som gör en befintlig konsument inkompatibel
stoppas. Ämnen med täta korsproduktberoenden ska ligga i samma grupp, eller
publiceras och aktiveras tillsammans som ett bundle med låsta versioner.
`coverage` accepterar endast datumsträngar för `generated_at`,
`latest_complete_day`, `last_month`, `period_start` och `period_end`.

## Objekten och aktiveringsordningen

```text
releases/<group>/<release>/files/<logical-path>
releases/<group>/<release>/indexes/<exact-payload-sha256>.json
releases/<group>/<release>/manifest.json
manifests/current.json
```

Release-id är SHA-256 över de exakta filhasharna, beroendeversionerna och
kontrollkontraktet. Gruppmanifestet har `schema_version`, `group`, `release`,
`published_at`, `code_sha`, `coverage`, `dependencies`, `files` och `indexes`.
Varje filpost har `key`, `sha256` och `bytes`. Gruppmanifestet läses av publishern,
inte av browsern.

Publishern fryser och validerar gruppen, laddar upp filer med villkorad create,
läser tillbaka varje payload och kontrollerar hash och storlek. Därefter görs
samma kontroll för filindex och gruppmanifest. Oförändrade objekt återanvänds
efter faktisk återläsning. Metadatahash ensam räcker inte.

Aktivmanifestet har `schema_version: 2`, `snapshot`, `activated_at`, `groups` och
`routes`. En grupppekare har `key`, `sha256`, `bytes`, `release`, `published_at`
och `dependencies`. En route har `first`, `last`, `group` och `index`, där index
pekar på en hashverifierad JSON-fil med högst 100 filposter. `first` och `last`
är inkluderande lexikografiska gränser över logiska paths. Browsern hämtar bara
index för efterfrågade paths. En startsida behöver inte hämta hela katalogen eller
baselinegruppens alla shards.

Aktiveringen återläser aktuellt snapshot, sammanfogar ersatta grupper och
kontrollerar ägarskap och beroenden. Sista skrivningen är en villkorad PUT av
`manifests/current.json`: `If-None-Match: *` första gången, annars `If-Match` med
föregående ETag. R2:s [S3-kontrakt](https://developers.cloudflare.com/r2/api/s3/api/)
stöder dessa villkor. Befintlig boto3-version accepterar båda parametrarna.

En konflikt ger fel utan en ovillkorad retry. Kör om från det aktuella snapshotet
och kontrollera beroenden på nytt. Publishern avvisar också en konkurrerande
ändring av samma grupp som inträffade under uppladdningen. Oberoende grupper som
uppdaterades före aktiveringsläsningen bevaras. Använd en workflowwriter per grupp
och köa körningar med `cancel-in-progress: false`; samtidiga bundleaktiveringar
ska samordnas med dessa writers. En automatisk retry får inte återanvända ett
utgånget beroendeval.

Upload- eller verifieringsfel före sista PUT lämnar tidigare aktiv leverans
oförändrad. Vid tappat svar efter den sista PUT-operationen kan utfallet vara
okänt för klienten: återläs aktuellt snapshot innan retry. Försök inte återställa
hela toppmanifestet ovillkorat, eftersom det kan radera en annan grupps uppdatering.
Misslyckade försök kan lämna oaktiverade versionsobjekt; ingen automatisk radering
eller offload ingår.

## Bootstrap och rollback

Första kodrelease med live resolver ska ske efter en komplett godkänd bootstrap.
Använd `publish --stage-only` för varje grupp: kommandot returnerar en verifierad
grupppekare och skriver inget aktivmanifest. Samla release-id:n och kör därefter
`activate --release GROUP=RELEASE` en gång, med flaggan upprepad för alla grupper.
Kommandot verifierar åter filer och index och aktiverar hela kandidaten med en PUT.
Detta undviker en första jobs-leverans som lämnar resten av sajten utan data.
Samma kommando kan uppdatera flera korsproduktgrupper tillsammans.

`rollback --group GROUP --release RELEASE` väljer en tidigare verifierad release.
Alla payloads och index läses tillbaka igen. Ägarskap, beroenden och villkorad
aktivering gäller även rollback. Ett saknat eller skadat gammalt objekt stoppar
återställningen. Oberoende grupper lämnas kvar. Retention behöver fastställas av
driften; håll tidigare godkända releaser tillgängliga tills den policyn är beslutad.

## Schemaövergång och frontend

Kataloggeneratorn har version 2 och använder exakt SHA-256 och exakt storlek för
nya filer, även CRLF och Parquet. Redan offloadade katalogposter i version 1
behåller sin version och markeras `sha256-crlf-normalized`. Materialisering
verifierar deras historiska CRLF-normaliserade hash, återställer originalbytesen
och låter nästa publish skapa en ny exakt hash. Detta är endast läskompatibilitet;
ny publicering normaliserar inga payloads.

`build_catalog.py --root STAGING` stöder annan exportrot. Kör generatorn med
`R2_LIVE_DELIVERY=1` för att lägga in en stabil `manifest_url` från befintlig
`R2_PUBLIC_BASE`, eller ange `R2_MANIFEST_URL` explicit. Frontend kan också byggas
med `VITE_R2_MANIFEST_URL`. Endast denna engångskonfiguration måste följa med
kodreleasen. Dagliga uppdateringar kräver inget nytt inbyggt `delivery.json`.

Utan livekonfiguration fortsätter resolverns schema1-formatbaser att fungera.
`VITE_DELIVERY_MODE=local` väljer uttryckligen lokala `data/`-filer för utveckling
och reproducerbara offlinefixtures. På localhost tillåts saknat bootstrapmanifest
och Parquetfallback för äldre lokala leveranser. I live mode stoppar fel även på
localhost; produktionsfel får aldrig falla tillbaka till gamla lokala siffror.

Browsern låser toppsnapshotet och dess versionsadresser under sidans livstid.
JSON, index, Parquet och nedladdningar via `resolveDataUrl` använder samma lås.
`fetchData` ger ett fel med HTTP-status och leveransdatum. Saknad path eller
hashfel i ett index ger också fel. `objectStorageUrl` är kvar för separat driftstatus.

`refreshDelivery()` återvaliderar toppmanifestet och laddar om hela sidan när
snapshotet ändrats. Samma kontroll sker när en äldre flik blir synlig. Full
omladdning tömmer även komponenternas egna Promise-cacher och hindrar blandade
versioner. Ett refreshfel behåller tidigare snapshot och skickar `delivery-error`;
`deliveryState()` ger aktivt datum, gruppers publiceringsdatum och
`lastRefreshError`. Vyerna kan använda detta för daterad tidigare leverans och
felmeddelanden utan att byta datasource. Ingen komponentcopy har ändrats här.

## Cache, browseråtkomst och driftberoenden

Versionsobjekt, index och gruppmanifest har
`Cache-Control: public, max-age=31536000, immutable`. Aktivmanifestet har
`no-cache, max-age=0, must-revalidate`; browsern använder `cache: no-cache`.
Cloudflares cache-regler måste respektera dessa headers. Frontendens `_headers`
styr inte R2-domänen. Separat driftstatus ska ha kort cache och aldrig ersätta
en datasetleverans.

Publik GET/HEAD, Parquet och filnedladdning ska fungera på den befintliga
R2-adressen. Produktionsleveransen behöver en fungerande custom domain, som
[R2 rekommenderar för produktion](https://developers.cloudflare.com/r2/buckets/public-buckets/).
Saknad custom domain är ett driftberoende, inte ett hinder för implementationen.
Befintlig r2.dev-bas är kvar under övergången. Ingen ny domän har skapats.

Kontrollera CORS mot de verkliga produktions-, preview- och localhostorigins.
`platform/publish/r2-cors.json` har GET/HEAD, Range och exponering av ETag,
Content-Length och Content-Range. Verifiera att den befintliga bucketens faktiska
konfiguration motsvarar filen och att nya previeworigins är täckta.
Nuvarande HyParquet-läsare hämtar hela den valda Parquetdelen; framtida Range-läsning
ska använda samma versionsadress. Autentiserad S3-återläsning bevisar inte CORS,
CDN-cache eller publik browseråtkomst. Koordinatorn beslutar om avgränsat driftprov.

Endast godkända publika exporter får väljas. Publishern avvisar traversal,
symlänkar som lämnar stagingroten, privata/raw/model-prefix och andra filformat
än JSON, CSV, Parquet, SVG, PNG och WebP. Private thesis och privata original är
inte publiceringsindata. Manifestet innehåller endast publika logiska paths,
objektidentiteter, datum och kod-SHA; inga credentials, lokala källpaths eller
modell-/råartefakter. Befintliga privata lagringsflöden påverkas inte.

Ett avgränsat driftprov kan använda `--manifest-key manifests/smoke-NAME.json`
på samtliga fyra CLI-kommandon. Använd en separat grupp, exempelvis
`smoke-r2-delivery`, och en liten godkänd fixture under en isolerad stagingrot.
Prova första publish, oförändrad publish, andra versionen och rollback med samma
separata manifestnyckel. Kontrollera via browser att manifestet revalideras,
index och bytes går att läsa, CORS fungerar och produktionsmanifestet är
oförändrat. Detta skapar bara avgränsade smokeobjekt i befintlig bucket;
`manifests/current.json` ska inte anges eller aktiveras i detta prov.
Ingen radering eller full bootstrap följer automatiskt av smokeprovet.
Koordinatorn fattar beslut om verklig read/write-smoke och dess objekturval.

## Verifiering och levererade filer

Publisherns regressioner använder en fake S3 med ETag, conditional PUT,
avbruten upload, authfel och skadade bytes. Fixturedata omfattar riktig Parquet,
CRLF-JSON och befintliga publika kontrakt med små Parquetfiler. Browserkontroller
använder isolerade mockmanifest och verkliga logiska paths, utan R2-aktivering.

Ändrade/nya filer i denna uppgift:

- `platform/publish/release.py`: materialize, publish, staged bundleactivation och rollback.
- `platform/publish/build_catalog.py`: katalog v2, bootstrapopt-in och stagingrot.
- `platform/lib/delivery.py`: trimning av R2-miljövärden före legacyklientens anrop.
- `frontend/src/dataSource.ts`: låst snapshot, lazy index, tydliga fel och flikrefresh.
- `frontend/src/parquet.ts`: fallback endast för uttrycklig lokal/äldre localhostleverans.
- `platform/tests/python/test_release.py`: publisher-, katalog- och regressionstester.
- `frontend/tests/r2-delivery.spec.ts`: isolerade browserkontroller.
- `docs/r2-delivery-contract.md`: detta kontrakt och leveransrapport.

Slutkontroller: 19 publisherregressioner, 421 plattformstester med två
skips, 90 frontendunit-tester, TypeScript och sju riktade desktopbrowserkontroller
godkända. Ändrade frontendfiler passerade Prettier och dokumentet gav noll träffar
i repoets språkgranskare. De aktuella jobs- och news-specsen passerade även
lokala prepublishkontroller. En motsvarande DiVA-kontroll stoppades på saknad
`diva/clusters.json`, vilket kräver den dokumenterade materialiseringen före
bootstrap; inga saknade filer hoppades över. Ingen ny
produktionsaktivering, publik datafil, workflow, commit, push eller merge utfördes
av denna worker.

Urvalet från aktuell katalog och koordinatorns sex specs gav 59 indexdelar,
inga ägarskapskollisioner eller avvisade paths och ett uppskattat toppmanifest
på 29 724 bytes. Indexdata hämtas först när en path
efterfrågas. Denna uppskattning använder riktiga paths och syntetiska
objektidentiteter; verklig upload och browserstorlek måste mätas i driftprovet.

Decision: Samma aktivsnapshot låser hela flikens dataleverans och grupper uppdateras med villkorad PUT.
Finding: Schema1-kataloghashar kräver historisk läskompatibilitet; nya payloads hashas exakt.
Open question: Produktionsdomän, faktiska CORS/cache-regler, retention och första godkända bootstrap ska verifieras före aktivering.
