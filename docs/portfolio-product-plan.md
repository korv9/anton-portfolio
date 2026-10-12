# Arbetsplan för portfolion

Datum: 10 oktober 2026. Planeringsunderlag för den aktuella arbetskopian.

## Produktbedömning

Portfolion har en egen form, flera fungerande analysprodukter och en dokumenterad dataplattform. Nästa leverans bör göra det lättare att förstå Antons kompetens, välja ett projekt och bedöma dess resultat. Rekryterare och rekryterande chefer är den dokumenterade huvudmålgruppen.

Behåll den bekräftade designriktningen i `docs/design-system.md`: elfenbensbakgrund, Manrope, befintliga färger och tokens. Behåll indelningen Observatories, Labs och Engineering som arbetsstruktur. Ordningen och vilka projekt som lyfts behöver däremot följa portfolions rekryteringssyfte.

En besökare ska snabbt kunna svara på: Vad kan Anton bidra med? Vilket projekt visar det? Vad gjorde han själv? Vad blev resultatet? Hur kontaktar jag honom?

## Underlag och begränsningar

Granskningen började i den befintliga Graphify-grafen och fortsatte med riktade läsningar av aktuell routing, startsida, projektregister, gemensamma projektkomponenter, språkhantering och utvalda dataförklaringar. README, plattformsbeskrivning, design- och sidstruktur, deploydokumentation samt de två befintliga läsar- och layoutgranskningarna ingår.

Grafen beskriver delvis en äldre implementation och saknar nya komponenter. `.idea-lineage/state/portfolio.md` och `.idea-lineage/context.json` finns inte i arbetskopian. Ingen graf har byggts om.

De tidigare granskningarnas skärmbildsfynd är underlag för nya kontroller. De är inte en aktuell visuell verifiering. Ingen ny fullständig browsergranskning, produktionskontroll, Python-testsvit eller e2e-svit har körts för denna plan. Ingen produktkod har ändrats.

Kontroller i arbetskopian:

- `npm run check`: godkänd.
- `npm run test:unit`: 90 godkända, 3 fel av 93 rapporterade tester/testfiler.
- `npm run format:check`: formateringsavvikelser i 40 filer.

## Vad som redan har ändrats

Planera inte om dessa åtgärder som om de saknades:

- Debattbakgrunden visas bara på startsidan i `frontend/src/App.tsx:95`.
- Politik, jobb, välfärd och AI Act har nya temaväljande ingångar i `frontend/src/projects/ProjectOverview.tsx`.
- `ProjectStructure` försöker landa på sektioner även när innehållet laddas senare. Scrollbeteendet behöver verifieras med riktig användning.
- `ProjectTech` väljer särskilda modeller för bland annat budget, opinionsmätningar och skatt. På flera textteman väljer den bort standardmodellen. Kopplingen mellan varje graf och dess teknik behöver fortsatt granskas.
- Välfärdens förklaring skiljer nu referensmåttet från ett uppmätt nationellt värde, men den svenska texten har kodningsfel.

## Leveransordning

| Ordning | Arbetsområde | Leverans | Beroende |
| --- | --- | --- | --- |
| P0 | Stabil arbetskopia | Releasens omfattning, fungerande tester och uppdaterad sidkarta | Först |
| P1 | Rekryterarens väg | Tydlig startsida, utvalda bevis, kontakt och CV | P0 samt val av huvudprofil |
| P1 | Projektens berättelser | Konsekvent läsordning och synlig egen insats | Börja med två representativa projekt |
| P1 | Datatolkning | Mått, urval och modellversion förklaras nära resultaten | Inventering av varje prioriterat projekt |
| P2 | Mobil och interaktion | Läsbarhet, språk, navigation och tillgänglighet verifierade | Efter innehåll och struktur |
| P2 | Release och drift | Preview, dokumentation, datauppdatering och slutkontroller | Tidigare arbetsområden klara |

### P0: Gör omarbetningen sammanhängande

Arbetskopian har många ändrade, tillagda och borttagna filer. Inventera dem till en uttrycklig releaseomfattning. Kontrollera att borttagna plattformssidor och rapporter har avsiktliga ersättningar; flera äldre adresser leder nu till projektlistan.

Två enhetstestfiler importerar borttagna moduler: `frontend/tests/unit/catalogue.test.ts` och `frontend/tests/unit/lineage.test.ts`. Avgör om funktionaliteten är avvecklad eller flyttad. Flytta relevanta datakontrakt till rätt plats om de fortfarande behövs. Testet på `frontend/tests/unit/project-registry.test.ts:53` väntar sig flaggskeppsordning medan `neighbours()` följer projektgrupperna. Fastställ önskat beteende innan test eller implementation ändras.

