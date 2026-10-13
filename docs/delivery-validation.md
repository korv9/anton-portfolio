# Semantisk kontroll före dataleverans

Kontrollerad 13 oktober 2026. Denna worker har lagt till
`platform/publish/validate_refresh_delivery.py`,
`platform/tests/python/test_refresh_delivery_validation.py` och denna rapport.
Tidigare sammanfattningsimplementation och andra agenters ändringar är bevarade.
Workflows, leveransspecifikationer och schemafiler ägs av root och har inte ändrats.

## Anrop och resultat

`--root` är katalogen som innehåller `jobs/`, `parliament/` och `diva/`, inte
repositoryroten. Varje grupp kontrolleras separat:

```sh
python platform/publish/validate_refresh_delivery.py --group jobs --root frontend/public/data
python platform/publish/validate_refresh_delivery.py --group news --root frontend/public/data
python platform/publish/validate_refresh_delivery.py --group diva --root frontend/public/data
```

Jobs kan dessutom kräva färsk streamtäckning:

```sh
python platform/publish/validate_refresh_delivery.py --group jobs --root frontend/public/data --stream-state warehouse/raw/jobtech/stream/state.json
```

Root kopplar motsvarande kommando till leveransgruppens `spec.checks` före
`release.py`. Validatorn läser JSON med repositoryts `read_json` och använder i
övrigt standardbiblioteket. Den skriver inga dataset, fyller inga luckor och gör
inga API- eller R2-anrop. Det finns inga nya beroenden.

Exitkod 0 och JSON-status `validated` betyder att kontrollerna passerade.
Fel i data eller filer ger exitkod 1 och JSON-status `failed` med ett kort `error`.
Felaktiga CLI-argument ger argparse-standardens exitkod 2. De koderna gäller
validatorn; sammanfattarens separata kontrakt använder kod 2 för valfria AI-fel.

## Jobs

Kontrollerna följer `export_market.py`:

- Alla numeriska JSON-värden måste vara ändliga. NaN och Infinity avslås.
- `monthly` och `daily` har rader `[datum, annonser, vakanser]`. Datum måste vara
  kalendergiltiga, unika och strikt stigande inom varje fältserie. Månader måste
  vara avslutade; dagar måste ligga före dagens datum i Stockholm.
- Annons- och vakansräknare måste vara icke-negativa heltal. Boolean, decimaler
  och negativa värden avslås även i occupations, regions, conditions och archives.
- `last_month` är sista `monthly.all`-månaden. Dess år och månadsnummer ska stämma
  med `latest_year` och `ytd_months`. `years` ska vara den sorterade unika årlistan
  från `monthly.all`. Årsräknare får inte referera till andra år.
- Fältvärden får inte överstiga motsvarande `all`-värde när båda finns. Jämförelsen
  gäller månads- och dagsräknare, regionernas års-/YTD-räknare och conditions per
  år, kategori och etikett. YTD får inte överstiga motsvarande helårsräknare.
- Fält-, occupations- och regionidentifierare ska vara unika. Preliminary-månader
  ska finnas i den exporterade totala månadsserien.

Fält summeras inte till en tvingad totalsumma. Kontrollen kräver inga rader för
varje månad eller dag och skapar inga nollrader. `ytd_months` betyder senaste
kompletta månads kalendernummer enligt `int_market_periods`, inte antalet
observerade månadsrader. Utan `--stream-state` är detta en innehållskontroll av en
daterad leverans; den påstår inte att dagens stream har hämtats.

## Streamtäckning

Koordinatorn bekräftade att det befintliga ingestionkontraktet räcker för denna
kontroll: `complete_from` och `fetched_until` skrivs till state först efter
framgångsrika hämtfönster. Ingen ny `verified`-markör behövs.

`complete_from` ska vara ett giltigt kalenderdatum senast gårdagen i
`Europe/Stockholm`. `fetched_until` ska ha datum och klockslag, ligga från dagens
lokala midnatt till nu och aldrig i framtiden. Offsetlösa tidsstämplar tolkas som
Stockholmtid, precis som `ingest_stream.py`; offsetförsedda värden konverteras
till samma tidszon. Senaste kompletta dag är `fetched_until`-datum minus en dag.
Om filen dessutom har `last_complete_day` måste den stämma med den härledda dagen.
Exporterade dagsrader får inte ligga efter täckningens slut.

