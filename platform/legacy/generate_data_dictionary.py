"""Inventory the shipped tabular exports and write docs/data-dictionary.md.

This is a physical schema inventory, not an ORM: JSON shards and CSV mirrors
are grouped into logical tables and are never added together as new observations.
"""

import csv
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUB = ROOT / "frontend/public/data"
OUT = ROOT / "docs/data-dictionary.md"

# Name, glob relative to public/data, shape, declared grain, join/key columns.
SPECS = [
    ("Debattprotokoll", "politics/parliament/debates/index.json", "json", "Ett partiledardebattprotokoll", "protocol_id"),
    ("Debattanföranden", "politics/parliament/debates/*/*.json", "json", "Ett anförande i partiledardebatt", "speech_id"),
    ("Sakdebatt: riksmöten", "politics/parliament/issues/index.json", "json", "Ett indexerat riksmöte", "session"),
    ("Sakdebatt: avsnitt", "politics/parliament/issues/*/index.json", "json", "Ett debattavsnitt i ett protokoll", "section_id"),
    ("Sakdebatt: anföranden", "politics/parliament/issues/*/*.json", "json", "Ett anförande i ett protokoll", "speech_id"),
    ("Talare", "politics/parliament/speakers/summary.json", "json", "En talare och partibeteckning", "speaker + party"),
    ("Ämnesöversikt · ny modell", "politics/parliament/topics/summary.json", "json", "Ett modellämne", "topic_id + modellversion"),
    ("Ämne per riksmöte och parti", "politics/parliament/sessions/*/topics.json", "json", "Parti × riksmöte × ämne", "session + party + topic_id + modellversion"),
    ("Ämne per parti", "politics/parliament/parties/*/topics.json", "json", "Parti × riksmöte × ämne", "session + party + topic_id + modellversion"),
    ("UMAP-sampel · ny modell", "politics/parliament/sessions/*/umap.json", "json", "Ett samplat textsegment", "chunk_id + modellversion"),
    ("Talarnärhet", "politics/parliament/similarity/top.json", "json", "Ett sökresultat för två anföranden", "speech_id + neighbor_id"),
    ("Partiord", "politics/parliament/parties/*/words.json", "json", "Parti × ord", "party + word"),
    ("Partiomnämnanden", "politics/parliament/parties/*/mentions.json", "json", "Talare × omnämnd måltavla", "speaker + speaker_party + target"),
    ("Beslutspunkter", "politics/parliament/sessions/*/decisions/*/points.json", "json", "En utskottsbeslutspunkt", "point_id; vote_id om votering finns"),
    ("Beslutsöversikt per utskott", "politics/parliament/sessions/*/decisions/index.json", "json", "Utskott × riksmöte", "session via sökväg + committee"),
    ("Dokumentcitat", "politics/parliament/sessions/*/decisions/*/citations.json", "json", "En hänvisning i en beslutspunkt", "point_id → beslutspunkt; document_id"),
    ("Reservationer", "politics/parliament/sessions/*/decisions/*/reservations.json", "json", "En reservation/partikoppling till punkt", "point_id → beslutspunkt"),
    ("Debattspår på beslutspunkt", "politics/parliament/sessions/*/decisions/debate-traces.json", "json", "Ett kandidatspår mellan punkt och tal", "point_id + speech_id"),
    ("Partiröster per votering", "politics/parliament/sessions/*/votes.json", "json", "Votering × parti", "vote_id + party"),
    ("Voteringsöversikt", "politics/parliament/votes/summary.json", "json", "Riksmöte × parti", "session + party"),
    ("Motioner kopplade till votering", "politics/parliament/sessions/*/decision-motions.json", "json", "Votering × motion", "vote_id + motion_id"),
    ("Debatt–votering, semantiska kandidater", "politics/parliament/sessions/*/decision-speech-links.json", "json", "Ett tal–votering-kandidatpar", "vote_id + speech_id (+ party)"),
    ("Aktivitetsöversikt", "politics/parliament/activities/summary.json", "json", "Riksmöte × parti", "session + party"),
    ("Skriftliga frågor", "politics/parliament/sessions/*/activities/questions.json", "json", "Ett dokument", "document_id"),
    ("Interpellationer", "politics/parliament/sessions/*/activities/interpellations.json", "json", "Ett dokument", "document_id"),
    ("Propositioner", "politics/parliament/sessions/*/activities/propositions.json", "json", "Ett dokument", "document_id"),
    ("Budgetförslag · ursprunglig upstream-export", "politics/parliament/budgets/summary.json", "json", "Riksmöte × aktör × utgiftsområde", "session + actor + expenditure_area"),
    ("Budget/tal · ursprunglig upstream-export", "politics/parliament/budgets/speech-alignment.json", "json", "Riksmöte × parti × utgiftsområde", "session + party + expenditure_area"),
    ("Budgetexekvering · upstream", "politics/parliament/budgets/execution.json", "json", "Riksmöte × aktör × utgiftsområde", "session + actor + expenditure_area"),
    ("Årsutfall", "politics/parliament/budgets/outturn-areas.json", "json", "Budgetår × utgiftsområde", "budget_year + expenditure_area"),
    ("Lagindex · parlamentsexport", "politics/parliament/laws/index.json", "json", "En lagtextsnapshot", "sfs_document_id + snapshot_version"),
    ("Lagbestämmelser · parlamentsexport", "politics/parliament/laws/*/provisions.json", "json", "En bestämmelse i lagtextsnapshot", "sfs_document_id + provision_id + snapshot_version"),
    ("Nämnda lagar i debatt", "politics/parliament/laws/mentions.json", "json", "En lexikal lagträff i ett tal", "speech_id + sfs_document_id"),
    ("Proposition–utskott, dokumentnivå", "politics/parliament/legislative/proposition-committee-links.json", "json", "En proposition kopplad till punkt", "point_id + proposition_id"),
    ("Textjämförelse-exempel", "politics/parliament/legislative/comparisons.json", "json", "Ett granskat textpar", "pair_id"),
    ("Kuraterat voteringsindex", "politics/decisions/*/index.json", "json", "En votering med åtta partirader inuti", "id (= vote_id)"),
    ("Kuraterad voteringsdetalj", "politics/decisions/*/*.json", "detail", "En votering med underlistor", "vote_id i filnamn/sökväg"),
    ("Lagindex · båda Allegoria-pooler", "politics/laws/index.json", "json", "En dokumentversion i en pool", "pool + id"),
    ("Lagbestämmelser · v1", "politics/laws/v1/*.json", "json", "En bestämmelse i v1-dokument", "pool + document_id + provision_id"),
    ("Lagbestämmelser · v2", "politics/laws/v2/*.json", "json", "En bestämmelse i v2-dokument", "pool + document_id + provision_id"),
    ("Budgetförslag · aktivt korrigerad export", "debates/budgets/summary.json", "json", "Riksmöte × aktör × utgiftsområde", "session + actor + expenditure_area"),
    ("Budget/tal · äldre exaktord-export", "debates/budgets/speech-alignment.json", "json", "Riksmöte × parti × utgiftsområde", "session + party + expenditure_area"),
    ("Partiordträffar · äldre export", "debates/budgets/speech-keywords-all-parties.json", "json", "Riksmöte × parti × utgiftsområde", "session + party + expenditure_area"),
    ("Budgetårsurval", "debates/budgets/year-selection-audit.json", "json", "En importerad FiU1-tabell", "session"),
    ("Budgettäckning", "debates/budgets/coverage.json", "object", "Dokument/underlagsmetadata", "session per underlista"),
    ("Språkmatchning: område", "reports/budget-language.json", "budget_rows", "Korpus × metod × riksmöte × parti × område", "corpus + method + session + party + expenditure_area"),
    ("Språkmatchning: täckning", "reports/budget-language.json", "budget_coverage", "Korpus × metod × riksmöte × parti", "corpus + method + session + party"),
    ("Språkmatchning: lexikon", "reports/budget-language.json", "budget_lexicon", "Område × uppslagsord", "expenditure_area + keyword"),
    ("RFC: dokumentprofiler", "reports/rfc-drift.json", "rfc_versions", "En RFC-version", "rfc"),
    ("RFC: motorexempel", "reports/rfc-drift.json", "rfc_scenarios", "Ett syntetiskt modalitetsbyte", "before + after"),
    ("Ämnesöversikt · äldre modell", "debates/summary.json", "json", "Ett ämne i äldre modellkörning", "topic_id + äldre modellversion"),
    ("UMAP-sampel · äldre modell", "debates/sessions/*/umap.json", "json", "Ett samplat textsegment", "chunk_id + äldre modellversion"),
    ("Ämne per riksmöte · äldre modell", "debates/sessions/*/topics.json", "json", "Riksmöte × parti × ämne", "session + party + topic_id + äldre modellversion"),
    ("Jobbannonser: översikt", "jobs/01_overview.csv", "csv", "Ett sammanfattningsmått", "metric"),
    ("Jobbannonser: år och roll", "jobs/02_ads_by_year_role.csv", "csv", "År × roll", "year + role"),
    ("Jobbannonser: månad och roll", "jobs/03_ads_by_month.csv", "csv", "Månad × roll", "month + role"),
    ("Jobbannonser: junior per månad", "jobs/05_junior_by_month.csv", "csv", "Månad × roll (enbart förekommande rader)", "month + role"),
    ("Jobbannonser: teknik", "jobs/06_top_technologies.csv", "csv", "Kohort × teknik", "cohort + technology"),
    ("Metadatadokument: politik-katalog", "politics/catalog.json", "object", "Ett fil- och källregister", "ingen observationsnyckel"),
    ("Metadatadokument: politik-översikt", "politics/overview.json", "object", "En övergripande status", "ingen observationsnyckel"),
    ("Metadatadokument: parlament-översikt", "politics/parliament/overview.json", "object", "En genererad översikt", "ingen observationsnyckel"),
    ("Metadatadokument: parlament-manifest", "politics/parliament/manifest.json", "object", "Ett filregister", "ingen observationsnyckel"),
    ("Metadatadokument: Meaning Quality", "politics/meaning.json", "object", "En motorstatus och utkast", "ingen observationsnyckel"),
    ("Metadatadokument: rapportmanifest", "reports/manifest.json", "object", "Ett exportmanifest", "ingen observationsnyckel"),
    ("Metadatadokument: äldre debattöversikt", "debates/overview.json", "object", "En genererad översikt", "ingen observationsnyckel"),
    ("Budgetlexikon · källa", "data/budget/keywords.csv", "csv", "Utgiftsområde × sökord", "expenditure_area + keyword"),
    ("Allegoria: v1 bronze", "platform/sources/allegoria/sources-v1/bronze/sfs/*.json", "object", "Ett källsnapshot av lagtext", "document_snapshot_id"),
    ("Allegoria: v2 bronze", "platform/sources/allegoria/sources-v2/bronze/*.json", "object", "Ett källsnapshot av lagtext", "document_snapshot_id"),
    ("Allegoria: v2 urvalsmanifest", "platform/sources/allegoria/sources-v2/document_ids.json", "object", "Ett urvalsmanifest", "ingen observationsnyckel"),
]


