"""Publish the Riksdag ↔ AI Act analysis.

    python platform/publish/ai_politics/export_ai_politics.py

Writes under frontend/public/data/ai-act/politics/:

    summary.json      corpus counts, the concept dictionary (patterns verbatim), the framing
                      pairs, the phases and the similarity run (model, chance baseline)
    monthly.json      month: speeches, AI speeches, AI Act speeches, share, 3-month rolling share
    party-year.json   party × year: speeches, AI speeches, share
    concepts.json     party (or ALL) × period × concept among AI speeches: count and share (per
                      year for ALL only; parties per phase and over the whole period)
    framing.json      framing pairs per party and phase, balance from ten speeches
    examples.json     example AI paragraphs per concept, and every paragraph naming the AI Act
    similarity.json   per AI Act article, the closest Riksdag AI paragraphs (top 3), with both
                      passages, where the pair is above the chance baseline; semantic
                      similarity, derived

Excerpts are cut at a word boundary and link to the speech on data.riksdagen.se. Registered in
the delivery catalogue like the other exports.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[3]
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
FEATURES = Path(os.environ.get("PORTFOLIO_FEATURES", ROOT / "warehouse/features")) / "ai_politics"
OUT = ROOT / "frontend/public/data/ai-act/politics"
PHASES = [
    {"id": "before_proposal", "until": "2021-04-20",
     "label_en": "Before the proposal", "label_sv": "Före förslaget"},
    {"id": "negotiation", "from": "2021-04-21", "until": "2024-07-11",
     "label_en": "Proposal to publication", "label_sv": "Från förslag till publicering"},
    {"id": "after_publication", "from": "2024-07-12",
     "label_en": "After publication", "label_sv": "Efter publiceringen"},
]


def excerpt(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return cut + " …"


def rows(con, sql: str) -> list[dict]:
    frame = con.sql(sql).df()
    records = json.loads(frame.to_json(orient="records", date_format="iso", force_ascii=False))
    for record in records:
        for key, value in record.items():
            if isinstance(value, str) and value.endswith("T00:00:00.000"):
                record[key] = value[:10]
            elif isinstance(value, float):
                record[key] = round(value, 5)
    return records


def dump(name: str, payload) -> Path:
    path = OUT / name
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return path


def main() -> int:
    con = duckdb.connect(str(DATABASE), read_only=True)
    OUT.mkdir(parents=True, exist_ok=True)
    counts = con.sql("""
        select count(*) as speeches,
               count(*) filter (where mentions_ai) as ai_speeches,
               count(*) filter (where names_ai_act) as ai_act_speeches,
               min(speech_date) as first_date, max(speech_date) as last_date,
               count(distinct session) as sessions
        from gold.fact_ai_speech""").df().iloc[0]
    paragraphs = con.sql("select count(*) from silver.int_ai_speech_paragraphs").fetchone()[0]
    concepts = rows(con, """
        select concept_id, kind, label_en, label_sv, pattern, case_sensitive, description_en,
               description_sv, caveat_en from seeds.ai_politics_concepts order by sort_order""")
    pairs = rows(con, "select * from seeds.ai_politics_framing_pairs")
    run = json.loads((FEATURES / "run.json").read_text(encoding="utf-8"))
    summary = {
        "counts": {"speeches": int(counts.speeches), "ai_speeches": int(counts.ai_speeches),
                   "ai_act_speeches": int(counts.ai_act_speeches), "ai_paragraphs": int(paragraphs),
                   "sessions": int(counts.sessions)},
        "first_date": str(counts.first_date)[:10], "last_date": str(counts.last_date)[:10],
        "source": {"label": "Riksdagen, open data: speeches (anföranden) per riksmöte",
                   "url": "https://www.riksdagen.se/sv/dokument-och-lagar/riksdagens-oppna-data/anforanden/"},
        "concepts": concepts, "pairs": pairs, "phases": PHASES,
        "similarity": {k: run[k] for k in ("model", "act_version", "act_language", "act_passages",
                                           "speech_paragraphs", "baseline_random_pairs", "top1_per_speech")},
        "method": "dictionary-v1",
    }
    monthly = rows(con, "select * from gold.mart_ai_politics_monthly order by month")
    for m in monthly:
        m["month"] = m["month"][:7]
    party_year = rows(con, "select * from gold.mart_ai_politics_party_year order by party, year")
    concept_rows = rows(con, """
        select party, period, period_kind, concept_id, ai_speeches, speeches_with_concept, share
        from gold.mart_ai_politics_concepts
        where period_kind <> 'year' or party = 'ALL'
        order by party, period_kind, period, concept_id""")
    framing = rows(con, """
        select pair_id, party, period, period_kind, ai_speeches, speeches_a, speeches_b,
               speeches_both, balance
        from gold.mart_ai_politics_framing order by pair_id, party, period""")
    examples = rows(con, """
        select concept_id, speech_id, paragraph, text, speech_date, party, speaker, debate_title, source_url
        from gold.mart_ai_politics_examples order by concept_id, speech_date desc, speech_id""")
    for e in examples:
        e["text"] = excerpt(e["text"], 520)
    similarity = rows(con, """
        select article_number, rank, similarity, above_chance, act_passage_id, act_passage_sv,
               speech_id, paragraph, speech_paragraph, speech_date, party, speaker, debate_title, speech_url
        from gold.mart_ai_act_speech_similarity where rank <= 3 and above_chance
        order by try_cast(regexp_extract(article_number, '^[0-9]+') as integer), article_number, rank""")
    for s in similarity:
        s["act_passage_sv"] = excerpt(s["act_passage_sv"], 320)
        s["speech_paragraph"] = excerpt(s["speech_paragraph"], 420)
    written = [
        dump("summary.json", summary), dump("monthly.json", monthly),
        dump("party-year.json", party_year), dump("concepts.json", concept_rows),
        dump("framing.json", framing), dump("examples.json", examples),
        dump("similarity.json", similarity),
    ]
    sys.path.insert(0, str(ROOT / "platform/publish/symbolic"))
    import export_symbolic

    export_symbolic.register(written)
    print(f"AI politics: {summary['counts']} -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