En senast observerad annons från förrgår godkänns när vattenmärket täcker gårdagen.
Noll annonser är alltså inget bevis på avbrott. Stale, saknat, ogiltigt eller
framtida vattenmärke avslås när `--stream-state` begärs. Detta verifierar det
angivna vattenmärkets struktur och färskhet, inte råfilernas hash, extern
fullständighet eller att state hör till just de exporterade bytesen. Proveniens
och leveransintegritet behöver root kontrollera separat.

## News

`parliament/news.json` måste ha unika artikel-id:n, giltiga publiceringstidsstämplar
med tidszon och källreferenser som finns i `sources`. Framtida tidsstämplar och
icke-ändliga numeriska värden avslås. Sammanfattningsfilen är valfri; om den finns
kontrolleras genereringsdatum, originalperiod, text och citerade artikel-id:n.
Kända citerade artiklar måste ligga inom sammanfattningens originalperiod, och
partinoteringar måste stödjas av de citerade artiklarnas partitaggar.

En aktuell sammanfattning med okända citat avslås. En tidigare daterad
sammanfattning vars period börjar före de synliga artiklarnas första dag får
behålla äldre id:n som saknas i det nuvarande exportfönstret. Det kräver att
sammanfattningen genererades före nyhetsexporten och ger en uttrycklig varning om
att dessa citat behöver verifieras mot arkiverade poster. En period som delvis
överlappar det synliga fönstret kan också ha sådana äldre citat. Giltiga, kända
citat kontrolleras fortfarande.

Från ett begränsat exportfönster går det inte att bevisa att ett saknat historiskt
id fanns i arkivet. Validatorn redovisar den begränsningen och tar aldrig bort en
gammal sammanfattning eller ändrar dess datum. Den verifierar inte språkmodellens
tolkning av artikeltext eller att alla relevanta artiklar har arkiverats.

## DiVA

`diva_clusters.py` exporterar unika heltals-id:n för kluster och punkter med
`x`, `y`, `c` och `t`. Validatorn kräver ändliga numeriska koordinater, unika
kluster-id:n och punktreferenser till befintliga kluster. Exporten har inget
enskilt post-id i punkterna, så punktunikhet kan inte verifieras. Upprepade
titlar eller koordinater avslås inte som påstådda dubblettposter. Statusen
redovisar detta som en varning. Den lokala verkliga DiVA-filen saknas; gruppen
har verifierats med exporterens form som testfixture.

## Verifierat

```text
python -m pytest platform/tests/python/test_refresh_delivery_validation.py -q --basetemp tmp/refresh-validation-tests
61 passed

python -m pytest platform/tests/python/test_refresh_delivery_validation.py platform/tests/python/test_summarize_news.py -q --basetemp tmp/refresh-validation-combined
95 passed

python -m pytest platform/tests -q --basetemp tmp/refresh-validation-full-tests
420 passed, 2 skipped in 37.15s
```

Rapporten fick 0 träffar i repositoryts `check_ai_signs.py` och filerna passerade
`git diff --check`.

Fallen täcker falska deltotaler, dubbla eller oordnade perioder, framtida datum,
negativa/icke-heltalsräknare, NaN/Infinity, stale eller framtida täckning,
Stockholms dygnsgräns, giltiga glesa dagsserier, aktuell sammanfattningsgrundning,
bevarande av äldre citat/period och DiVA-koordinater. CLI-testernas tid är fixerad
så att de fungerar även när maskinens kalenderdatum ändras.

De faktiska lokala jobs- och news-leveranserna passerade kommandona ovan utan
stream-färskhetskrav. News behöll originalperioden 2–8 oktober 2026 och fick inga
varningar. Inga verkliga leveransfiler ändrades av kontrollerna.

Decision: Streamtäckning härleds från ingestion state och aldrig från en annonsrad.
Finding: Faktiska jobs/news passerar semantisk kontroll utan krav på färsk state.
Finding: Äldre sammanfattningars originalperiod bevaras; saknade arkivcitat redovisas.
Open question: Root måste verifiera provenance och faktisk liveleverans separat.
