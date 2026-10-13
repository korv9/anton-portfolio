# Utförandeplan för datauppdateringar

Datum: 13 oktober 2026. Tre Orca-workers arbetar under en koordinator. Originaldokument, råtext och privata artefakter får inte publiceras. Befintliga ändringar i portfolion ska bevaras. Koden ska pushas till en branch och mergeas till main efter verifiering. Levande R2-leverans aktiveras först efter en separat, verifierad bootstrap.

## Offentliga data

- Kontrollera dokumentmetadata för de åtta historiska 404-fallen i 2010/11.
- Skilj permanent saknade dokument/bilagor från tillfälliga API-fel.
- Bevara verifierad historik och dokumentera täckningsluckor; godkänn inte ett ofullständigt dataset som komplett.
- Gör skattmodellens beroende på fct_bill uttryckligt och testa den nödvändiga bootstrapordningen.
- Testa avbrott, återstart, förändrad källa och bevarade checkpoints.
- Leverera regressionstester och en rapport med kvarstående livekontroller.

## Nyheter

- Gör rubriker och grundnyhetsdata oberoende av AI-sammanfattningen.
- Returnera en särskild felkod/status för valfria modellfel och bevara tidigare giltig sammanfattning med dess datum.
- Låt obligatoriska indata-/skrivfel stoppa körningen; maskera inte alla fel med continue-on-error.
- Testa refusal, max_tokens, API-fel, ogiltigt modellresultat och lyckad sammanfattning med mocks.
- Publicera även ändrad sammanfattning när rubrikerna är oförändrade.
- Spara körningsstatus och verifiera att grundleveransen fortfarande kan publiceras vid AI-fel.

## Gemensam R2-leverans

- Definiera publiceringsgrupper och filägarskap för jobb, offentliga data, nyheter och manuella leveranser.
- Skapa versionsbundna filer med exakta payloadhashar och verifiera dem genom återläsning.
- Publicera ett litet aktiveringsmanifest sist; föregående version ska överleva ett avbrutet försök.
- Håll grupper isolerade så en jobbuppdatering inte ersätter nyheter eller välfärdsfiler.
- Koppla frontendens befintliga logiska datavägar till levande manifest, med explicit lokalt/offline-läge.
- Testa cache, sammanhängande version per vy, Parquetdelar, index, nätverksfel och rollback.
- Behåll rådata/checkpoints separat från godkända publika dataset.

## Workflowintegration och verifiering

- Koordinatorn integrerar CLI-/manifestkontraktet i workflowen efter att agenten definierat det.
- Ta bort commit/push för data och använd contents: read där skrivning till Git inte längre behövs.
- Bygg och validera data före uppladdning och aktivering.
- Låt arbetsmarknadens dagliga leverans vara oberoende av tyngre IT-rapporter.
- Behåll gemensamt writer-lås där manuella och schemalagda jobb delar rådata; kontrollera köbeteendet.
- Testa först med realistisk fake S3 och små verklighetstrogna fixtures.
- Kör gemensamma Python-, typ-, format- och dataleveranskontroller när implementationerna är integrerade.
- Rapportera exakt vad som är implementerat, vad som är verifierat och vilka live-/domänberoenden som återstår.

## Filansvar

- Public-data repair äger de avgränsade parlaments-/skatteskripten och deras tester.
- News delivery äger sammanfattnings-/nyhetsskript och deras tester.
- R2 delivery äger gemensam publicerare, katalog/resolver och deras tester.
- Koordinatorn äger workflowändringar, integration och slutgranskning.

Idea: Genomför dataarbetet med tre avgränsade workers och en koordinator som integrerar workflowen.
