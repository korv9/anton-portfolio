# Allegora på Google Cloud

Allegora (`#fraga-lagen`) söker i alla lagar och förordningar som gäller, inte bara i de 40
utvalda lagarna i `configs/workers_ai/sfs_selection.yaml`. Sökningen körs på Google Cloud i
projektet `allegora-513419`, region `europe-west4`. Svaret, citatkontrollen och fabeln görs
av Workern. Svaret och fabeln skrivs av Claude Sonnet 5.5 utan thinking (`worker/claude.ts`).

## Flödet

1. Webbläsaren skickar frågan till `POST /api/ask` (`worker/ask.ts`), med de två senaste
   kontrollerade turerna som `history` när det är en följdfråga. Den laddar inte ned någon korpus.
2. Workern drar en fråga från dagskvoten och skickar sökfrågan till Cloud Run-tjänsten
   `allegora-search` med headern `X-Allegora-Key`. Vid en följdfråga är sökfrågan den förra
   frågan och den nya ihop. Nyckeln finns som Cloudflare-secret `ALLEGORA_SEARCH_KEY` och i
   Secret Manager som `allegora-search-key`. Adressen står i `wrangler.toml`.
3. Tjänsten bäddar in sökfrågan med Vertex AI (`text-multilingual-embedding-002`, 256
   dimensioner, `RETRIEVAL_QUERY`) och jämför den med varje stycke. Sökningen är exakt. Den
   returnerar hela paragrafer (`retrieval.py`, se Sökningen nedan).
4. Workern svarar med en ström av server-sent events, i den här ordningen:

| Händelse | Innehåll |
| --- | --- |
| `hits` | sökfrågan och de åtta paragraferna |
| `delta` | svaret medan Claude skriver det, i bitar om minst 48 tecken; ett utkast |
| `result` | `verified` med svar, citat och tokens, eller `unverified`, eller `no_answer` |
| `fable` | fabeln, skriven ur det kontrollerade svaret, bara efter `verified` |
| `error` | ett fel efter att strömmen börjat |
| `done` | slut |

Sidan visar utkastet märkt "Utkast, inte kontrollerat än". Varje citat får sitt ✓ först när
`result` är `verified`. Är det `unverified` tas utkastet bort och ugglans fabel visas. Fabeln
skrivs från det kontrollerade svaret, aldrig från utkastet eller paragraferna, och visas under
svaret. Kontrollen (`checkQuotes` och `canonical` i `worker/quotes.ts`) är densamma som för
`/api/answer`.

Har ingen paragraf en cosinus på minst 0,74 blir `result` `no_answer` utan att Claude anropas.
Den 7 november nådde de tolv lagfrågorna 0,805–0,884 och sex frågor om annat 0,636–0,684.

Fel före strömmen svarar JSON: 400 för en ogiltig fråga, 429 med `reason` när kvoten är slut,
503 när Workern saknar konfiguration eller tjänsten inte svarar.

Varje besökare får 10 frågor per dygn (UTC) och sajten 200 totalt. Workern räknar i Workers KV
(`QUOTA`, `worker/quota.ts`) med IP-adressen hashad. Fråga nummer 11 får svaret "Tyvärr, Anton har
inte råd med fler tokens i dag." Frågor, trådar och svar loggas inte. Workerns loggrader har
bara tokens och millisekunder.

`/api/answer` med `corpus: "sfs-all"` finns kvar och svarar som förut, i ett stycke.

## Indexet

`platform/publish/allegora/sfs_index.py` körs som Cloud Run-jobbet `allegora-index`. Det läser
råtexterna från `gs://allegora-513419-batch/raw/sfs` (samma filer som `warehouse/raw/sfs` i R2)
och behåller dokument vars titel gör dem till lag eller förordning. Regeln är densamma som i
`int_sfs_documents.sql`. Dokument med ett `Upphävd:`-datum som har passerat vid hämtningen tas
bort. Varje dokument delas med `platform/ingest/sfs/chunking.py`. Dokument utan numrerade
paragrafer packas i bitar om högst 1 500 tecken.

