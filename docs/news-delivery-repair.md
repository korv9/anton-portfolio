# Nyhetsleverans efter sammanfattningsfel

Kontrollerad 13 oktober 2026. Ändringen gäller `platform/publish/summarize_news.py`
och `platform/tests/python/test_summarize_news.py`; denna rapport är den tredje
ändrade filen. `export_news.py` behöver ingen ändring. Workflowintegration och
R2-publicering ägs av koordinatorn.

## Fel och ansvar

Releasegranskningen dokumenterar att [körning 38254066287 den 12 oktober](https://github.com/korv9/anton-portfolio/actions/runs/38254066287)
hämtade nyheter men stoppades av `max_tokens` före commit, medan main fortfarande
hade en nyhetsfil från 8 oktober. Den tidigare sammanfattaren returnerade 1 för
modellstopp och lät API-fel lämna processen utan delstatus. Commitvillkoret jämförde
bara `news.json`, så en ändrad sammanfattning kunde också bli kvar opublicerad.

Hämtning, arkiv, taggning, dbt och export är obligatoriska steg. AI-sammanfattningen
är valfri. Sammanfattaren ändrar aldrig `news.json` och skriver bara en ny
`news-summaries.json` efter ett fullständigt, schemavaliderat och citerat resultat.
Skrivningen använder den befintliga atomiska hjälparen `write_bytes_retrying`.
JSON-läsningen använder `read_json`; valideringen använder redan installerade
`jsonschema`. Inga nya beroenden har lagts till.

Vid `refusal`, `max_tokens`, annat ofullständigt modellstopp, nätverksfel, API-fel
eller saknad SDK lämnas föregående sammanfattning byte för byte. Samma regel gäller
tomt, felaktigt eller ogiltigt citerat modellsvar. Rubrik, sammanfattning och
tematexter måste innehålla text; minst ett tema måste ha källhänvisningar. Okända
artikel-id:n eller partier utan stöd i citerade artiklars taggar gör hela svaret
ogiltigt. Sammanfattaren skapar ingen ersättningstext när tidigare sammanfattning
saknas.

Datumet i föregående `generated_at` och dess `period` ändras aldrig vid ett
misslyckat eller hoppat försök. `attempted_at` beskriver försöket i statusfilen.
Ett nytt godkänt resultat får ett nytt genereringsdatum och period från de
nyhetsposter som faktiskt skickades till modellen. Kontroll av citat och schema
bevisar inte att varje mening återger källans innebörd korrekt; språkmodellens
sakliga kvalitet behöver fortsatt granskas.

## Exitkoder och status

| Exitkod | Status | Betydelse för workflowet |
| --- | --- | --- |
| 0 | `generated` eller `skipped` | Fortsätt grundleveransen. `skipped` har reason `no_key` eller `no_recent_items`. |
| 2 | `degraded` | Fortsätt grundleveransen och rapportera det valfria AI-felet. |
| 1 | `failed` | Stoppa vid lokalt input-, output- eller statusfilfel. Felaktiga CLI-argument ger också 1. |

Kod 2 används för `refusal`, `max_tokens`, `unexpected_stop`, `api_error`,
`sdk_unavailable`, `invalid_response` och `ungrounded_response`. Kod 1 används för
`input_error`, `output_error` och `status_output_error`. Ett ogiltigt CLI-anrop
skriver argparse-felet till stderr; ingen modellkörning görs.

Varje avslutat försök skriver ett JSON-objekt till stdout.
`--status-file "$RUNNER_TEMP/news-summary-status.json"` sparar samma objekt utanför
publika dataset. Objektet har `schema_version: 1`, `component: news_summary`,
`status`, `reason`, `exit_code`, `attempted_at`, `model`, `days`,
`items_considered`, `summary_preserved` och `active_summary`. När input lästs finns
även `news_generated_at`. `active_summary` innehåller aktiv sammanfattnings
`generated_at`, `period` och `model`, eller null när metadata inte kan läsas.
API-fel rapporterar exceptiontyp och eventuell HTTP-status, utan response body
eller API-nyckel. `summary_preserved` anger att en tidigare fil har lämnats kvar;
det påstår inte att en oläsbar tidigare fil är giltig.

Klienten använder 60 sekunders timeout och inga automatiska retries. Dessa
argument verifierades mot lokalt installerad anthropic 0.96.0 utan API-anrop.
Schemat använder enkel regex och `minItems: 1`, enligt [Anthropics dokumenterade
JSON Schema-stöd](https://platform.claude.com/docs/en/build-with-claude/structured-outputs#json-schema-limitations).
Ingen tokenbudgetökning eller modelländring behövs för att frikoppla leveransen.

## Exakt föreslagen workflowändring

Ersätt sammanfattningssteget i `.github/workflows/refresh-news.yml` med följande.
Steget körs även utan modellnyckel så att ett hoppat försök får status. En valfri
SDK-installations brist ska också synas som delstatus och låta rubrikerna levereras.

```yaml
- name: Summarise the week's news
  id: news_summary
  if: steps.creds.outputs.ok == 'true'
  run: |
    if [ -n "$ANTHROPIC_API_KEY" ]; then
      python -m pip install --timeout 15 --retries 1 anthropic || echo "::warning::Optional summary SDK installation failed"
    fi
    code=0
    python platform/publish/summarize_news.py --days 7 --status-file "$RUNNER_TEMP/news-summary-status.json" || code=$?
    echo "exit_code=$code" >> "$GITHUB_OUTPUT"
    if [ -f "$RUNNER_TEMP/news-summary-status.json" ]; then
      {
        echo '### News summary status'
        echo '```json'
        cat "$RUNNER_TEMP/news-summary-status.json"
        echo '```'
      } >> "$GITHUB_STEP_SUMMARY"
    fi
    case "$code" in
      0) ;;
      2) echo "::warning::Optional news summary failed; the previous summary is retained and base news delivery continues" ;;
      *) exit "$code" ;;
    esac
