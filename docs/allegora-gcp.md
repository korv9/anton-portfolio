# Allegora på Google Cloud

Allegora (`#fraga-lagen`) söker i alla lagar och förordningar som gäller, inte bara i de 40
utvalda lagarna i `configs/workers_ai/sfs_selection.yaml`. Sökningen körs på Google Cloud i
projektet `allegora-513419`, region `europe-west4`. Svaret, citatkontrollen och fabeln görs
fortfarande av Workern med Gemma på Workers AI ([workers-ai.md](workers-ai.md)).

## Flödet

1. Webbläsaren skickar frågan till `POST /api/answer` med `corpus: "sfs-all"`. Den laddar inte
   ned någon korpus och anropar inte `/api/embed`.
2. Workern skickar frågan till Cloud Run-tjänsten `allegora-search` med headern
   `X-Allegora-Key`. Nyckeln finns som Cloudflare-secret `ALLEGORA_SEARCH_KEY` och i Secret
   Manager som `allegora-search-key`. Adressen står i `wrangler.toml` (`ALLEGORA_SEARCH_URL`).
3. Tjänsten bäddar in frågan med Vertex AI (`text-multilingual-embedding-002`, 256 dimensioner,
   `RETRIEVAL_QUERY`) och jämför den med varje stycke. Sökningen är exakt, inte ungefärlig.
4. Workern svarar från de 8 närmaste styckena och skickar dem med i svaret (`hits`).
   Kontrollen mot publicerade verifieringslistor behövs inte här, eftersom styckena kommer från
   tjänsten och inte från webbläsaren.

Svarar inte tjänsten svarar Workern 503 med `reason: "error"`, och sidan visar samma rad som när
modellen inte svarar.

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
