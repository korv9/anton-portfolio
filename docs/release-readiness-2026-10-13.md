# Releasegranskning

Granskad 12–13 oktober 2026. Gäller den aktuella arbetskopian och de GitHub-körningar som fanns vid kontrollen. Nästa större release är inte redo att godkännas ännu. Den tidigare mergade versionen har grönt CI, men det gäller inte de många efterföljande lokala ändringarna.

## Underlag och gränser

Granskningen började med befintlig Graphify-graf och följdes av riktade läsningar över frontend, routing, CV-visning, dataresolver, modeller, ingestion, publicering, ML, testsystem, workflows, ignore-regler och driftkonfiguration. Filinventering, beroendeaudit, GitHub-loggar, R2-status, produktionsheaders och browserkontroller ingår.

Detta är en bred releasegranskning, inte en garanti att varje rad eller varje möjlig filterkombination har verifierats. Grafen saknar delar av den nya koden. Andra agenter ändrade arbetskopian under granskningen; cirka 97–98 statusposter syntes vid olika kontroller. En del frontendfel försvann under omkörning eller efter ytterligare ändringar. Frys därför en releasekandidat och kör slutkontrollerna på just den committen.

Ingen produktkod, pipeline eller extern konfiguration har ändrats av denna granskning. Rapporten är den nya artefakten.

## Verifierade kontroller

| Kontroll | Utfall |
| --- | --- |
| TypeScript och produktionsbygge | Godkända i första kontrollen. En senare full typkontroll hittade oanvända variabler/importer i den föränderliga arbetskopian; nästa fulla kontroll passerade. |
| Prettier | Godkänd vid kontrollen. |
| Frontend unit | 90 godkända. |
| Plattformens Python-tester | 266 godkända, 2 skips. Separat workspace-basetemp användes för att undvika Windows systemtemp-behörighetsproblemet. |
| Nya ML-/Cluster Lab-tester | 21 godkända, 4 konvergensvarningar på testdata med färre distinkta punkter än önskat antal grupper. |
| Full browserkörning | 113 godkända och 10 fel av 123. |
| Riktad omkörning | 4 godkända och 4 fel. Två av de tidigare felen försvann ur testurvalet när testkoden ändrades under granskningen. |
| Datakontrakt | Godkända: gold, budget, produkter och politik, inklusive lokala checksums, katalogiserade shards och 1 436 roll-call-summeringar. |
| npm audit, alla beroenden | 5 high, inga critical. |
| npm audit, produktionsberoenden | 0 rapporterade sårbarheter. |
| Begränsad secretskontroll | Inga igenkännbara token-/privatnyckelmönster i granskade ändrade textfiler. Ingen komplett secretskanning av all historik. |
| Git-ignore | Inga redan trackade filer som matchar nuvarande ignore-regler. Examensarbetets privata mapp, tmp och grafen ignoreras. |

Browserfelen är inte tio fastställda produktbuggar. Några gäller uppdaterade vyer som äldre tester inte längre beskriver, och några uppträdde i en föränderlig utvecklingsserver. De måste ändå utredas innan CI kan skydda nästa release.

## P0: Frys och verifiera nästa releasekandidat

### Synkronisera ändrad produkt och testkontrakt

`frontend/tests/clusters.spec.ts:11` förväntar sex kartsektioner; aktuell sida visar sju. Testet använder också den äldre sektionen `#cv-philosophy`. `frontend/tests/cv-viewer.spec.ts:121` kräver formuleringen specializing in data and AI, medan godkänd About-text nu säger with a focus on data and AI. Båda testgrupperna misslyckades på både dator och mobil även vid omkörning.

Rätta assertions efter avsedd slutlig upplevelse, utan att bara försvaga testerna. Testa verkliga kartor, metadata, modellbyte och navigation för de nya sektionerna. För copy bör kontrollen skydda roll, inriktning och jobbsökande, inte en oavsiktligt låst synonym.

En browserkontroll av partivyn fick en saknad LONG_READ-export. Aktuell source använder därefter isLongRead och den senare typkontrollen passerar. Behandla detta som ett observerat utvecklingsserver-/ändringsproblem tills det kontrollerats i ett rent produktionsbygge. Använd en ny server eller preview för releaseprovning, inte en pågående HMR-session som andra ändrar.

Klart när hela avsedda browsermatrisen, typkontroll, formattering, unit-, Python- och datakontroller passerar från en ren checkout av samma commit och när borttagna tester har motiverade ersättningar.

### Ta med rätt filer i releasekandidaten