Rätta felkodad svensk text, med det verifierade exemplet i `frontend/src/welfare/WelfarePage.tsx:63` som startpunkt. Formatera inom den avgränsade releasen. Uppdatera README och `docs/site-structure.md`, som fortfarande beskriver borttagna sidor och en äldre header.

Klart när typkontroll och enhetstester är gröna, formateringen godkänns och alla dokumenterade ingångar motsvarar aktuell navigation. Varje avvecklad funktion har en förklarad destination eller ett medvetet beslut om att tas bort.

### P1: Gör startsidan till en tydlig ingång

Startsidan öppnar med namn och rollen Data & AI Engineer. Projektlistan kommer efter profil, erfarenhet och utbildning. Lägg en kort beskrivning av vad Anton bygger och en direkt väg till utvalda projekt i den tidiga läsningen. Kontakt och CV ska vara lätta att hitta där.

Mitt förslag är att lyfta tre projekt och behålla hela projektlistan i grupperna. Börja med examensarbetet för tillämpad ML, arbetsmarknaden för analys och datapipeline, samt DiVA Lakehouse för data engineering om dess dokumenterade implementation räcker som bevis. Alternativt använd politikprojektet som plattformsbevis. Ett experiment som Symbolic Atlas kan visa forskningsintresse längre ned. Det slutliga urvalet beror på vilka roller Anton främst vill söka.

Startsidan använder `const b = (text: Bilingual) => text.en` i `frontend/src/home/HomePage.tsx:17`, fasta engelska rubriker och `lang="en"`. Språkväxlaren påverkar därför inte hela startsidan. Följ nuvarande dokumenterade språkval, svenska som standard och engelska som alternativ, tills ett annat produktbeslut finns. Samordna gruppnamn, header och projektingångar med samma val.

Tre rollanpassade CV-filer finns i `frontend/src/home/content.ts`, men den aktuella headern och kontaktsektionen använder den enda länken i `profile.cv`. Ge besökaren ett tydligt val av CV eller välj medvetet en huvudprofil för portfolion.

Klart när en ny besökare når ett relevant projekt och kontakt/CV direkt från startsidans tidiga innehåll. Språkbyte fungerar för hela denna väg och bevaras efter navigation och omladdning.

### P1: Ge projekten en gemensam läsordning

De nya temaväljarna gör stora analysprodukter lättare att navigera. De behöver också en kort förklaring av vad projektet visar och vilken del Anton byggde. Projektets ingång och en enskild analysvy har olika uppgifter.

Varje prioriterat projekt ska innehålla:

1. Fråga, avsedd användare och faktisk status.
2. Antons egen insats, inklusive ansvar i eventuella samarbeten.
3. Ett huvudresultat eller ett konkret exempel på det som fungerar.
4. En figur eller demonstration som stöder resultatet, med kort tolkning.
5. Begränsningar och nästa öppna fråga.
6. Utforskning, metod, källor och kod för den som vill fortsätta.

Antal annonser, artiklar eller passager är datatäckning. Placera dessa som bakgrund när de inte besvarar projektets fråga. Status som experiment, studie och pågående arbete ska vara synlig i projektkort och projektingång.

Pilot: arbetsmarknaden som analytisk produkt och examensarbetet som case. När båda fungerar, överför läsordningen till politik och ett atlasprojekt. Återanvänd befintliga komponenter där de passar. Anpassa därefter övriga projekt utan att tvinga artikelläsare och metodsidor att få stora KPI-rader.

Klart när en läsare kan återge projektets fråga, Antons bidrag och ett belagt resultat utan att öppna metodfördjupningen.

### P1: Stäm av vad siffror och figurer betyder

Den tidigare läsargranskningen har ett användbart register över definitionsrisker i `docs/project-reader-review.md`. Kontrollera varje punkt mot aktuell leverans innan den betraktas som ett kvarstående fel.

- Välfärd: referenslinjen räknas fortfarande med total befolkning i `CountyMultiples.tsx:76`. Kontrollera vilka indikatorer vikten passar. Använd en jämförbar nationell serie när sådan finns, eller märk länssnittet konsekvent och förklara dess begränsning.
- Atlaser: visa aktiv körning, karturval och modellversion. Skilj historiska experimentresultat från statistik för den karta besökaren ser.
- Arbetsmarknad: visa periodbyte när besökaren går från hela arbetsmarknaden till äldre IT-urval eller kluster. Håll isär annonser, platser och anställningar.
- AI Act: stäm av räkneregler mellan tidslinjens händelser och levererade sammanfattningar. Varje datum får en källhänvisning och den använda textversionen ska framgå. Rättsliga sakuppgifter kräver separat kontroll mot aktuella primärkällor vid genomförandet.
- DrugComb: led med generalisering mellan olika testuppdelningar. Visa relevant baslinje och andel positiva fall tillsammans med modellmåtten.

