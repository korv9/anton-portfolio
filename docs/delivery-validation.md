# Semantisk kontroll före dataleverans

`platform/publish/validate_refresh_delivery.py` kontrollerar innehållet i jobb-,
nyhets- och DiVA-leveranserna innan `release.py` publicerar dem. Offentliga data
har sin egen kontroll i `validate_public_data.py`. Publiceringens regler står i
[r2-delivery-contract.md](r2-delivery-contract.md).

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

Grupperna `jobs` och `diva` kör kommandot i sitt publiceringssteg i
`platform/pipeline.yml`. Alla tre grupperna har det dessutom som `checks` i sin
spec under `configs/delivery/`, så `release.py` kör det före uppladdningen.
Validatorn läser JSON med repositoryts `read_json` och använder i
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

Kontrollen bygger på ingestionens eget state: `complete_from` och `fetched_until` skrivs till state först efter
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
fullständighet eller att state hör till just de exporterade bytesen.

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
redovisar detta som en varning. Gruppen är verifierad med exportens form som
testfixture, inte mot en verklig DiVA-fil.

## Tester

`platform/tests/python/test_refresh_delivery_validation.py` täcker falska
deltotaler, dubbla eller oordnade perioder, framtida datum, negativa räknare och
räknare som inte är heltal, NaN och Infinity, stale eller framtida täckning,
Stockholms dygnsgräns, giltiga glesa dagsserier, sammanfattningens citat,
bevarande av äldre citat och period samt DiVA-koordinater. Tiden är fixerad i
CLI-testerna, så de fungerar oavsett maskinens datum.

```sh
python -m pytest platform/tests/python/test_refresh_delivery_validation.py -q
```
