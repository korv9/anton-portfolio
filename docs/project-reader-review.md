# Läsargranskning av projektsidorna

Granskad 10 oktober 2026 på den lokala webbplatsen, http://127.0.0.1:5173. Bedömningen gäller arbetskopian vid granskningen, inklusive ändringar som ännu inte ligger på main.

## Bedömning

Projekten innehåller mycket material, men läsaren får för ofta själv avgöra vad som är viktigast. Gemensamma kort och färger har förbättrat formateringen. Informationen behöver också en gemensam läsordning: vilken fråga projektet undersöker, vad resultatet är, vilken graf som stöder resultatet och vad som begränsar tolkningen.

Politiksidorna är en bra utgångspunkt för avgränsade frågor, jämförelser och tillgång till underliggande tabeller. Politikens startsida är däremot bred: den blandar opinionsmätningar, mandat, modellstruktur och dataleveranser. Jag skulle använda de bästa temasidornas sätt att förklara en fråga som mall.

Jag utgår från projektets dokumenterade målgrupp, rekryterare och rekryterande chefer, med möjlighet för andra läsare att utforska ämnet och granska tekniken. De ska kunna förstå ett projekt utan att redan känna till dbt, UMAP eller korpusen.

## Underlag och avgränsning

- 67 ingångar och sektionsadresser öppnades på både dator (1440 × 1000) och mobil (390 × 844). Text, rubriker, navigation, kontroller och skärmbilder sparades. De 14 lokala projektens startsidor ingår.
- En kompletterande länkcrawl öppnade 160 unika kanoniska hashadresser på dator. Där ingår begreppsdetaljer, artikel- och debattläsare, äldre arbetsmarknadsvyer, kvalitetssektioner och ett urval modelladresser. Detta är ingen fullständig kontroll av varje möjlig filterkombination, modell eller enskilt dokument.
- Skärmbilder och innehåll jämfördes mellan sidtyper. Källkod och levererade sammanfattningsfiler kontrollerades där definitioner eller siffror behövde förklaras.
- DiVA Thesis Lakehouse har ett projektkort som länkar till ett externt kodrepo och ingen lokal projektsida. Bedömningen gäller kortets information; det externa repot har inte granskats här.
- Inga förändringar av sidornas implementation gjordes i denna granskning. Detta är en analys av presentation och utvalda datadefinitioner, ingen revision av all rådata eller verifiering av lagtextens rättsliga riktighet.

## Viktigaste fynden

### 1. Resultat och datatäckning får samma visuella vikt

Politikens 246 350 anföranden, välfärdens 80 indikatorer och AI Act-sidornas 119 artiklar visar omfattning. De besvarar inte sidans huvudfråga. Antal kan vara användbara som bakgrund, men upptar här samma stora färgkort som förändringar och resultat.

Jobböversiktens 416 139 annonser och −6 % jämfört med samma månader året före fungerar bättre: läsaren får både storlek och en jämförelse. Examensarbetets 21 000+ incidenter → 121 kluster → 72 granskningskandidater har också en tydlig berättelse. Kandidaterna behöver fortsatt verksamhetsvalidering.

Förslag: ge varje sida högst några relevanta huvudmått. Låt täckning, stickprov och modellversion finnas som en kompakt databeskrivning. En artikel- eller metodläsare kan klara sig utan KPI-rad.

### 2. Tekniska kort kan beskriva en annan analys än grafen intill

Politikens gemensamma teknikkort använder `fct_party_roll_call` och röstningsmarts även på exempelvis budgetdetaljen och talanalysen. Därmed får läsaren en generell projektbeskrivning placerad som om den förklarade just den grafens ursprung.

Källor: `frontend/src/projects/ProjectTech.tsx:67`, budgetdetaljens renderade innehåll. `frontend/src/ui/dash/TechCard.tsx:129` väljer också pipeline när den angivna modellen saknas i schemaleveransen. AI Act och atlaserna visar därför inaktiva Schema/Datarader-flikar där politik och jobb erbjuder tabeller.

Förslag: behåll tekniken på alla projekt, men knyt den till den aktuella frågan. Visa källa, period, enhet och vad en rad betyder nära grafen. Lägg rätt modell, SQL, kontroller och exempelrader i fördjupningen. Visa endast tillgängliga tekniska vyer eller förklara tydligt vad som ännu saknas.

### 3. Samma visuella språk används för olika slags belägg

