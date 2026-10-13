# Verifiering av R2-workflows

Granskad 13 oktober 2026 efter workflowmigrationen i den gemensamma arbetskopian. Workeruppgiften omfattar regressionstester och denna rapport. Root äger workflowen och Git-integrationen; ingen R2-skrivning, produktionsaktivering eller betald API-körning har utförts här.

## Testad integration

`platform/tests/architecture/test_r2_refresh_workflows.py` läser de aktuella YAML-filerna och publiceringsspecifikationerna. Testerna skyddar följande beteenden:

- Jobb, nyheter, offentliga data, DiVA och den manuella IT-rapporten publicerar sina egna grupper med `release.py`, explicit `--code-sha` och `contents: read`. Datarefreshers innehåller ingen Git-commit eller push. Dagliga jobb kräver inte den tunga historiska IT-pipelinen.
- `baseline`, `jobs`, `jobs-analysis`, `news`, `public-data` och `diva` har skilda filägare. Jobbmarknadens `jobs/market.json` tillhör den dagliga gruppen; `gold/marts/jobs.json` tillhör `jobs-analysis`.
- Nyheter materialiserar den aktiva gruppens tidigare valfria sammanfattning före ny ingestion. Bash körs med mockade processgränser: exit 0 och valfri exit 2 går vidare, medan fatal exit 1 stoppar steget. Publiceringen har ingen `always()`- eller `failure()`-väg runt det felet.
- Offentliga data behåller ordningen restore, välfärd, parlament, skatt. Råcheckpointlagring får bara ske efter lyckad restore. Riksdagens studies- och checkpointprefix finns kvar. Publik validering föregår publicering, och den kompletta public-data-gruppen materialiseras före publisheranropet.
- Bootstrap körs genom den verkliga Bash-kontrollstrukturen med offlineprocesser. Den stagear fem obligatoriska grupper och aktiverar sedan en enda snapshot. DiVA saknas när varken export eller katalogpost finns; en lokal export gör gruppen tillgänglig. Fel i en stage, misslyckad materialisering och ett trasigt JSON-kvitto stoppar körningen före aktivering.
- Varje credentials-guard provas med vart och ett av de fyra obligatoriska värdena tomt eller bestående av space, newline och tab. Giltiga fixturevärden med en avslutande newline accepteras utan att bli shellkommandon.

Stegrubriker används inte som kontrakt i den nya sviten. Det äldre `test_public_refresh_workflow.py` har under uttryckligt tilldelat ägarskap anpassats från `upload.py` till `release.py`. Testet behåller det gemensamma writer-låset med manuellt warehouse, stegbudgetar, ämnesutfall, checkpointlagring, validering och ordningen för statuspublicering. Även det testets tidigare rubrikmatchningar för gate, export och checkpoint har ersatts med deras faktiska kommandon eller utfall.

## Verkligt CLI och fake S3

Ett separat regressionstest anropar `release.main()` med verkliga CLI-argument och återanvänder projektets befintliga fake S3 från `test_release.py`. Tre små märkta fixturegrupper stageas utan aktivt manifest. Varje gruppmanifest innehåller den angivna kod-SHA:n, och payloads har lästs tillbaka. Ett enda CLI-activate sammanför sedan grupperna och skriver det aktiva manifestet sist. En efterföljande ogiltig JSON-leverans ger exit 1, inga nya S3-skrivningar och oförändrad aktiv snapshot.

DiVA-specifikationen provas också genom den verkliga publishern: en punkt som hänvisar till ett obefintligt kluster stoppas av den konfigurerade semantiska kontrollen före första uppladdning. Inga fixturepunkter eller påhittade produktionsrader läggs till i sajtens data.

Bash-testernas subprocesser kör inga nätverkskommandon. Git Bash används på Windows och vanlig Bash på Linux. De efterliknar runnerns felhantering och anropar riktig Python för de små JSON-kvitto- och exportexistenskontroller som finns i bootstrap-skriptet.

## Upptäckta och rapporterade regressioner

Före migrationen gav den första fokuserade körningen 17 fel och sex godkända tester. Konkreta beteendefel var en rådata-push med `always()` utan lyckad restore som villkor, en nyhetsguard som bara kontrollerade account-id och guards där `-z` accepterade secrets som bara innehöll whitespace. De felen rapporterades till root genom Orca och är rättade i de aktuella workflowen. De övriga felen gällde den då kvarvarande Git-publiceringen och avsaknaden av stage/activate-kontraktet.

En full plattformskörning efter migrationen gav 419 godkända, två skips och ett fel i `platform/tests/python/test_release.py::test_approved_image_mime_types`, rad 365. `figures/map.webp` fick `application/octet-stream` där testet kräver `image/webp`. Den exakta assertionen och kopplingen till publisherns MIME-tabell skickades till root; detta ligger utanför workerägd produktkod.

Publisherägaren rättade MIME-tabellen medan den körningen pågick. En efterföljande riktad körning av just MIME-testet och de tidigare public-data-regressionerna gav 23 godkända. Root kör den slutliga fulla plattformssviten; resultatet ovan avser arbetskopian före MIME-rättningen och är inte ett påstående om slutversionen.

## Verifierade körningar

- `python -X utf8 -m pytest platform/tests/architecture/test_r2_refresh_workflows.py platform/tests/architecture/test_public_refresh_workflow.py -q --basetemp warehouse/test-r2-focused-final`: 31 godkända.
- `python -X utf8 -m pytest platform/tests -q --basetemp warehouse/test-r2-platform-final`: 419 godkända, två skips och MIME-felet ovan i den då aktuella arbetskopian. Den nytillagda DiVA-konfigurationsregressionen ingår i den senare fokuserade körningen.
- `python -X utf8 -m pytest platform/tests/python/test_release.py::test_approved_image_mime_types platform/tests/ingest/test_public_refresh.py platform/tests/ingest/test_public_data_repair.py -q --basetemp warehouse/test-r2-prior-regressions`: 23 godkända efter MIME-rättningen.
- `python -X utf8 platform/tests/ingest/verify_tax_dependencies_dbt.py`: godkänd även efter workflowintegrationen. Tom DuckDB byggde 62 skattebeslut genom 37 verkliga dbt-noder och tester; saknat parlamentsunderlag stoppade den kalla runnern.

De befintliga parlaments-/skattetesterna finns kvar i plattformssviten. Den tidigare reparerade bilagepolicyn och skattebootstrapen har inte ändrats av denna följduppgift. Lokal workspace-basetemp används för att undvika Windows systemtemp-behörighetsfel.

## Kvarvarande verifiering

Full bootstrap och efterföljande refresh mot riktig R2 och GitHub-runner återstår. Lokala prov visar inte produktionsbehörigheter, komplett fjärrkatalog, domänens CORS/cacheheaders eller en lyckad produktionsaktivering. Dessa behöver verifieras mot samma slutliga kodversion, med kvitton för de stageade grupperna och återläsning av den aktiva snapshoten.

Decision: Testa runnerns Bash-kontrollflöde och verkligt publisher-CLI med offlinegränser och befintlig fake S3.
Finding: De migrerade workflowen passerar de fokuserade testerna för scopes, credentials, valfria nyhetsfel och bootstrapaktivering.
Open question: Slutför den verkliga runnern materialisering och publicering av hela katalogen med avsedda R2-behörigheter?