Teknikkort ska förklara analysen intill dem. Visa källa, period, enhet och raddefinition nära grafen; lägg SQL, schemas och längre modellbeskrivningar i fördjupningen. Märk punktmoln och nätverk efter funktion: dataprojektion, illustration eller arkitektur. Förklara vad position och linjer betyder.

Klart när prioriterade figurer har spårbart underlag och när deras synliga tolkning håller sig inom vad data och metod stöder.

### P2: Verifiera upplevelsen efter innehållsändringarna

Gör en ny visuell granskning på dator och mobil. Börja med startsida, projektmeny, projektingång, ett analystema, en atlas, ett case och metodfördjupning. Bredda sedan till alla kvarvarande sidtyper.

Kontrollera mobilens läsordning: första relevanta svar eller konkreta exempel ska komma tidigt, före omfattande teknikpaneler. Kontrollera även tabellers avgränsade rullning, läsbara grafetiketter och att sticky navigation lämnar utrymme för innehållet.

Testa direktlänkar med långsam dataladdning, bakåtknappen, filter i adressen och fördjupningslänkar. `ProjectStructure` har observers som återplacerar läsaren; kontrollera särskilt att detta inte orsakar hopp eller stör manuell scrollning.

Återanvänd testerna för navigation, språk, layout, tangentbord, reduced motion och axe. Kontrollera att en vald punkt eller graf går att förstå utan färg och med alternativt text- eller tabellinnehåll. Mät startsidans laddning och animationskostnad på mobil innan ytterligare visuell komplexitet läggs till.

Klart när den prioriterade besökarvägen fungerar med mus, tangentbord och pekskärm, i båda språken, utan klippt innehåll eller oväntade hopp.

### P2: Förbered en granskningsbar release

Visa datum för datauppdatering och faktisk täckning i analysprodukter. Kontrollera hur sidan beter sig vid saknad fil, nätverksfel och tomt urval. Stäm av publicerade filer mot katalog och dokumentation, samt kontrollera CV- och kodlänkar.

Verifiera förhandsvisning och länkdelning. Hashrouting och sidmetadata bör bedömas utifrån portfolions behov; ett byte av routing får vara ett separat arbete om projektvisa delningskort eller indexering motiverar det.

Före en push körs repots kontroller: `npm run check`, `npm run format:check`, `npm run test:unit`, `python -m pytest platform/tests -q` och `npm run test:e2e` för frontendändringar. Datadefinitioner som ändras får relevanta datakontroller. Enligt `docs/deploy.md` granskar ägaren preview innan merge till main.

Klart när kontrollerna är godkända, preview är granskad och kvarstående begränsningar är dokumenterade.

## Arbetsledning

Håll en aktiv huvudleverans åt gången. Avgränsa varje uppgift till ett läsarproblem, berörda filer och ett kontrollerbart slutvillkor. Uppdatera denna plan när en åtgärd verifierats; markera dokumenterade antaganden separat från upptäckta fel.

Föreslagen följd: stabilisering → språk och startsidans väg → två pilotprojekt → datadefinitioner → återstående projekt → mobilgranskning → release. Innehållsinventering kan ske under stabiliseringen. Gemensamma komponenter ändras först efter att pilotprojekten visar vilket beteende som behövs.

Lägg nya projekt, nya ML-körningar och större plattformsutbyggnad efter denna release, om de inte behövs för att rätta ett konkret fel. Plattformens legacy-migrering fortsätter ämnesvis enligt befintlig dokumentation och behöver inte blockera portfolions berättelse.

## Förslag att ta vidare

Idea: Prioritera en sammanhängande portfolioleverans med tydlig egen insats och belagda resultat.
Idea: Använd arbetsmarknaden och examensarbetet som pilotprojekt för den gemensamma läsordningen.
Finding: Typkontrollen godkändes, enhetstesterna rapporterade 90 godkända och 3 fel, och formateringskontrollen flaggade 40 filer den 10 oktober 2026.
Open question: Vilken roll ska portfolion främst stödja: data engineering, analytics engineering eller applied AI?
Open question: Ska hela portfolion följa nuvarande dokumenterade språkval med svenska som standard?