Utdata i `gs://allegora-513419-batch/index/`:

| Fil | Innehåll |
| --- | --- |
| `passages.jsonl` | `{id, title, url, text, law, kind, fetched}`, i vektorernas ordning |
| `vectors.f16` | n × 256 float16, normerade till längd 1 |
| `index.json` | modell, dimensioner, antal stycken och dokument per slag, hämtdatum |

Råtexterna från den 15 oktober 2026 gav 105 303 stycken (60 019 ur lagar, 45 284 ur förordningar)
och cirka 49 miljoner tecken. Med 256 dimensioner blir vektorerna 54 MB.

## Drift

Allt körs med `platform/publish/allegora/deploy.sh` från repots rot:

| Steg | Vad det gör | Vem |
| --- | --- | --- |
| `setup` | API:er, tjänstekontot `allegora-search`, roller, nyckeln | projektägaren, en gång |
| `raw` | `warehouse/raw/sfs` till bucketen | efter en ny SFS-hämtning |
| `build` | imagen med Cloud Build, taggad med commit | vid kodändring |
| `index` | jobbet: chunkning och inbäddning | efter `raw` eller ny modell |
| `serve` | tjänsten med `max-instances=1`, skalar till noll | efter `index` |

Tjänsten läser in indexet när den startar. Ett nytt index syns därför först efter `serve` eller
när tjänsten har legat nere och startar om. Första frågan efter en paus tar några sekunder.

Tjänstekonton och roller:

- `allegora-batch` kör jobbet. Det är Vertex AI-användare och har objektadmin på bucketen.
- `allegora-search` kör tjänsten. Det är Vertex AI-användare, har läsrätt på bucketen och får
  läsa nyckeln.

Ingen nyckelfil finns. Tjänsterna får sina token från metadataservern.

Kostnaden är inbäddningen av indexet (49 miljoner tecken), en inbäddning per fråga och Cloud
Run-tid när tjänsten är igång. Projektet har en budgetvarning.

## Sökningen

Indexet har ett stycke per paragraf, eller per stycke i en lång paragraf. Tjänsten rangordnar alla
stycken och går sedan uppifrån. Den behåller det första stycket ur varje paragraf tills den har åtta
paragrafer från högst fyra lagar. Varje paragraf skickas hel, med alla stycken i ordning. En
paragraf över 4 800 tecken behåller de stycken som ligger närmast frågan.

`platform/publish/allegora/search_compare.py` prövade varianterna på det lokala indexet med de tio
svenska evalfrågorna och hyresvärdsfrågan (`warehouse/features/workers_ai/eval/sfs-all-search.json`).
En fråga räknas som hittad när den väntade paragrafen är bland de åtta.

| Variant | Recall@8, paragraf | Andel förordningar | Lagar, median | Lagar, max |
| --- | --- | --- | --- | --- |
| Vektor, åtta stycken (som förut) | 7/11 | 6,2 % | 4 | 8 |
| Vektor, en per paragraf | 7/11 | 6,2 % | 4 | 8 |
| Vektor, en per paragraf, högst fyra lagar (valet) | 7/11 | 4,2 % | 4 | 4 |
| Som valet, förordningar −0,02 | 7/11 | 0 % | 3,5 | 4 |
| FTS5 och vektor (RRF), en per paragraf, fyra lagar | 7/11 | 3,1 % | 4 | 4 |

Valet behåller recall och sätter taket på fyra lagar. FTS5 bytte en träff mot en annan och tog
2,2 s att bygga när tjänsten startar, så det används inte. Nedviktningen av förordningar ändrade
inte recall och skulle dölja förordningar som svarar på en fråga, så den används inte heller.

## Tider före och efter, 2026-11-07