Punktmoln förekommer som faktisk projektion, illustrerad process, arkitektur och dekorativ bakgrund. Dessa figurer betyder olika saker. Examensarbetets figur är uttryckligen en illustration av antal, med en punkt per hundra incidenter (`frontend/src/products/ThesisSieve.tsx:1`). Atlaserna visar däremot modellerade textpassager. Homies nätverk beskriver backendens struktur.

Den globala bakgrunden bygger dessutom på debattdata och visas även bakom andra projekt (`frontend/src/App.tsx:88`). I skärmbilderna ligger punkterna bakom löptext, tabeller och verkliga grafer. Det gör det svårare att avgöra vilka punkter som hör till den aktuella analysen.

Förslag: behåll elfenbensbakgrunden #F4F0E6 och paletten. Ge analysytorna ett lugnt underlag. Märk figurer som Illustration, Dataprojektion eller Arkitektur, och förklara direkt vad punkt, position, storlek och linje betyder. Använd mörka ytor sparsamt och för en tydlig funktion.

### 4. Mobilens första skärm innehåller ofta ingen evidens

På mobil staplas navigation, introduktion och tre stora kort innan grafen. Detta syns tydligt på AI Act, atlaserna, DrugComb och välfärd. På AI Acts roll- och startupvyer fördröjer samma tre totalsiffror läsarens egentliga uppgift på varje sida.

Förslag: korta sidans start, visa ett huvudsvar och dess viktigaste jämförelse tidigt. Använd mindre sammanfattningsmått på mobil. Bevara detaljtabeller i avgränsade ytor med synlig väg till relevanta kolumner. Mobilen behöver en medveten läsordning, även när desktopens rutnät tekniskt får plats.

### 5. Läsaren måste förstå flera olika navigationssystem

Dashboard/Fördjupning går ofta till samma projekt med `?section=depth`. Temalänkar öppnar nya sidor, medan atlasernas länkar ofta flyttar läsaren nedåt i en lång sida. Äldre jobbvyer har dessutom en annan rubrik och navigation än den nya dashboarden. Samma projekt kan därför kännas som flera separata produkter.

Vid direkta öppningar av atlasernas sektionsadresser varierade positionen. Philosophy Groups började exempelvis vid sidans start; andra sektionsadresser placerade tidigare innehåll ovanför den efterfrågade rubriken. Detta bör verifieras med färdigladdad data och justeras efter avsedd sektion. Det är inte belägg för att samtliga ankarlänkar är trasiga.

Projektöversiktens CTA “Explore the project pages” leder till arkitektursidan, `#data-constellation`, i stället för till ett val av projekt (`frontend/src/home/HomePage.tsx:193`). Startsidan är också på engelska medan de flesta analysvyer i granskningen är på svenska.

Förslag: en tydlig projektingång, sedan Översikt / Utforska / Metod och data inom projektet. Märk navigation som hoppar inom en sida. Ge tekniska plattformssidor en egen ingång, Under huven. Samordna språk, aktivt läge och tillbaka-länk.

## Datadefinitioner som påverkar läsningen

| Område                | Kontrollerad observation                                                                                                                                                                       | Följd för presentationen                                                                                                                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Välfärd               | Grå referenslinje beräknas med länens totala befolkning som vikt. Graftexten kallar den befolkningsvägt länssnitt, medan förklaringen kallar den rikssnitt.                                    | Använd samma definition överallt. Total befolkning ger inte automatiskt rätt vikt för arbetslöshet i arbetskraften eller sjukpenningmått med annan målpopulation. Använd en matchande nationell serie eller märk länssnittet som referensmått. |
| Symbolic Atlas        | 72 926 förekomster totalt; 21 898 punkter i karturvalet. Baseline har 130 kluster och cirka 49 % brus. Bokcentrerad vy har 114 kluster. Huvudfyndets 74 % → 36 % jämför historiska körningar.  | Visa aktiv körning och urval vid kartan och uppdatera tillhörande mått. Skilj forskningshistorik från den aktuella kartans statistik.                                                                                                          |
| Philosophy Atlas      | 7 795 passager totalt; 2 600 kartlagda, högst 200 per verk. Inga grupper är semantiskt granskade.                                                                                              | Förklara urvalet och visa representativa texter. Kluster är kandidater att läsa, inte etablerade filosofiska skolor.                                                                                                                           |
| Concept Constellation | 28 redaktionellt valda begrepp i 1 893 passager. Cirka 93 % av närmaste grannar ligger i samma korpus, mot cirka 25 % slumpnivå.                                                               | Säg att detta är en jämförelse med valda begrepp. Jämför främst inom varje korpus; linjer visar inte belagd historisk påverkan.                                                                                                                |
| AI Act                | Gemensamma KPI:er 119/51/16 visas också på politiska tal och jobbannonser. Levererad summary räknar 12 milestones medan den renderade tidslinjen har 16 poster, inklusive flera händelsetyper. | Anpassa måtten till den aktuella vyn. Förklara och stäm av räkneregler/versioner; kalla inte samtliga tidslinjeposter tillämpningsdatum.                                                                                                       |
| Jobb                  | 2026 är januari–september. Huvudjämförelsen använder samma månader 2025. IT-kluster använder ett äldre och smalare urval.                                                                      | Behåll den korrekta periodjämförelsen. Förklara byte av period och urval när läsaren går till IT-rapport eller kluster. Annons, ledig plats och anställning är olika mått.                                                                     |
| DrugComb              | För LightGBM med alla egenskaper sjunker Pearson från cirka 0,66 med slumpad split till 0,52 för nytt läkemedel. AUCPR sjunker från cirka 0,50 till 0,26. Positiva fall är få.                 | Led med generalisering och hur testen skiljer sig. Visa relevant baslinje och positiv andel per test, inte bara korrelation. Resultaten gäller experimentmätningar i datasetet.                                                                |