Nya importerade komponenter, ML-moduler, configs, rapporter och publika JSON-filer är fortfarande otrackade. Ett lokalt bygge kan använda dem även om de saknas i nästa commit. Inventera alla otrackade filer innan staging. Genererade previewdata måste vara antingen inkluderade och verifierade eller publicerade till den aktiva dataleveransen.

Klart när en ny checkout kan bygga webbplatsen och köra avsedda offlinekontroller utan utvecklarens warehouse, modeller eller privata PDF. GitHubs grönmarkering ska avse den slutliga head-SHA:n.

## P1: Gör daglig datauppdatering tillförlitlig

### Offentliga data är fortfarande blockerade

[Körningen 12 oktober](https://github.com/korv9/anton-portfolio/actions/runs/38248823244) lyckades med välfärd men stoppades i parlament och skatt. Riksdagens dokumentstatus gav 404 för åtta historiska dokument-id:n i 2010/11. `studies_ingest.py:319` markerar därför preparation som ofullständig. Därefter saknades fct_bill när skattmodellen byggdes.

`platform/models/gold/taxes/dim_tax_decision.sql` refererar fct_bill, men `run_taxes.py:41` väljer bara tag:taxes och flödet hade inte lyckats bygga beroendet. En hämtpolicy måste skilja permanent otillgängliga dokument från tillfälliga fel och bevara dokumenterad täckning. Undersök om dessa id:n avser dokument som kräver annan uppslagning. Att bara ignorera alla 404 eller stänga av tester är inte en verifierad lösning.

Gör modellberoendena uttryckliga. Välj och bygg nödvändiga föräldrar, eller låt skattens avgränsade leverans fungera med en uttryckligt vald godkänd parlamentsversion. En misslyckad historisk källa ska ge ett synligt täckningsproblem och inte tyst ersätta kompletta tidigare data.

R2-status för välfärd är fortfarande från 10 oktober, trots senare försök. Checkpointing och de längre tidsgränserna finns nu, men de bevisar inte en komplett lyckad leverans.

Klart när bootstrap på tom runner, nästa inkrementella körning och återstart efter ett avbrott lyckas. Verifiera slutligen en full verklig körning genom hämtning, modeller, tester, export och godkänd publicering.

### Nyhetssammanfattningen stoppar grundleveransen

[Nyhetskörningen 12 oktober](https://github.com/korv9/anton-portfolio/actions/runs/38254066287) stoppades åter med max_tokens. Sammanfattningen ligger före commit i `refresh-news.yml:66`, och `summarize_news.py:152` returnerar felkod. Nyhetsfilen på main har fortfarande generated_at 8 oktober.

Publicera de hämtade nyheterna även när den valfria AI-sammanfattningen misslyckas. Behåll tidigare sammanfattning med dess verkliga datum och rapportera delstatus. Kontrollera att längre avbrott inte ger permanenta luckor när feeds har kort räckvidd.

Klart när ett simulerat AI-fel lämnar nyhetsleveransen fungerande och en riktig schemakörning publicerar aktuella rubriker.

### Separera dataleverans från kodrelease

Jobbjobbet lyckades 12 oktober och market.json på main är byggd samma dag. Månadsserien slutar i september; daglig stream och full månad är separata täckningsmått. Manuella ämnen som AI Act, tal och atlasmodeller behöver också uttrycklig uppdateringspolicy.

JSON-basen i kataloggeneratorn är fortfarande lokal. Nytt material i `frontend/public/cluster-research` läses dessutom direkt genom `/cluster-research/` i stället för katalogens resolver. Den nuvarande publika katalogen omfattar cirka 164 MB; det är sajtens filsamling, inte vad varje besökare laddar initialt.

Genomför `docs/r2-data-migration.md`: privat rådata/warehouse, publika versionsbundna dataset, manifest som aktiveras sist, en sammanhängande version per vy och inga dagliga data-push till Git. Koppla nya ML-filer till samma katalog/manifestkontrakt. Kontrollera retention och återställning innan lokala kopior tas bort.

Kataloghashen normaliserar nu CRLF även för binärfiler i `build_catalog.py:144`. Definiera exakt bytehash för Parquet och en explicit textpolicy. Uppladdarens metadatahashkontroll bör kompletteras med faktisk återläsning av relevanta leveranser; metadata ensam verifierar inte payloaden.

Klart när en ny datasetversion syns i browsern utan sajtdeploy, en avbruten flerfilspublicering lämnar föregående version aktiv och rollback är provad.

## P1: Verifiera produktionens headers och previewmiljö

### CV-inbäddningens policy är motsägelsefull

`frontend/public/_headers:6` ger X-Frame-Options DENY för alla filer. Produktions-PDF:n svarade 200 med denna header under granskningen, medan `CvViewer.tsx:142` laddar den i en iframe. DENY är enligt headerns definition ett förbud mot inbäddning även från samma origin. Browserkontrollen gav ingen console-error, så faktisk PDF-rendering är inte verifierad som trasig i varje browser. Policyn är ändå oförenlig med det avsedda stödet.

Tillåt samma-origin-inbäddning för just CV-PDF:n med rätt header/CSP-konfiguration och behåll lämpligt skydd på resten av sajten. Kontrollera att överlappande Cloudflare-regler inte skickar två motstridiga värden. Testa att dokumentet faktiskt renderas, inte bara att iframe finns och URL svarar. Testa även browser utan inbyggt PDF-stöd, Escape, fokusåtergång, stängning och verklig nedladdning.

Underlag: [X-Frame-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options) och [Cloudflares headers](https://developers.cloudflare.com/workers/static-assets/headers/).

### Preview ska motsvara produktion

Den tidigare main-versionen fick grönt produktionsbygge, men det separata anton-portfolio-dev-previewbygget misslyckades eftersom workern saknades. Skapa eller koppla rätt previewworker, eller avveckla den felaktiga integrationen. Verifiera deploykommandon, branchval och rätt workername. Produktionsgodkännande ska inte vila på en preview som inte kan byggas.

Verifiera egen datadomän, CORS för exakt aktuell previeworigin och Range-stöd. R2-manifestet använder fortfarande r2.dev och senaste public-data-workflowet hade tom R2_PUBLIC_BASE. Använd custom domain i produktion och prova browseråtkomst; autentiserad S3-läsning är en annan åtkomstväg.

Klart när samma release har fungerande preview, gröna head-checks och godkänt produktionsbygge, och CV samt stora datafiler fungerar med verkliga headers.

## P1: Uppdatera verktyg och bevaka driften

`npm audit` rapporterade high-fynd i wrangler-kedjan: miniflare, sharp, source-map-js och undici, plus wrangler som beroendenod. Produktionsaudit rapporterade noll. Det är inte fem bevisat exponerade sårbarheter i React-sajten.

Uppdatera den berörda verktygskedjan och lockfilen i en avgränsad ändring. Kör audit igen, rena installationer, build, deployment dry run och tester. Använd inte en blind force-uppgradering. CI:s wrangler@4-körning och den lokala lockfilen bör följa ett medvetet kompatibilitetsval.

Komplettera Python med motsvarande dependencykontroll. Direkta Pythonpaket är pinnade, men transitive resolution och ML-miljöns system-site-packages gör miljön mindre låst. Bevara exakta modellrevisioner och runtimeversioner för experiment och pröva installationen i en ren miljö. Pythonberoenden har inte genomgått en full sårbarhetsaudit i denna granskning.

Inför driftstatus per dataset: senaste försök, lyckad hämtning, lyckad publicering och senaste täckta period. Välj bevakad larmkanal och datasetanpassade åldersgränser. Ett grönt CI testar kod och kontrakt; det ersätter inte kontrollen av den schemalagda liveingestionen.

Dokumentera hur driftfel hanteras och hur tidigare datarelease aktiveras. Verifiera kö/lås för writers; nuvarande data-refresh-grupp används av flera ämnen och manuella körningar. En pipeline som väntar ska inte kunna försvinna obemärkt när annat arbete schemaläggs.

## P2: Färdigställ innehåll, modeller och användarupplevelse

### Innehåll och språk

Välj en uttrycklig språkpolicy. Startsidan har lang=en och väljer engelsk text, medan header och analyser kan växla språk. Detta kan vara ett produktval, men växlarens omfattning måste vara tydlig och testad.

Synkronisera metadata med den aktuella profilen software/data/AI. Beskrivning i index.html säger fortfarande Data Engineer/Analytics Engineer. Verifiera sökresultat, canonical, länkdelning, kontaktadress och CV-länk. Hashrouting ger begränsningar för projektvisa delningskort; bedöm behovet innan en större routingmigrering görs.

Alla prioriterade projekt behöver tydlig egen insats, faktiskt resultat, status och begränsningar. Visa källor, period, enheter och urval nära grafer. Stäm av kvarstående definitionsrisker från `project-reader-review.md` mot den nya implementationen. Dokumenterade juridiska/tax-relaterade vyer behöver aktuella officiella källversioner om de säger vad som gäller i dag; denna granskning verifierar inte rättslig riktighet.

### Modellresultat

De nya debatt- och länsexperimenten har omfattande konfigurations- och metodunderlag, identifierade runs och stabilitetsmått. De fem kontrollerade publika JSON-filerna var giltiga utan NaN/Infinity och cirka 437 KB tillsammans. Debattkartorna visar 1 500 punkter per vy medan analysen använder fler observationer. Det måste framgå på sidan.

Behåll avståndet mellan geometrisk stabilitet och semantisk kvalitet. Förklara brus och eventuell eftertilldelning separat. Ett klusternamn måste ha stöd i granskade exempel och vara knutet till run-id. Länsgrupper av ekonomiska indikatorer är inte automatiskt ett må-bra-index; metodrapporten visar också känslighet för vilka indikatorer som ingår.

Lägg de nya lätta ML-/exportkontrakttesterna i CI; dagens workflow kör bara platform/tests och frontendtester. Full träning behöver inte ske vid varje PR. Lås fixtures och exportversion, kontrollera koppling mellan schema, run-id, observations-id och aktiv layout. Avgör vilka experiment som är publika, och vilket material som bara ska visas i utvecklingsläget.

### Tillgänglighet och prestanda

Fortsätt med axe, men komplettera med faktisk användning: CV-innehåll, tangentbord i menyer/tabeller/kartor, touchval, tomma/felande dataset och textalternativ som förklarar resultat. Kontrollera kontrast i den bekräftade textnyansen och paletten, även inne i diagram och dark plates. Ändra inte typografi till helsvart bara för att text får högre vikt.

Mät produktionen på en mobil med begränsat nätverk och CPU. Första appchunk var omkring 291 KB, gzip 94 KB, i det kontrollerade bygget; detta är ett bundlemått, inte uppmätt Core Web Vitals. Kontrollera bild/diagramstorlek, lazy loading, långa main-thread-uppgifter och animationer. Värdera hjulscrollningens egen easing och bevara native tangentbord, touch, nested scroll och reduced motion.

### Git och struktur

Private thesis, tmp, warehouse, env-filer och lokala grafer är skyddade. Komplettera ignore för rootvirtualenv och relevanta Ruff/Mypy/coverage-artefakter när de används. En mapp som heter private i en publik bucket är inte en åtkomstgräns.

Behåll huvudstrukturen frontend/platform/ml. Förenkla duplicerad routemetadata, modellval via adress-regex, import av politikens CSS från andra produkter och upprepade Python-sys.path-injektioner. Gör detta i små ändringar efter fungerande releasekontrakt. Ta inte bort legacybyggare innan resultaten reproduceras och deras kontroller fått en ersättning.

Verifiera rättigheter/proveniens för återpublicerade texter, data, modeller, typsnitt och vendorerade paket. Flera upstreamlicenser och Manrope-OFL finns redan i Git. Detta är ingen full juridisk granskning av dataset eller vikter. Undvik en generell cookie-/persondatapolicy som inte motsvarar sajten; inventera först vilka externa tjänster, spårning och lagrade uppgifter som faktiskt används.

## Rekommenderad releaseordning

1. Frys en kandidat och rätta testsynkronisering samt eventuella kalla byggfel.
2. Verifiera CV:s produktionsheaders och en fungerande preview.
3. Rätta parlaments-/skattberoenden och frikoppla nyhetssammanfattningen; visa verklig täckning tills liveleveransen är godkänd.
4. Uppdatera verktygsberoenden och införa bevakning av lyckad dataleverans.
5. Genomför R2-migrationen som separat leverans med versioner och provad rollback.
6. Godkänn prioriterade projekt, språkbeteende, mobilprestanda och modellförklaringar.
7. Pusha kandidaten, kontrollera head-SHA, CI och preview, mergea och verifiera produktionen samt första schemakörningen.

En avgränsad portfoliorelease kan använda tydligt daterade snapshots medan ingestionen rättas. Den får då inte lova att alla produkter uppdateras dagligen. För en release med daglig dataleverans är en lyckad verklig pipeline och fungerande bevakning ett krav.

Finding: Aktuell full browserkörning gav 113 godkända och 10 fel; omkörningen hade 4 godkända och 4 kvarstående fel i den föränderliga arbetskopian.
Finding: Plattformstesterna gav 266 godkända och 2 skips; ML-testerna gav 21 godkända.
Finding: Offentliga data och nyheter misslyckades 12 oktober, medan jobbdata uppdaterades samma dag.
Idea: Frys nästa releasekandidat och verifiera samma commit i ren checkout, preview och produktion.
Idea: Godkänn daglig dataleverans först efter en lyckad faktisk schemakörning och provad återställning.