Före: `platform/publish/allegora/eval_live.ts --label baseline` mot Cloud Run-tjänsten, `/api/answer`.
Efter: `platform/publish/allegora/eval_stream.ts --label after` mot söktjänsten med den nya
rangordningen körd lokalt, `/api/ask`. Båda ställer de tio svenska evalfrågorna och två
referensfrågor genom Workerns egen kod, från en dator i Sverige. Talen gäller varm tjänst; den
första frågan före träffade en kall tjänst och är inte med i medianen.

| Mått | Före | Efter |
| --- | --- | --- |
| Första innehåll (träffarna) | 8,0 s, allt på en gång | 0,33 s median, 0,46 s max |
| Första svarstext | 8,0 s | 1,35 s median, 1,67 s max |
| Verifierat svar | 8,1 s median (6,8–8,8 s) | 3,9 s median (2,8–5,0 s) |
| Fabeln klar | samma som svaret | 8,7 s median |
| Recall@8, paragraf | 7/11 | 7/11 |
| Lagar bland de åtta | 1–8 | 1–4 |
| Fråga om något annat | Claude anropas | `no_answer` utan Claude-anrop |

Före tog sökningen 191 ms i median, svaret 3,3 s och fabeln 4,6 s, i följd.

- Hyresvärdsfrågan gav före bara första stycket av jordabalken 12 kap. 26 §. Efter kommer hela
  paragrafen, och svaret tar med att mindre brådskande arbeten kräver tillsägelse en månad i förväg.
- "Får min hyresvärd höja hyran hur som helst?" var `verified` före och `unverified` efter, ett
  prov var.
- Följdfrågor (`sfs-all-after-chains.jsonl`): "Och om jag är provanställd?" efter frågan om
  uppsägningstid fann LAS 6 § och svarade om provanställning. "Måste hen säga till innan?" efter
  hyresvärdsfrågan svarade med tillsägelse en månad i förväg. "Kan jag spara några till nästa år?"
  efter frågan om semesterdagar fann semesterlagen 18 § om sparade dagar.
- Claude-tokens: före 23 anrop med 33 017 in och 7 883 ut. Efter, med kedjorna, 59 769 in och
  12 582 ut.
- Kallstart före: första `GET /health` efter en natts vila tog 4,8 s. Första sökningen mot en kall
  tjänst tog 3,5 s. Efter, den 8 november: första `GET /health` 3,9 s och första sökningen 4,4 s.
  Enligt Cloud Runs loggar tog det 3,1–4,6 s från att en instans startade tills indexet var inläst
  före, och 3,6–4,3 s efter. Den lata inläsningen nedan kortade alltså inte kallstarten i Cloud Run;
  tiden går åt någon annanstans än till att tolka raderna.
- Kallstarten döljs utan att en instans står varm. Tjänsten tolkar inte längre alla 105 303
  rader i `passages.jsonl` när den startar: den läser id, rubrik och lag ur varje rad och tolkar
  resten av en rad först när paragrafen ska skickas (`retrieval.Lines`). Lokalt sjönk inläsningen
  från 1,1 s till 0,5 s och minnet från 424 MB till 170 MB, men i Cloud Run blev starten inte kortare. Dessutom väcker sidan tjänsten när
  Allegora öppnas (`POST /api/warm`, som Workern skickar vidare till `GET /health`), så att starten
  hinner bli klar medan besökaren skriver sin fråga.

CPU-tid: `platform/publish/allegora/cpu_ask.ts` kör `/api/ask` i Node med nätet ersatt, åtta
paragrafer om 2 000 tecken, och mäter `process.cpuUsage()` över 400 frågor. Medel 5,0 ms med 150
bitar från Claude och 7,2 ms med 400. Talet tar med testets egen läsning av strömmen och är en
övre gräns. Den första frågan, innan V8 har optimerat koden, tog 47 ms.