Välfärdens kodreferenser: `frontend/src/welfare/CountyMultiples.tsx:76`, `frontend/src/welfare/CountyMultiples.tsx:123`, `frontend/src/welfare/WelfarePage.tsx:252`, `platform/models/gold/welfare/mart_county_year_overview.sql`. AKU avser 15–74 år och har felmarginal; sjukpenningmåttet har annan åldersbas och tidsdefinition. Detta är en definitionsrisk, inte ett påstående att alla visade länsvärden är fel.

AI Acts KPI-rad: `frontend/src/aiact/AiActProduct.tsx:280`. Översiktens teknikkort: `frontend/src/aiact/views.tsx:81`. Atlasernas tal kommer från de levererade summary-, kluster- och historikfilerna i `frontend/public/data/`. DrugCombs jämförelse gäller samma angivna feature-variant över flera splits, inte olika modeller som valts för att förstärka skillnaden.

## Gemensam läsordning

1. **Fråga och status.** Vad undersöks, för vem, och är detta ett levererat verktyg, ett experiment eller pågående arbete?
2. **Huvudsvar.** En konkret mening med relevant period och avgränsning. Vid uteblivet resultat: vad är faktiskt färdigt?
3. **Huvudgraf eller konkret exempel.** Ett belägg som svarar på frågan. Rubriken förklarar vad läsaren ska jämföra.
4. **Tolkning.** Varför detta är intressant, vad som mäts och vilken slutsats materialet stöder. Viktiga begränsningar ligger här.
5. **Utforska.** Filter och ytterligare jämförelser efter att ett rimligt standardläge visats.
6. **Metod och data.** Källor, modellversion, urval, raddefinition, kontroller, SQL och kod. En kort källa/period-rad finns redan vid huvudgrafen.

Fördjupningen bör tillföra underlag: ett exempel, ett metodval, ett testresultat eller en avvägning. På RAG/MIMII upprepas nu beskrivning och verktyg i vanliga kort, teknikkort och fördjupning. Färre upprepningar ger plats för information som faktiskt hjälper läsaren.

## Tre sidtyper inom samma designsystem

| Sidtyp                 | Passar för                                                         | Första innehåll                                                                     | Lämplig fördjupning                                                                                    |
| ---------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Dataprodukt            | Politik, jobb, välfärd, AI Act                                     | Avgränsad fråga, aktuell jämförelse eller navigator, relevant graf.                 | Datakällor, period, måttdefinitioner, modeller och kvalitet.                                           |
| Forskningsprojekt      | Symbolic, Philosophy, Concepts, DrugComb, examensarbete, Allegoria | Hypotes/fråga, viktigaste fynd, jämförelse eller representativt exempel, osäkerhet. | Körningar, utvärdering, confounders, manuellt granskat underlag och reproduktion.                      |
| Engineering case study | Homie, RAG, MIMII, DiVA-pipeline, lakehouse                        | Problem, byggd funktion, tydlig leveransstatus och faktiskt artefakt.               | Kontrakt, arkitektur, avvägningar och verifiering. KPI:er används när ett meningsfullt resultat finns. |

DiVA:s ännu inte körda ämnesklustring behöver en status- och metodpresentation tills resultat finns. MIMII kan övergå till en forskningspresentation om dokumenterade utvärderingsresultat publiceras.