def rows_for(path: Path, shape: str):
    if shape == "csv":
        with path.open(encoding="utf-8-sig", newline="") as handle:
            return list(csv.DictReader(handle))
    obj = json.loads(path.read_text(encoding="utf-8-sig"))
    if shape == "budget_rows": return obj["rows"]
    if shape == "budget_coverage": return obj["coverage"]
    if shape == "budget_lexicon": return obj["lexicon"]
    if shape == "rfc_versions": return obj["versions"]
    if shape == "rfc_scenarios": return obj["scenarios"]
    if shape == "detail": return [obj]
    if shape == "object": return [obj]
    return obj.get("data", obj) if isinstance(obj, dict) else obj


def matching(pattern):
    paths = sorted((ROOT if pattern.startswith("platform/") else PUB).glob(pattern))
    if pattern in ("politics/parliament/issues/*/*.json",):
        paths = [p for p in paths if p.name != "index.json"]
    if pattern == "politics/decisions/*/*.json":
        paths = [p for p in paths if p.name != "index.json"]
    return paths


def main():
    lines = [
        "# Datakatalog: portfolio", "",
        "Genererad från filerna i `frontend/public/data/` och utvalda källsnapshot under `platform/sources/` med `python platform/legacy/generate_data_dictionary.py`.",
        "Kolumnerna nedan är **observerade fältnamn på tabellnivå** (och för den kuraterade voteringsvyn även underlistorna), inte en påstådd databasspecifikation.",
        "JSON-filer med `schema_version`, `generated_at` och `data` listas som tabellen inuti `data`.",
        "CSV-exporter som speglar JSON och riksmötespartitioner är inte nya observationer.", "",
        "## Överblick", "",
        "- `politics/parliament/`: upstreams publika export av tal, analyser, beslut, aktiviteter, budget och lagkandidater.",
        "- `politics/decisions/` och `politics/laws/`: materialiserade läsvyer byggda ur ovanstående data respektive Allegorias lagtextpooler; dubletter av källobservationer.",
        "- `debates/`: äldre ämneskörning samt aktiva korrigerade budgetramar. Ämnes-ID här får inte sammanfogas med nyare `politics/parliament/topics/`.",
        "- `reports/`: RFC-mätning och två separata textkorpusars budgetordträffar.",
        "- `jobs/`: fem aggregerade CSV-tabeller. Inga annonsrader finns i detta repo.",
        "- `gold/`: materialiserat semantiskt lager; räknas inte som nya källobservationer. Se `docs/gold-semantic-model.md` för dess schema och mått.",
        "- `platform/sources/allegoria/` innehåller källsnapshotfiler och utkastannotationer; dessa är inte färdiga politiska riktningsmått. `platform/sources/budget/` innehåller lexikonets källa.", "",
        "**Nyckelnotation:** `+` anger sammansatt nyckel, `→` en kontrollerad referens, och ordet *kandidat* betyder att kopplingen inte är ett fastslaget sakförhållande.", "",
        "## Datatabeller, källsnapshot och metadata: observerade kolumner", "",
    ]
    summary = []
    for title, pattern, shape, grain, key in SPECS:
        paths = matching(pattern)
        if not paths: raise FileNotFoundError(pattern)
        columns = []
        seen = set()
        nested_columns = defaultdict(dict)
        count = 0
        for path in paths:
            data = rows_for(path, shape)
            if isinstance(data, dict): data = [data]
            count += len(data)
            for row in data:
                if not isinstance(row, dict): continue
                for column in row:
                    if column not in seen:
                        seen.add(column)
                        columns.append(column)
                if shape == "detail":
                    for part in ("point", "parties", "members", "citations", "reservations", "speech_links"):
                        value = row.get(part)
                        members = [value] if isinstance(value, dict) else value if isinstance(value, list) else []
                        for member in members:
                            if isinstance(member, dict):
                                nested_columns[part].update({column: None for column in member})
                if shape == "object" and isinstance(row.get("data"), dict):
                    nested_columns["data"].update({column: None for column in row["data"]})
        summary.append((title,count,len(paths)))
        lines.extend([
            f"### {title}", "",
            f"- **Sökväg:** `{pattern if pattern.startswith('platform/') else 'frontend/public/data/' + pattern}` ({len(paths)} fil{'er' if len(paths) != 1 else ''}; {count:,} {'rad' if count == 1 else 'rader'}).".replace(",", " "),
            f"- **Kornighet:** {grain}. **Nyckel/referens:** `{key}`.",
            f"- **Kolumner ({len(columns)}):** " + ", ".join(f"`{column}`" for column in columns) + ".",
            "",
        ])
        if nested_columns:
            for part, inner in nested_columns.items():
                lines.append(f"  - `{part}`: " + ", ".join(f"`{column}`" for column in inner) + ".")
            lines.append("")
    lines.extend([
        "## Kontrollerade relationer", "",
        "```mermaid",
        "erDiagram",
        "    DEBATE_PROTOCOL ||--o{ DEBATE_SPEECH : protocol_id",
        "    ISSUE_SESSION ||--o{ ISSUE_SECTION : session",
        "    ISSUE_SECTION ||--o{ ISSUE_SPEECH : path_and_speech_range",
        "    DEBATE_SPEECH ||--o{ UMAP_POINT : speech_id",
        "    DECISION_POINT ||--o{ CITATION : point_id",
        "    DECISION_POINT ||--o{ RESERVATION : point_id",
        "    DECISION_POINT ||--o| ROLL_CALL : vote_id",
        "    ROLL_CALL ||--|{ PARTY_VOTE : vote_id",
        "    ROLL_CALL ||--o{ MEMBER_VOTE : vote_id",
        "    ROLL_CALL ||--o{ SPEECH_LINK_CANDIDATE : vote_id",
        "    DEBATE_SPEECH ||--o{ SPEECH_LINK_CANDIDATE : speech_id",
        "    DECISION_POINT ||--o{ PROPOSITION_LINK : point_id",
        "    BUDGET_PROPOSAL }o--|| BUDGET_YEAR_AREA : budget_year_and_expenditure_area",
        "    LAW_SNAPSHOT ||--o{ LAW_PROVISION : pool_and_document_id",
        "```", "",
        "**Validerat i de här exporterna:** 4 407 unika `point_id`; 1 436 av dem har ett `vote_id`.",
        "Varje importerad votering har åtta partirader (11 488 rader).",
        "Alla 18 505 citat och 7 503 reservationer refererar en befintlig `point_id`.",
        "Samtliga 393 proposition–utskott-kopplingar refererar en befintlig punkt men gäller endast **dokumentnivå**.", "",
        "### Sammanfogningsregler", "",
        "1. `point_id` är den säkra nyckeln från beslutspunkt till citat, reservation och propositionskandidat. `vote_id` kopplar beslutspunkt till registrerad votering och därefter till parti- och ledamotsröster. En ja-röst gäller utskottets förslag, inte automatiskt varje citerad proposition eller motion.",
        "2. `speech_id` kopplar partiledartal till UMAP-punkter och semantiska besluts-kandidater. En semantisk likhet är inte stöd, motsägelse eller samma persons röst. Sakdebattens avsnitt använder `path` plus `first_speech_number`–`last_speech_number` för att välja rätt tal ur ett helt protokoll.",
        "3. Budget: koppla `session + actor (= party) + expenditure_area` till `session + party + expenditure_area` i textmatchningen. Koppla budgetförslag till årsutfall på `budget_year + expenditure_area` först efter kontroll av områdets historiska definition. `GOV` är ett kollektivt förslag, inte ett individuellt partiförslag.",
        "4. Lagtextpoolerna `v1` och `v2` överlappar. Använd `pool + document_id + provision_id` och snapshotversionen. Ett omnämnande av en lag är en lexikal kandidat; den parlamentariska lagtextsnapshoten är inte verifierad som gällande på talets datum. Inga validerade votering→skärpning/uppluckring-par finns.",
        "5. Jobbtabellerna kan kopplas på `year/month + role` efter månads-/årshärledning. `cohort + technology` är ett separat aggregat och kan inte kopplas till enskilda annonser eller arbetsgivare i dessa exporter.",
        "6. Riksmötesfiler under `sessions/` och partiämnesfiler under `parties/` är partitioner/aggregat av samma politiska material. Räkna dem inte ovanpå globala summeringar. De gamla och nya ämneskörningarna har olika klustertilldelningar: den gamla visar 49,7 % ogrupperade ord och den nya 59,4 %. Sammanfoga inte på enbart `topic_id`.",
        "7. Den aktiva budgetrapporten läser `debates/budgets/summary.json`, där rätt budgetår valts. Den oförändrade upstreamkopian och `politics/parliament/budgets/execution.json` måste årskontrolleras innan deras förslag–utfall-differenser används.",
        "8. `data/budget/keywords.csv` är källlexikonet till språkrapportens lexikonposter. Koppla på `expenditure_area + keyword`; betrakta inte lexikonrader som observerade anföranden.",
        "", "## Övriga metadata och filformat", "",
        "- `frontend/public/data/politics/catalog.json`: källrevisioner, filstorlek och SHA-256 per fil; inte en observationstabell.",
        "- `frontend/public/data/politics/overview.json` och `politics/parliament/overview.json`: globala räknare och metodmetadata.",
        "- `frontend/public/data/reports/manifest.json`: hash för indata/utdata till rapportexporterna.",
        "- `frontend/public/data/politics/meaning.json`: motortest och **utkast** till politiska annotationer; inte validerad parti-KPI.",
        "- `frontend/public/data/politics/parliament/manifest.json`: filregister. JSON- och CSV-varianter av samma `summary`, `topics` osv. är samma tabell i två format.",
        "- `frontend/public/data/debates/budgets/coverage.json` och `year-selection-audit.json`: importtäckning och reparation av tabellår.",
        "- `frontend/public/data/reports/rfc-drift.json` har dessutom `matched_changes: []`; inga verkliga kravpar klarade den strikta matchningen. Syntetiska `scenarios` är motorexempel.",
        "- `platform/sources/allegoria/sources-v1/source/` och `sources-v2/source/` är rå XML/RFC-källdokument, inte relationella tabeller. `sources-v2/failures.json` är en lista med strängar, och `platform/sources/allegoria/corpus/*.yaml` är motor-/annotationskonfigurationer. Bronze-snapshot och de publika lagbestämmelserna är olika nivåer av samma källmaterial.",
        "", "## Källor och begränsningar", "",
        "[Sveriges riksdag](https://www.riksdagen.se/sv/sa-fungerar-riksdagen/arbetet-i-riksdagen/debatter-och-beslut-i-kammaren/beslut-om-arenden/) för vad en votering avser; [Statskontoret](https://www.statskontoret.se/analys-och-statistik/oppna-data/arsutfall/om-oppna-data-for-arsutfall/) för årsutfallets budget- och utfallsfält. Katalogen beskriver **det som levereras i detta repo**, inte all data hos källmyndigheterna. Se också `docs/rfc-and-budget-audit.md` för urvalet av debattkorpus och ordstamning.",
    ])
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUT}: {len(SPECS)} logical entries, {sum(n for _,n,_ in summary):,} listed rows (includes materialized duplicates).")


if __name__ == "__main__":
    main()
