# Workers AI

Två demos använder Cloudflare Workers AI: en besökares mening placerad på kartan över
partiledardebatterna, och frågor med citat över ett urval av SFS och EU:s AI-förordning.

## Regeln

Endast öppen, publicerad data skickas till Workers AI. Besökarens text loggas aldrig och sparas inte.

Nycklarna ligger i Cloudflares och GitHubs secrets. För engångskörningar får en lokal `.env`
användas; den är gitignorerad och checkas aldrig in.

## Kontots gränser

Kontot har Workers Free:

- 10 000 neurons per dag, delade av alla anrop. Över gränsen misslyckas anropen.
- 10 ms CPU per request. Väntan på modellen räknas inte.
- Ingen Vectorize.

## Principen

Workern gör bara två saker: den bäddar in text och genererar svar. All vektorsökning körs i
webbläsaren, mot komprimerade vektorer som byggts offline.

## Workern

`worker/index.ts` svarar på två adresser, båda med POST:

- `/api/embed` tar en text på högst 500 tecken och returnerar dess vektor från `@cf/baai/bge-m3`.
- `/api/answer` tar frågan, korpusen (`sfs`, `ai-act-sv` eller `ai-act-en`) och högst 8 stycken
  på högst 5 000 tecken vardera. Varje stycke kontrolleras först mot korpusens verifieringslista,
  så att bara publicerad text går vidare till modellen. Svaret får högst 2 048 tokens och
  returneras bara om varje citat står ordagrant i sitt stycke.

Bindningen `RATE_LIMITER` släpper igenom 20 anrop per minut och besökare. Är dagens kvot slut
svarar Workern 503 med `reason: quota`, och sidorna visar då bara de förberäknade exemplen.

## Modellval

`/api/answer` använder `@cf/google/gemma-4-26b-a4b-it` med tänkandet avstängt
(`chat_template_kwargs: { enable_thinking: false }`). Kandidaterna kördes på de 20 evalfrågorna i
`configs/workers_ai/eval_questions.yaml` genom samma väg som sidan: inbäddning med bge-m3, sökning
i webbläsarkoden och svar genom Workern, natten till 2026-10-15 (UTC). Ett svar räknas som verifierat
när Workern godkänner det, alltså när varje citat står ordagrant i det stycke det pekar på.

| Modell             | Inställning             | Frågor | Verifierade | Tokens in | Tokens ut | Neurons per svar |
| ------------------ | ----------------------- | ------ | ----------- | --------- | --------- | ---------------- |
| gemma-4-26b-a4b-it | tänkande av             | 20     | 15 (75 %)   | 2 341     | 331       | 30,2             |
| gpt-oss-20b        | `reasoning_effort: low` | 19     | 12 (63 %)   | 2 328     | 293       | minst 50,3       |
| gpt-oss-20b        | standard (medium)       | 16     | 7 (44 %)    | 2 337     | 1 268     | minst 77,1       |

Tokens och neurons är medelvärden per svar, räknade från tokenantalen och Cloudflares pris per
modell. Cloudflare stoppade anropen kl. 00.15 UTC den 2026-10-15 med felkod 4006, alltså att dagens
10 000 neurons var slut, fast loggen bara hade räknat 2 793. Inga andra anrop än evalkörningen
gjordes efter midnatt, så gpt-oss kostar mer än tokenantalen visar, troligen för att dess resonemang
inte räknas in i `usage`. Siffrorna för gpt-oss är därför en undre gräns räknad från loggen, och den
verkliga kostnaden var ungefär fyra gånger högre. Gemmas pris stämde dagen innan, då 2 725 neurons i
loggen gick igenom utan stopp.

Kvoten tog slut innan gpt-oss hann svara på alla frågor. Valet håller ändå: även om de saknade
svaren hade blivit verifierade skulle gpt-oss nå högst 13 av 20 med låg ansträngning och 11 av 20
med standard. Med standardinställningen nådde gpt-oss taket på 2 048 tokens i fyra svar.