## Genomgång sida för sida

### Projektöversikt och fristående projekt

| Sida                  | Nuvarande styrka och problem                                                                                                                                                                    | Föreslagen läsning                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#projekt`            | Lättöverskådliga kort, men projektens status och utfall saknas i skanningen. Plattformen är första projektet; engelska och den stora bakgrundskartan ändrar uttrycket jämfört med analysvyerna. | Visa fråga, ett utfall/levererad funktion och status per kort. Ge plattformen en egen tydlig länk och låt projekt-CTA leda till projektval.                 |
| `#thesis`             | Tydligt urval från incidenter till granskningskandidater. Den cirkulära figuren kan läsas som en verklig projektion.                                                                            | Behåll resultatkedjan, märk illustrationen, förklara varför kandidaterna är användbara och hur människor granskar dem.                                      |
| `#drugcomb`           | Omfattande dataset och flera förklarande figurer. Anatomifiguren kommer före den viktigaste modellutvärderingen.                                                                                | Börja med hur modellen klarar nya par, läkemedel och cellinjer. Placera vävnad, feature-analys och konstellation i utforskning.                             |
| `#drugcomb-data`      | Återanvänder rapporten med dataingång. Första landningen liknar rapportstarten.                                                                                                                 | Gör dataingången omedelbart igenkännbar: raddefinition, split, schema och täckning, med tillbaka till resultatet. Kontrollera scroll efter färdig laddning. |
| `#rfc-drift`          | Det finns ett konkret RFC-experiment, men ett stort generellt Pågående-kort ligger före det.                                                                                                    | Börja med originalmeningar och förändringen MUST → SHOULD, sedan kravprofil. Skilj det märkta syntetiska riktningsprovet från verkligt RFC-underlag.        |
| `#diva`               | Ärligt om att harvest inte har körts. Den luftiga visualiseringsytan har ännu inga publicerade kluster.                                                                                         | Visa pipeline, färdiga steg och vad som krävs innan analys kan visas. Undvik en tom karta som central figur.                                                |
| DiVA Thesis Lakehouse | Externt projektkort beskriver Fabric/PySpark/Delta. Lokal verifiering och liveplattform har olika status.                                                                                       | Märk extern kodlänk och skilj lokal Spark/Delta-verifiering från ännu obekräftad livekörning. Ingen lokal dashboard krävs för att visa backendarbetet.      |
| `#homie`              | Tydligt 3 implementerade ruttgrupper och 4 stubbar. Nätverksfiguren kräver mycket tolkning.                                                                                                     | Visa en händelse → lagring → veckovy med ett faktiskt kontraktsexempel, och skilj stubbar från implementerade flöden.                                       |
| `#rag`                | Funktion och verktyg är beskrivna; offentlig demo/resultatdata saknas. Samma information upprepas.                                                                                              | En sammanhållen case study: dokument → hämtat stöd → svar, med verifierat exempel om det finns och tydlig status.                                           |
| `#mimii`              | Mel-spektrogram/CNN och utvärderingsmetod är nämnda, men resultatmått publiceras inte.                                                                                                          | Visa problem, dataset, modell och faktiskt verifieringstillstånd. Lägg till ROC/PR eller förväxlingsmatris först när underlaget finns.                      |

### Politik