- name: Keep news summary status
  if: always() && steps.creds.outputs.ok == 'true'
  uses: actions/upload-artifact@v4
  with:
    name: news-summary-status
    path: ${{ runner.temp }}/news-summary-status.json
    if-no-files-found: warn
```

Obligatoriska tidigare steg behåller sina normala felkoder. Använd inte generell
`continue-on-error` för sammanfattningssteget: endast kod 2 får behandlas som
godkänd grundleverans. Publiceringssteget måste följa efter denna fångst och få
publicera både `news.json` och existerande `news-summaries.json`, även om inga nya
rubriker hämtats. Statusfilen är en Actions-artefakt, inte en publicerad nyhetsfil.

Om Git-commitvägen behålls, ersätt dess jämförelse av bara `news.json` med denna
Python-kod i det befintliga `if python ...; then`-villkoret:

```python
import json
import subprocess
import sys
from pathlib import Path

def changed(path):
    previous = subprocess.run(
        ['git', 'show', 'HEAD:' + str(path)], capture_output=True, text=True
    )
    before = json.loads(previous.stdout) if previous.returncode == 0 else None
    after = json.loads(path.read_text(encoding='utf-8-sig')) if path.exists() else None
    for payload in (before, after):
        if payload is not None:
            payload.pop('generated_at', None)
    return before != after

paths = [Path('frontend/public/data/parliament/news.json'),
         Path('frontend/public/data/parliament/news-summaries.json')]
sys.exit(1 if any(changed(path) for path in paths) else 0)
```

Staga därefter `news.json` och lägg till `news-summaries.json` endast om den finns.
En ändrad sammanfattning, period eller modell utlöser då leverans även när
rubrikerna är identiska. Koordinatorns planerade R2-grupp `news` ersätter Git-vägen
med leverans av båda filerna; bytebaserad datasetpublicering behöver inget särskilt
villkor som bara tittar på rubrikerna. Denna worker ändrar inget workflow och gör
ingen extern skrivning.

## Verifiering och återstående livekontroll

Riktad körning:

```text
python -m pytest platform/tests/python/test_summarize_news.py -q --basetemp tmp/news-delivery-tests
34 passed
```

Hela plattformens testsvit passerade också:

```text
python -m pytest platform/tests -q --basetemp tmp/news-delivery-full-tests
309 passed, 2 skipped in 10.59s
```

`git diff --check` godkändes för de ändrade Python-filerna. Rapporten fick 0 träffar
i `.claude/skills/de-ai-writing/scripts/check_ai_signs.py`.

Regressionsfallen använder temporära filer och en mockad SDK. De täcker godkänt
resultat, `max_tokens` med trasig partiell JSON, refusal, annat modellstopp,
connection error, timeout, HTTP 503, saknad SDK, ogiltig JSON, tomma texter,
felaktiga citat, saknad tidigare sammanfattning, hoppade försök, lokala filfel och
CLI-fel. Varje degraderat test jämför föregående sammanfattnings exakta bytes och
ursprungliga datum, samtidigt som `news.json` är oförändrad. Framgångsfallet
verifierar att en ny sammanfattning skapas med faktisk artikelperiod utan att
rubriksfilen ändras.

Ett integrationstest kör den riktiga `export_news.main()` mot en temporär DuckDB
med testposter. Efter export ger sammanfattaren `max_tokens` och kod 2; de nya
exporterade rubrikerna ligger kvar och exportören kan köras igen. Inga testposter
skrivs till produktionsdataset och inga externa modell-, feed- eller R2-anrop görs.

Återstår före godkännande av daglig drift: koordinatorns workflow-/R2-integration,
en riktig schemakörning som levererar aktuella rubriker, kontroll av bevarad
sammanfattning i publicerad datasetversion och ett separat lyckat AI-försök.
Det kräver fungerande feed-/R2-behörigheter och en godkänd modellnyckel samt modell
hos Anthropic. Korta RSS-feeds kan ha tappat artiklar under tidigare avbrott;
denna ändring kan inte återskapa historik som aldrig arkiverades.

Decision: Grundnyheter är obligatoriska; AI-fel ger kod 2 och verifierbar delstatus.
Finding: Mockade fel bevarar föregående sammanfattning och dess verkliga datum.
Finding: Export kan köras före och efter ett valfritt sammanfattningsfel.
Open question: Första verkliga schemakörningen och R2-leveransen återstår att verifiera.