Två tidigare körningar ligger bakom inställningen. Med tänkandet på gick hela budgeten åt till
resonemang: med `max_tokens` 700 blev inget av 20 svar verifierat, och med 2 048 blev 3 av 19
verifierade till 72 neurons per svar. Utan exemplet på citatformatet i systemprompten blev 4 av 20
svar verifierade; modellen skrev ofta `[[id]"` i stället för `[[id]]"`.

## Recall efter komprimering

Vektorerna från bge-m3 har 1 024 dimensioner. De komprimeras med PCA och int8. Recall@10 mäter hur
stor del av de tio närmaste grannarna med fulla vektorer som också hittas med de komprimerade.

| Korpus    | Stycken | Recall@10, 256 dim | Recall@10, 384 dim | Levereras |
| --------- | ------- | ------------------ | ------------------ | --------- |
| sfs       | 9 970   | 0,940              | 0,977              | 256       |
| ai-act-sv | 1 413   | 0,961              | 0,987              | 256       |
| ai-act-en | 1 413   | 0,969              | 0,987              | 256       |
| debate    | 33 023  | 0,860              | 0,941              | 384       |

## Evalresultat

Sökningen hittade ett förväntat stycke bland de åtta första för 17 av 20 frågor och bland de tio
första för 18. Missarna bland de åtta första var fråga 6 (offentlighetsprincipen), 8 (arv utan
testamente) och 16 (AI som läser av känslor). Gemma fick ändå fram ett verifierat svar på alla tre
från andra stycken i träfflistan.

| Nr  | Korpus    | Fråga                          | Gemma | gpt-oss låg | gpt-oss medium |
| --- | --------- | ------------------------------ | ----- | ----------- | -------------- |
| 1   | sfs       | Uppsägningstid efter fem år    | ja    | ja          | ja             |
| 2   | sfs       | Antal semesterdagar            | ja    | ja          | ja             |
| 3   | sfs       | Ångra ett köp på nätet         | ja    | ja          | nej            |
| 4   | sfs       | Straff för stöld               | ja    | ja          | ja             |
| 5   | sfs       | Sambor som flyttar isär        | nej   | ja          | ja             |
| 6   | sfs       | Läsa myndigheters handlingar   | ja    | nej         | nej            |
| 7   | sfs       | Uppsägning av hyreskontrakt    | nej   | nej         | nej            |
| 8   | sfs       | Arv utan testamente            | ja    | ja          | ja             |
| 9   | sfs       | Handläggningstid hos myndighet | nej   | nej         | nej            |
| 10  | sfs       | Preskription av skuld          | ja    | ja          | nej            |
| 11  | ai-act-sv | Förbjuden AI                   | ja    | nej         | nej            |
| 12  | ai-act-sv | Vad som är ett AI-system       | ja    | ja          | nej            |
| 13  | ai-act-sv | Chattbotar måste framgå        | ja    | ja          | ja             |
| 14  | ai-act-sv | Märkning av deepfakes          | ja    | ja          | ja             |
| 15  | ai-act-sv | Ansiktsigenkänning i realtid   | nej   | nej         | nej            |
| 16  | ai-act-sv | AI som läser av känslor        | ja    | nej         | nej            |
| 17  | ai-act-sv | Böter för förbjuden AI         | ja    | ja          | –              |
| 18  | ai-act-sv | När förordningen gäller        | ja    | ja          | –              |
| 19  | ai-act-sv | Utbildning av personal         | nej   | nej         | –              |
| 20  | ai-act-sv | Högrisksystem                  | ja    | –           | –              |

`ja` betyder verifierat svar, `nej` att Workern stoppade svaret och `–` att frågan inte hann köras.
Inget svar blev `NO_ANSWER`. Gemmas fem stoppade svar föll på formen eller på ordalydelsen:

- Fråga 5: citaten skrevs som `[[id]"`, med en hakparentes för lite.
- Fråga 7: citatet kom före `[[id]]` i stället för efter.
- Fråga 9: ett citat kortades med `...`.
- Fråga 15 och 19: några hänvisningar saknade citat, och ett citat var omskrivet.