| Sida                           | Observation                                                                                                | Föreslagen förbättring                                                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `#politik`                     | 12 diagramkort och många olika mått; täcknings-KPI:er först.                                               | Kort sammanfattning och tre tydliga vägar: väljare, riksdagens arbete, prioriteringar. Flytta filantal/MB till Under huven.                 |
| `#politik-partier`             | Lång mandatserie och partival fungerar. Åtta överlappande linjer kräver arbete.                            | Visa en begriplig standardjämförelse och markera valt parti; behåll möjlighet att jämföra fler. Visa senaste värden direkt.                 |
| `#politik-valjarna`            | Konkret fynd, tidsserie och felmarginal. Flera närliggande vyer konkurrerar.                               | Led med senaste förändring, osäkerhet och stöd över tid. Skilj mätning från valresultat i figur och text.                                   |
| `#politik-roster`              | Visar både ja/nej-andelar och överensstämmelse mellan partier.                                             | Dela i två uttalade frågor. Ange om nämnaren är ledamotsröster, beslutspunkter eller partiståndpunkter.                                     |
| `#politik-budget`              | Beslutad budget, förslag och skillnader har användbar kontext. Många filter och statusuppgifter samtidigt. | Börja med vald budget och jämförelsebas, sedan en tydlig positiv/negativ avvikelsegraf.                                                     |
| `#politik-budget-detalj`       | Alla områden ger insyn, men generiskt röstningsschema förklarar inte budgetdata.                           | Visa rätt budgetmodell och avvikelser kring noll. Förklara undantaget 2019 nära jämförelsebasen.                                            |
| `#politik-skatter`             | Tydligt huvudfynd och jämförelse med OECD. Andel av skatter och andel av BNP förekommer på samma sida.     | Dela de två nämnarna i tydliga avsnitt. Lägg vald period och enhet nära varje figur.                                                        |
| `#politik-sakdebatter`         | Huvudfyndet är användbart. Antal yttranden och ämnesfördelning behöver förklaras separat.                  | Fråga → viktigaste ämnesförändring → andelsgraf → exempeldebatt. Förklara hur ämnen tilldelas och vad som räknas.                           |
| `#politik-partiledardebatter`  | Tidsordning och debattläsare ger konkret underlag. Gruppade staplar för många partier/ämnen blir täta.     | Välj ett parti eller några ämnen i standardläget. Jämför nu/föregående med en enklare figur och länka till repliker.                        |
| `#politik-tal`                 | Partiernas relativa ämnesfokus är tydligt när ett ämne väljs.                                              | Beskriv som språkligt fokus i importerade tal; ordandel belägger inte politisk avsikt. Visa originalpassager intill resultat.               |
| `#politik-utredningar`         | Databasläsare plus tidsserie och ledtid. Årets delperiod ligger nära tidigare helår.                       | Märk hittills/helår och tidsfönstret för koppling till proposition. Presentera sökning efter grafens huvudpoäng.                            |
| `#politik-nyheter`             | Källänkar och märkta AI-sammanfattningar. Omnämnanden riskerar att tolkas som stöd.                        | Ange perioden per mått och att ett namn i en rubrik är ett omnämnande. Håll källa och sammanfattning visuellt åtskilda.                     |
| `#politik-modell`              | Modellresultat och majoritetsbaslinje finns. Radial figur liknar samarbetsnätverk.                         | Visa testresultat mot baslinje först. Märk linjer som modellens använda samband/feature-bidrag, utan att påstå politiskt samarbete.         |
| `#politik-utforska`            | Bra index till underliggande verktyg.                                                                      | Gruppera efter uppgift: jämför, läs, simulera, granska data. Undvik att återberätta startsidan.                                             |
| `#politik-kallor`              | Källor, definitioner och begränsningar finns samlade.                                                      | Behåll referensrollen och länka direkt hit från det relevanta måttet. Skilj hämtad datum från senaste observation.                          |
| `#politik-sok`                 | Sökuppgiften uttrycks på vanlig svenska och täckningen förklaras.                                          | Håll sökformulär/resultat centralt och skilj sökning i utdrag från fulltextsökning. Verifiera laddat resultat separat.                      |
| `#politik-mandat`              | Interaktionen är enkel och majoritetsgränsen synlig. Stor generisk rubrik före uppgiften.                  | Ange valår och mandatkälla, prioritera vald summa mot 175. Ta bort den oproportionerliga sektionsrubriken.                                  |
| `#politik-debatt`              | Originalrepliker och röstning ger nära koppling till underlag. Tabellen är tät och övre kort tar plats.    | Börja med debattens fråga och beslutspunkter. Ha talordning som läsarverktyg och tydlig tillbaka-länk.                                      |
| Partival och enskilda debatter | Delar renderare, men innehållet varierar med query och dataladdning.                                       | Samma måttdefinition och aktivt val ska följa med vid navigation. Kontrollera representativa tomma och filtrerade lägen vid implementation. |

### Arbetsmarknad

