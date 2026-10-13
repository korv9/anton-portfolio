# Reparation av parlament och skatt

Kontrollerad 13 oktober 2026. Ändringen omfattar propositionsberedning, skattens körskript och tester. Ingen full ingestion, commit, push, produktionsskrivning eller R2-publicering har utförts.

## Grundorsak och källkontroll

[GitHub-körning 38248823244](https://github.com/korv9/anton-portfolio/actions/runs/38248823244) stoppades enligt releasegranskningen den 12 oktober vid åtta dokumentstatus-404:or i riksmötet 2010/11. Beredningsimporten behandlade varje dokument i propositionslistan som en självständig proposition. Därefter försökte skatt bygga `dim_tax_decision` utan dess förälder `fct_bill`: `tag:taxes` väljer inte automatiskt föräldrar med parlamentstaggen.

En läsning av [Riksdagens originallista](https://data.riksdagen.se/dokumentlista/?doktyp=prop&rm=2010%2F11&sz=500&p=1&utformat=json&sort=datum&sortorder=asc) gav HTTP 200. Listans metadata anger 224 träffar och två sidor. De åtta berörda deldokumenten är GY03101d2, GY03101d3, GY03101d4, GY03101d5, GY03101d6, GY03101d7, GY03101d8 och GY03101d9. Alla har `relaterat_id=GY03101`, `tempbeteckning=d2` till `d9`, samma riksmöte och beteckning som huvuddokumentet samt Bilaga i `sokdata.statusrad`.

Dokumentstatus gav HTTP 404 för samtliga dessa åtta id:n. Även GY03101d1 gav 404 vid separat kontroll, men det id:t finns inte bland de åtta listade deldokumenten. [Huvuddokumentets status](https://data.riksdagen.se/dokumentstatus/GY03101.json) gav HTTP 200 med rätt id, riksmöte 2010/11, beteckning 101 och 4 426 270 tecken i HTML-fältet. Dokumentet är Årsredovisning för staten 2010; API-listan placerar skrivelsen under `doktyp=prop`, `subtyp=skr`. Riksdagens [publika söksida](https://www.riksdagen.se/sv/sok/?avd=dokument&doktyp=prop%2Cku-anm%2Ceverkber&p=3&riksmote=2010%2F11) visar också bilagornas hänvisning till huvuddokumentet.

Detta visar en felaktig uppslagningsförutsättning för listade bilagor. Det visar inte att varje historisk 404 är permanent eller att bilagans separata text har lästs.

## Täckningspolicy och återstart

En dokumentstatus-404 får status `unavailable_attachment` endast när listans metadata visar en bilaga: ett `d`-suffix med nummer, ett uttryckligt relaterat huvuddokument i samma lista, samma riksmöte och beteckning samt bilagemarkeringen. Huvuddokumentet måste ha giltig beredning och får inte ha misslyckats under försöket. En tidigare giltig post kan återanvändas enligt befintlig cachepolicy; ett misslyckat försök att revidera huvuddokumentet kan inte godkänna bilagorna.

Andra 404:or, 503, timeout, trasig JSON, fel dokumentidentitet och tom dokumenttext förblir fel. Befintlig HTTP-session behåller sina återförsök för throttling och tillfälliga serverfel. Kända giltiga beredningsposter sparas även när deras ersättare misslyckas. Sådana poster räknas fortfarande som väntande, inte som en lyckad revision.

`studies/coverage/<riksmöte>.json` redovisar varje listat dokument med status, käll-URL, huvuddokument för undantaget, observerad bilage-404, feltext och om en tidigare post behållits vid ett fel. Rapporten och beredningen sparas vid samma befintliga kontrollpunkter: efter 25 behandlade dokument och vid avslutat försök. Både rapport, beredning och kompletta listfiler ingår i completion-recordets hashkontroll. `pending_bills` i proveniensen styr återstarten; ett ofullständigt försök får inget completion-record och avslutas med fel.

Completion-requesten har nu `coverage_version=1`. Äldre beredningsposter återanvänds när deras tidigare hash och rapportkoppling är giltiga, medan täckningsrapporten byggs vid första migreringen. Den befintliga historiska revisionsperioden på 90 dagar och full-refresh gäller fortfarande. En misslyckad listning lämnar det föregående giltiga beredningscheckpointet intakt; efter en lyckad ny listning ogiltigförklaras det innan beredningen uppdateras.

Bilagorna får ingen uppfunnen beredningsrad. Rapporten skiljer deras otillgängliga separata status från den lästa huvudhandlingens beredning. De kontrolleras igen vid nästa historiska revision.

## Skattens bootstrap och leveransgrind

`run_taxes.py` använder `dbt build --select +tag:taxes`. Det bygger även propositioner, propositionsstudier, rapport- och voteringsmodeller samt nödvändiga parlamentsseeds. Befintliga dbt-tester, inklusive `assert_tax_decisions_have_sources`, finns kvar.

Före skattens hämtnings- och byggsteg kontrolleras att de parlamentsfiler som modellerna läser har verifierade, kompletta checkpoints. Alla befintliga beredningsfiler måste ingå i ett completion-record med den nya täckningsversionen. Voterings- och rapportfiler måste ingå i sina historikcheckpoints. Hashfel, oavslutade sessioner och saknade filer ger ett uttryckligt upstreamfel före dbt. Äldre godkända rådata kan användas som bootstrapunderlag; en befintlig gold-tabell ensam är inget sådant underlag.

På en tom runner krävs därför följande ordning: återläs verifierade parlamentsrådata och checkpoints, eller kör `platform/ingest/run_parliament.py`; kör sedan `platform/ingest/run_taxes.py`. När bara parlamentsrådata redan finns kan skatten bygga sina föräldrar från en tom databas. `--skip-fetch` hoppar inte över upstreamkontrollen. `--skip-build` tillåter en avgränsad rådatahämtning utan krav på parlament, men utgör ingen godkänd leverans.

Körskriptet publicerar inget. Workflowets samlade export- och publiceringsgrind ska fortsatt kräva att samtliga ämnessteg och leveranskontroller lyckats. Koordinatorn äger workflowintegrationen; denna ändring rör inte workflows eller gemensam lagrings- och publiceringskod.

## Verifiering

- `python -X utf8 -m pytest platform/tests/ingest -q --basetemp warehouse/test-public-repair-3`: 52 godkända. De nya regressionerna omfattar åtta metadataförankrade bilage-404:or, saknat huvuddokument, otillräcklig bilagemetadata, tillfälliga fel, partiell beredning, återstart med återanvänt huvuddokument, bibehållet checkpoint vid listfel, migrering av äldre beredning, tom taxrunner, föräldraselektion och korrupt/ofullständigt upstreamunderlag.
- `python -X utf8 -m pytest platform/tests -q --basetemp warehouse/test-public-repair-all`: 311 godkända och två skips i den aktuella gemensamma arbetskopian.
- `python -X utf8 platform/tests/ingest/verify_tax_dependencies_dbt.py`: godkänd. Verkliga modeller byggdes i en temporär, tom DuckDB med små märkta fixturer. Samtliga 62 seedade skattebeslut fick sina propositions- och voteringskopplingar; 37 valda dbt-noder och tester passerade. Det befintliga källspårbarhetstestet kördes. `dbt ls --select +tag:taxes` verifierade uttryckligen proposition-, studie-, voterings-, rapport- och seedföräldrar. En separat kall CLI-körning utan upstream stoppades med tydligt fel och skapade ingen databas.
- `python -X utf8 platform/tests/ingest/verify_public_refresh_dbt.py`: godkänd. Befintlig kommunalskattefixture återanvände komplett historik, uppdaterade aktuellt år och passerade fyra dbt-noder/tester med 290 kommuner per år.

dbt-kontrollerna använde lokalt dbt-core 1.12.5 och dbt-duckdb 1.11.0. Den befintliga kommunalskattekontrollen rapporterade projektets äldre deprecation för generic test-argument i andra ämnen samt en varning från `python -m dbt.cli.main`; bygget och testerna passerade. Fixturerna raderades med sina temporära warehouses och har inte exporterats.

## Kvarvarande live-verifiering

En full verklig körning av den ändrade kedjan på GitHub återstår: återläsning, beredning inklusive 2010/11, skattens föräldrabyggnad, dbt-tester, export, leveranskontroll och godkänd publicering. Därefter behövs en andra körning med återanvändning och ett kontrollerat avbrotts-/återstartsprov på runnern. De lokala fixturerna verifierar logik och bootstrapberoenden, inte komplett produktionsdatatäckning eller R2-behörigheter.

Decision: Tillåt endast metadataförankrade bilage-404:or med giltig huvudberedning och en hashverifierad täckningsrapport.
Decision: Bygg skattens dbt-föräldrar och kräv komplett verifierat parlamentsunderlag före byggstart.
Finding: Livekällan listar åtta otillgängliga deldokument, d2 till d9, under ett åtkomligt huvuddokument.
Open question: Slutför nästa GitHub-körning hela kedjan och återanvänder nästa körning godkända checkpoints?