Raderna per fråga, med modellens råa text, ligger i `warehouse/features/workers_ai/eval/`.

Exempelfrågorna på sidan är tre av Gemmas verifierade svar per korpus, för `sfs` och `ai-act-sv`,
tagna direkt från evalraderna utan nya anrop. Frågornas vektorer bäddades in lokalt med samma
bge-m3. En fråga togs bara med när den lokala vektorn gav exakt samma åtta stycken som vektorn från
Workers AI, vilket gällde sex av sju. `ai-act-en` har inga exempel än, eftersom inga engelska frågor
har körts.

## Neurons per steg

Varje anrop skrivs som en rad i `warehouse/cluster_lab/workers_ai_ledger.jsonl`. Agenterna delade
en gräns på 9 500 neurons per UTC-dygn i loggen, och en körning över 2 000 krävde klartecken först.

| Steg       | Dygn (UTC) | Vad                                              | Neurons |
| ---------- | ---------- | ------------------------------------------------ | ------- |
| `debate`   | 2026-10-14 | Inbäddning av debattens 33 023 stycken           | 4 509,6 |
| `law`      | 2026-10-14 | Inbäddning av `sfs`, `ai-act-sv` och `ai-act-en` | 1 618,8 |
| `law-eval` | 2026-10-14 | Evalfrågor, Gemma och gpt-oss                    | 2 792,8 |
| `law-eval` | 2026-10-15 | Evalfrågor, Gemma och gpt-oss                    | 2 792,9 |

Provanropen från Workern och sidorna kostade 13,2 neurons till. Loggen räknar från tokenantalen.
För gpt-oss underskattar den kostnaden, som avsnittet om modellvalet visar.

Kvar att köra är exemplen för `ai-act-en`, ungefär 180 neurons, när kvoten nollställts
kl. 00.00 UTC den 2026-10-16. Tills dess visar den engelska sidan att exempel saknas.

## Hela författningssamlingen

Utöver de 40 lagarna i `configs/workers_ai/sfs_selection.yaml` finns hela SFS som dataprodukt,
utan inbäddningar och utan anrop till Workers AI. Demon läser fortfarande bara urvalet.

`python platform/ingest/sfs/ingest.py --all` läser Riksdagens dokumentlista med `doktyp=sfs`
till `raw/sfs/catalogue.json`. API:t lämnar högst 50 sidor om 200 träffar per fråga, så listan
läses först med nyaste dokumenten först och sedan med äldsta först. Därefter hämtas varje text
till `raw/sfs/texts/` med en sekunds paus. En ny körning hämtar bara texter som saknas eller vars
`systemdatum` i listan är samma dag som den senaste hämtningen eller senare. I pipelinen körs
steget när `SFS_ALL` är satt. Råtexterna ligger i warehouse och R2 (`raw: [sfs]`), inte i Git.
I R2 ligger de under `warehouse/raw/sfs/`: 11 564 filer och 203 251 795 byte, samma antal och
storlek som lokalt. `python platform/pipeline.py push sfs --only raw` laddade upp dem den 15
oktober 2026, och `pull sfs --only raw` hittar alla och hämtar 0, eftersom SHA-256 stämmer.

Körningen den 15 oktober 2026 tog 3 timmar och 23 minuter:

| | Dokument | Hämtade | Upphävda | Paragrafer |
| --- | ---: | ---: | ---: | ---: |
| lag | 3 038 | 3 038 | 1 264 | 94 903 |
| förordning | 6 732 | 6 732 | 3 509 | 99 558 |
| övrigt | 1 797 | 1 791 | 1 124 | 10 736 |
| Summa | 11 567 | 11 561 | 5 897 | 205 197 |

Sex dokument gav 404. Alla har dok_id av formen `sfs-1895-bih. 52 s. 1`, och Riksdagen
lämnar inte ut dem under någon adress. Råtexterna tar 215 MB.

- `silver_sfs_documents` har en rad per dokument i listan. Upphävda dokument ligger kvar med
  datumet från raden `Upphävd:`. Tabellen har också sista ändrings-SFS från `Ändrad:`, textens
  längd och SHA-256 samt ett parsningsstatus. Typen (`lag`, `förordning`, `other`) tas från
  titelns första ord. Grundlagarna och riksdagsordningen räknas som lag.