| Sida                      | Observation                                                                                                 | Föreslagen förbättring                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `#jobb`                   | Stark aktuell jämförelse med samma månader. Teknik bredvid huvudgrafen får stor yta.                        | Visa aktuellt svar och säsongsjämförelse först; källrad nära grafen, full modell efter tolkningen.                      |
| `#jobb-trender`           | Månatliga staplar finns, men KPI:n visar historisk rekordmånad.                                             | Lyft aktuell förändring och jämför samma månader; rekordmånad hör till historiken.                                      |
| `#jobb-yrken`             | Procentförändring med antal och minimitröskel. Största minskning ligger först även när grafen visar växare. | Anpassa huvudmåttet till valt läge och behåll basantal för små yrkesgrupper.                                            |
| `#jobb-lan`               | Andel annonser och förändring finns i samma rankning.                                                       | Gör skillnaden mellan storlek och tillväxt tydlig; komplettera procent med antal.                                       |
| `#jobb-villkor`           | Konkreta andelar men flera villkorsfamiljer i en lista.                                                     | Gruppera anställningsform, arbetstid och erfarenhet. Visa okänd/saknad uppgift som egen kategori.                       |
| `#jobb-kluster`           | 35 861 IT-annonser 2022–2025, 10 grupper och 17 % utanför grupper.                                          | Förklara urvalet före kartan. Börja med gruppbeskrivning och exempelannonser; avstånd i kartan har ingen egen enhet.    |
| `#jobb-utforska`          | Bra länksamling till äldre detaljerade vyer.                                                                | Märk att detta är fördjupad utforskning och behåll projektets rubriker, perioder och navigation när läsaren går vidare. |
| `#jobb-kallor`            | Arkiv, hash och metod ger spårbarhet. Metodtexten visas på engelska i en svensk vy.                         | Samordna språket och ge annonsdefinitionen först, filarkivet därefter.                                                  |
| `#job-market`             | Äldre översikt med annan presentation än `#jobb`.                                                           | En gemensam ingång; märk äldre vyn som detaljerad explorer eller integrera den i samma navigation.                      |
| `#job-market-occupations` | Tabell ställer historiska helår nära 2026 delår; förändringen är separat samma-månader-jämförelse.          | Gör periodskillnaden visuellt tydlig eller erbjud konsekvent samma månader över alla år.                                |
| `#job-market-regions`     | Tabell/explorer för län snarare än nya dashboardens korta berättelse.                                       | Länka från relevant länsgraf, med samma period och valt område.                                                         |
| `#job-market-conditions`  | Detaljerad villkorsvy i äldre skal.                                                                         | Återanvänd terminologi och gruppering från villkorssidan; låt djupet vara avsiktligt.                                   |
| `#job-market-tech`        | Eget IT-urval och period 2022–2025, egna rollgrupper.                                                       | Märk bytet av data tydligt och förklara varför antal skiljer sig från hela marknaden. Visa rollen före dess utveckling. |

### AI Act

Samtliga nedanstående vyer ärver samma stora KPI-rad och teknikkort. Den gemensamma åtgärden är att göra deras första skärm relevant för den aktuella uppgiften.

| Sida                  | Observation                                                           | Föreslagen förbättring                                                                                                 |
| --------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `#ai-act`             | Aktuellt datum finns, men första grafen räknar skyldigheter per roll. | Börja med Vad gäller nu? → Vilken roll har du? → relevanta artiklar/datum.                                             |
| `#ai-act-today`       | Status per artikel är relevant.                                       | Lyft aktuella och nästa ändringar, därefter full artikellista. Visa textversion/hämtning separat.                      |
| `#ai-act-roles`       | Rollbeskrivningar innehåller långa juridiska citat.                   | Enkel rollöversikt först, officiell definition och källhänvisning när rollen öppnas.                                   |
| `#ai-act-startups`    | Navigatorn passar läsarens uppgift men kommer efter totalsiffror.     | Första frågan direkt. Förklara hur ett svar leder till visade referenser, inklusive osäkra svar.                       |
| `#ai-act-timeline`    | Figuren innehåller tillämpning, frist och dokument.                   | Namnge händelsetyper och fokusera nästa relevanta händelse. Stäm av 12 milestones mot 16 poster.                       |
| `#ai-act-obligations` | Matris plus lista fungerar för granskning men är tät.                 | Välj roll först, visa åtgärd och datum, öppna rätt artikel. Antal skyldigheter mäter inte börda eller risk.            |
| `#ai-act-risk`        | Tolkningsnivåer och lagreferenser finns.                              | Enkel nivåöversikt med konkreta läsexempel, sedan officiellt stöd. Håll rättslig text och egen klassificering tydliga. |
| `#ai-act-changes`     | Ändringslogg och dokumenttypfilter.                                   | Led med senaste relevanta förändring och vilken version som jämförs; behåll full logg som utforskning.                 |
| `#ai-act-politics`    | Tal över tid har annan databas än lagtexten.                          | Visa talens nämnare, period och sökdefinition; ersätt lagens totalsiffror med relevanta mått.                          |
| `#ai-act-jobs`        | Förekomst av ord i annonser mäts.                                     | Visa annonsandel och antal träffar. Skilj omnämnande från att tjänsten kräver kompetensen.                             |
| `#ai-act-signals`     | Gemensam tidsaxel, separata skalor är en bra början.                  | Förklara varje nämnare och tidsfönster. Samtidiga kurvförändringar visar inte orsak från lagen.                        |
| `#ai-act-sources`     | Skiljer officiell text, beräkning och tolkning.                       | Behåll detta tydliga upplägg, prioritera tillämpad version och källkedja framför global KPI-rad.                       |
| `#ai-act-article`     | Officiell text, status och ändring kan läsas tillsammans.             | Artikel och läsverktyg först. Undvik att totalsiffror och generell pipeline fördröjer texten.                          |

### Atlaser och begrepp

| Sida                                      | Observation                                                                         | Föreslagen förbättring                                                                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `#symbolic-atlas`, `#symbolic-map`        | Huvudfynd och läsnyckel finns. Historiska fynd blandas med baselinekartans KPI:er.  | Sammanhängande jämförelse av körningar först, aktiv körning/urval vid kartan. Läs textpassager för att tolka grupper.                 |
| `#symbolic-findings`                      | Stark berättelse om modellkvalitet kontra giltighet.                                | Använd denna del som projektets huvudsvar, med en enkel före/efter-figur.                                                             |
| `#symbolic-experiments`                   | Flera modeller och diagnostik i täta tabeller.                                      | Visa experimentfråga, vilket mått som prövar den och resultat; hela tabellen i fördjupning.                                           |
| `#symbolic-method`                        | Utförlig metod/korpus.                                                              | Behåll teknisk detalj, men separera aktuella data från äldre körningars diagnostik.                                                   |
| `#philosophy-atlas`, `#philosophy-groups` | Stor karta före ett konkret granskat fynd; 0 granskade grupper.                     | Börja med en passagejämförelse och vad centrering förändrar. Märk grupper som ännu ogranskade.                                        |
| `#philosophy-tensions`                    | Begripliga poler men små modellskillnader i rankning.                               | Visa valda ankartexter och exempelpassager. Rangordningen är modellavstånd, inte filosofens objektiva hållning.                       |
| `#philosophy-works`                       | Korpustabell hjälper reproducera urvalet; långa titlar blir mycket höga mobilrader. | Kompakt verklista med öppningsbar detalj och tydlig urvalsbeskrivning.                                                                |
| `#philosophy-method`                      | Viktiga begränsningar om översättare och korpus.                                    | Flytta kortversionen till huvudanalysen, behåll hela metoden här.                                                                     |
| `#concept-journey`                        | Att följa Risk genom fyra korpusar är en begriplig ingång.                          | Behåll som förstahandsingång. Visa ett faktiskt textbelägg per steg och förklara poängens enhet.                                      |
| `#concept-constellation`                  | Grafen visar flera relationstyper samtidigt.                                        | Starta med vald relationstyp och begrepp. Förklara varje kanttyp nära figuren.                                                        |
| `#concepts-profiles`                      | Tabell över 28 begrepp och fyra korpusar.                                           | Låt läsaren välja begrepp eller sortera per korpus; ange vad andelen räknar och visa tillhörande passager.                            |
| `#concepts-method`                        | Korrekt försiktighet om korpus-/språkskillnader.                                    | Kort förklaring före jämförelsen; full ankar- och modellinformation här.                                                              |
| `#concept-{begrepp}` (28 detaljer)        | Samma detaljrenderare för risk, autonomi, rättvisa med flera.                       | Konsekvent definition, inom-korpus-rankning, exempelpassager och tillbaka till resan. Inga slutsatser om påverkan enbart från likhet. |

### Välfärd och plattform