- `silver_sfs_corpus_paragraphs` delar alla texter med samma regler som demons
  `silver_sfs_paragraphs` (`platform/ingest/sfs/chunking.py`). Id:t är dok_id plus Riksdagens
  ankare, till exempel `sfs-1962-700-K3P1`, eftersom delningens eget id kan läsas på två sätt.
  Ett dokument utan numrerade paragrafer får i stället hela texten som `kind` `whole_text`.
  Huvudet och övergångsbestämmelserna ingår inte, precis som för paragraferna. Texten delas vid
  tomma rader och styckena packas i bitar om högst 1 500 tecken (`chunking.pack`). Ett stycke
  över gränsen delas vid meningsslut och, om en mening ändå är för lång, rakt av vid 1 500. En
  text som får plats har id `<dok_id>-whole`, annars `<dok_id>-whole-1`, `-2` och så vidare.

8 960 dokument gav paragrafer. 2 601 saknar numrerade paragrafer: enparagrafsförfattningar,
tabeller, avtal i bilaga och 132 ocr-skannade reglementen från Riksbanken och Riksgälden, som
`.text` levererar som XML. Ingen text med numrerade paragrafer blev utan paragrafer. Testet
`assert_sfs_catalogue_fetched` varnar för de sex saknade texterna och fallerar vid fler än tolv.

Av de 2 601 dokumenten utan paragrafer fick 2 195 ett helt-text-stycke. De 133 XML-texterna
står utanför: de 132 reglementena och en bevillningsförordning från 1869. OCR-texten är för
dålig att söka i. Hos 273 dokument finns inget efter huvudet. Före delningen var de 2 195
helt-text-styckena upp till 107 700 tecken långa (p50 458, p95 8 128), och 463 av dem var över
1 500. De 463 blev 2 858 bitar, så korpusen har nu 4 590 helt-text-stycken. Längderna i tecken:

| `kind` | Stycken | p50 | p95 | Max | Över 1 500 |
| --- | ---: | ---: | ---: | ---: | ---: |
| paragraph | 205 197 | 296 | 981 | 9 398 | 1 177 |
| whole_text | 4 590 | 1 146 | 1 489 | 1 500 | 0 |

Flest bitar, 82, fick ett dubbelbeskattningsavtal (`sfs-1977-580`). Paragrafstyckena är inte
delade. 1 177 av dem är över 1 500 tecken, det längsta 9 398, och inbäddningssteget får välja
hur de ska delas. Testet `test_whole_text_packs_into_pieces_that_join_back` kontrollerar att
ingen bit är över 1 500 tecken och att bitarna blir samma text igen, blanktecken frånsett. Fråga lagens
`silver_sfs_paragraphs` har kvar sina 9 970 stycken, och tabellens innehåll har samma md5 före
och efter ändringen. `assert_sfs_whole_text_only_without_paragraphs` kontrollerar att inget
dokument har båda sorterna och att ingen XML-text kommit med.

## Lokal utveckling

R2-hinkens CORS (`platform/publish/r2-cors.json`) släpper bara in `http://localhost:5173` och
`http://127.0.0.1:5173` lokalt. På en annan port laddar webbläsaren inte debattens delfiler eller
`sfs/meta.json`, som ligger i R2. Demonas e2e-tester serverar egna fixturer och påverkas inte.

## Öppna punkter

- Om Free-planen godtar `[[ratelimits]]` syns först vid den första preview-deployen. Godtas den
  inte tas blocket bort, och neuronkvoten blir den enda gränsen.
- `npx wrangler dev` har inte körts. Token i `.env` saknar behörigheten Workers Scripts, och
  wrangler läser den före inloggningen. Livekörningarna går i stället genom en Node-shim mot
  Workers AI:s REST-API: `platform/publish/workers_ai/eval_answer.ts` kör Workerns egen kod med
  `env.AI.run` skickat till REST.