| Sida                                                                         | Observation                                                                                                                              | Föreslagen förbättring                                                                                                                                |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#sweden`                                                                    | Små diagram på gemensamma skalor är en bra visualisering. Antal indikatorer och källor kommer först; referenslinjens benämning varierar. | Led med vald indikator och regional skillnad. Samordna referensdefinitionen och visa målpopulation/felmarginal nära figuren.                          |
| `#sweden-counties`                                                           | Jämförelsetabell med olika enheter och målpopulationer.                                                                                  | Håll varje mått separat och visa definitionsraden. Beskriv samvariation utan ett sammanlagt välmåendebetyg.                                           |
| `#sweden-explorer`                                                           | Många filter behövs men kräver förkunskap.                                                                                               | Visa ett rimligt exempel och låt indikatorval styra vilka filter som är relevanta.                                                                    |
| `#quality`                                                                   | Bra skillnad mellan datakvalitet och analytisk validitet. Matrisen blir bred.                                                            | Visa projektets viktigaste öppna risk först, sedan kontroller. Ett godkänt tekniktest är inte bevis på giltig tolkning.                               |
| `#quality-matrix`, `#quality-validity`, `#quality-checks`, `#quality-method` | Olika ankare i samma långa referenssida.                                                                                                 | Tydligt sektionsnamn, korrekt landning och projektspecifik filtrering.                                                                                |
| `#data-model`                                                                | Tabellmetadata och flöde är tekniskt användbara.                                                                                         | En kort läsnyckel, sedan välj domän/tabell. Förklara vad en rad betyder före kolumnlistan.                                                            |
| `#data-model-{modell}`                                                       | Delar renderare; ett urval modeller öppnades.                                                                                            | Behåll sammanhanget mellan modell, indata, utdata och vilka läsarsidor som använder den. Märk genererad metadata/version.                             |
| `#er`                                                                        | Översikt och domänval hjälper. Mobilen visar en liten del av stor graf genom lokal scroll.                                               | Erbjud kompakt domänöversikt först och explicit väg till detaljdiagram. Förklara skillnaden mellan deklarerade och härledda relationer.               |
| `#data-constellation`                                                        | Genomgående källa → produkt är användbart för teknikläsare, men grafen är tät.                                                           | En verklig produkt som markerad exempelväg först, full arkitektur därefter. Placera under Under huven.                                                |
| `#data-catalogue`                                                            | Leveransmetadata och färskhet är värdefulla.                                                                                             | Visa källa/observation/publicering som separata datum och en filtrerbar katalog. Förenhetliga versionsberoende modellantal med övriga plattformsvyer. |
| `#idea-lineage`                                                              | Beslut och experiment kan förklaras kronologiskt. Många tekniska namn och engelska händelser.                                            | Börja med ett konkret beslut och resultat, erbjud projektfilter. Klargör att detta är projektets beslutshistorik.                                     |
| `#cluster-visuals`                                                           | Verktyg för att jämföra körningar, bland annat nya lokala experiment.                                                                    | Märk som labb, välj dataset/körning före metrik och förklara när mått är jämförbara. Håll separerat från publicerade resultat.                        |

## Rekommenderad arbetsordning

1. Rätta det som styr tolkningen: välfärdens referenslinje, aktiv körning i atlaserna, AI Acts KPI-kontext/tidslinjedefinition och projektspecifika datamodeller.
2. Gör projektöversikten till en läsbar ingång med status och utfall. Samordna språk och navigation; ge plattformen en egen väg.
3. Bygg en genomarbetad dataproduktsmall med jobb eller sakdebatter: fråga, aktuellt svar, huvudgraf, tolkning, utforskning och relevant teknik. Pröva på mobil.
4. Anpassa forskningsmallen med DrugComb eller Symbolic. Utvärdering och representativa belägg kommer före stora utforskningskartor.
5. Korta engineering- och pågående sidor. Visa levererat kontrakt, exempel eller verifiering; ta bort upprepade generiska beskrivningar.
6. Granska varje graf med fem frågor: Vad räknas? Av vad? Under vilken period? Vad får jämföras? Vilken slutsats stöder den? Kontrollera att svaren finns där grafen läses.

Ett praktiskt acceptanskriterium är att en ny läsare kan beskriva projektets fråga, ett resultat och en begränsning efter den första korta läsningen. Den tekniska läsaren ska därefter kunna följa just det resultatet tillbaka till relevant data och metod.

## Datafiler för kontrollerna

- `frontend/public/data/symbolic/summary.json`, `book-centered-clusters.json`, `reviewed-clusters.json` och `research-history.json` i samma katalog.
- `frontend/public/data/philosophy/summary.json` och `frontend/public/data/concepts/summary.json`.
- `frontend/public/data/ai-act/summary.json` samt tidslinjen som sidan laddar. Skillnaden mellan summary och visad längd behöver förklaras innan räknereglerna kan bedömas som felaktiga.
- `frontend/public/data/jobs/market.json` och `frontend/public/data/jobs/cluster-summary.json`.
- `frontend/public/data/products/drugcomb/` för rapportens dataset- och modellresultat.
- `frontend/public/data/schema/models.json` för vilka modeller och tekniska vyer som faktiskt finns publicerade.

Granskningens kördata och skärmbilder finns lokalt i `C:/Users/46762/AppData/Local/Temp/shiner-reader-audit/`. Dessa tillfälliga artefakter är inte incheckade och kan rensas av operativsystemet. Rapporten ovan är det beständiga underlaget.
