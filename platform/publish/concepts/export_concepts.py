"""Publish the shared concept layer for the Concept Constellation and the concept pages.

    python platform/publish/concepts/export_concepts.py

Writes under frontend/public/data/concepts/:

    summary.json     the concepts (labels, family, description, anchors, status, method), the
                     corpora (stage, language, sample size, retrieval dates), the run (model,
                     sample, baselines, evaluation) and the relation types with their meaning
    profiles.json    concept × corpus: rank-1 and top-3 shares against chance
    relations.json   concept × concept relations (semantic_similarity, shared_tension), and
                     corpus × corpus relations (documented_reference: Riksdag speeches that name
                     the AI Act)
    passages.json    concept -> corpus -> representative chunks (excerpt and provenance)
    pairs.json       cross-corpus pairs per concept above the random-pair baseline
    links.json       concept -> editorial links to measures elsewhere on the site, with the
                     linked measure's own numbers where the warehouse has them

No embedding is published. Every number is derived; every link and anchor is interpretation;
every passage is source text with its URL.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[3]
DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
FEATURES = Path(os.environ.get("PORTFOLIO_FEATURES", ROOT / "warehouse/features")) / "concepts"
OUT = ROOT / "frontend/public/data/concepts"
EXCERPT = 360
PASSAGES_PER_CORPUS = 3

RELATION_TYPES = [
    {"id": "semantic_similarity", "content_type": "derived",
     "en": "The wording is close in the shared embedding model. Not influence, not shared meaning.",
     "sv": "Formuleringarna ligger nära varandra i den gemensamma embeddingmodellen. Inte påverkan, inte samma betydelse."},
    {"id": "shared_concept", "content_type": "derived",
     "en": "Both passages rank the same curated concept among their three closest.",
     "sv": "Båda passagerna har samma kurerade begrepp bland sina tre närmaste."},
    {"id": "shared_tension", "content_type": "interpretation",
     "en": "The concepts are the two poles of one Philosophy Atlas tension, an editorial choice.",
     "sv": "Begreppen är de två polerna i en spänning i Philosophy Atlas, ett redaktionellt val."},
    {"id": "temporal_overlap", "content_type": "derived",
     "en": "Two series change in the same period. Temporal overlap does not prove causation.",
     "sv": "Två serier förändras under samma period. Samtidighet bevisar inte orsak."},
    {"id": "documented_reference", "content_type": "source",
     "en": "One source names the other in its own text.",
     "sv": "En källa nämner den andra i sin egen text."},
]


def excerpt(text: str, limit: int = EXCERPT) -> str:
    return text if len(text) <= limit else text[:limit].rsplit(" ", 1)[0] + " …"


def rows(con, sql: str) -> list[dict]:
    records = json.loads(con.sql(sql).df().to_json(orient="records", force_ascii=False, date_format="iso"))
    for r in records:
        for k, v in r.items():
            if isinstance(v, float):
                r[k] = round(v, 4)
    return records


def dump(name: str, payload) -> Path:
    path = OUT / name
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return path


def has_table(con, schema: str, table: str) -> bool:
    return bool(con.sql(f"""select count(*) from information_schema.tables
                            where table_schema = '{schema}' and table_name = '{table}'""").fetchone()[0])


def main() -> int:
    con = duckdb.connect(str(DATABASE), read_only=True)
    OUT.mkdir(parents=True, exist_ok=True)
    run = json.loads((FEATURES / "run.json").read_text(encoding="utf-8"))

    concepts = rows(con, """select concept_id, label_en, label_sv, family, description_en, description_sv, anchor_en, anchor_sv,
                                   status, created_by, method from gold.dim_concept order by sort_order""")
    corpora = rows(con, """select corpus_id, label_en, label_sv, stage, language, description_en, domain,
                                  chunks, documents, first_retrieved_at, last_retrieved_at
                           from gold.dim_corpus
                           order by case stage when 'stories' then 1 when 'ideas' then 2
                                               when 'contestation' then 3 else 4 end""")
    profiles = rows(con, """select concept_id, corpus_id, chunks, rank1_chunks, top3_chunks, rank1_share,
                                   top3_share, rank1_chance, rank1_lift from gold.mart_concept_profiles
                            order by concept_id, corpus_id""")

    concept_relations = rows(con, """select concept_a, concept_b, relation_type, strength, tension_id, content_type
                                     from gold.mart_concept_relations order by relation_type, strength desc""")
    named = con.sql("""select count(*), min(speech_date), max(speech_date)
                       from gold.fact_ai_speech where names_ai_act""").fetchone()
    corpus_relations = [{
        "from": "politics", "to": "law", "relation_type": "documented_reference",
        "count": int(named[0]), "first": str(named[1]), "last": str(named[2]),
        "en": "Riksdag speeches that name the AI Act (gold.fact_ai_speech, names_ai_act).",
        "sv": "Riksdagsanföranden som nämner AI-förordningen vid namn.",
        "route": "ai-act-politics",
    }]

    passages: dict[str, dict[str, list]] = {}
    for p in rows(con, f"""select concept_id, corpus_id, representative_rank, similarity, rank, z_score, chunk_id,
                                  language, document_title, location, source_url, source_version,
                                  retrieved_at, period, text
                           from gold.mart_concept_passages
                           where representative_rank <= {PASSAGES_PER_CORPUS}
                           order by concept_id, corpus_id, representative_rank"""):
        p["text"] = excerpt(p["text"])
        passages.setdefault(p.pop("concept_id"), {}).setdefault(p.pop("corpus_id"), []).append(p)

    pairs = rows(con, """select f.concept_id, f.corpus_a, f.corpus_b, f.similarity, f.baseline_mean, f.baseline_p95,
                                a.text as text_a, a.document_title as title_a, a.location as location_a,
                                a.source_url as url_a, a.language as language_a,
                                b.text as text_b, b.document_title as title_b, b.location as location_b,
                                b.source_url as url_b, b.language as language_b
                         from gold.fact_cross_domain_similarity as f
                         join gold.dim_text_chunk as a on a.chunk_id = f.chunk_a
                         join gold.dim_text_chunk as b on b.chunk_id = f.chunk_b
                         where f.above_baseline
                         order by f.concept_id, f.similarity desc""")
    for p in pairs:
        p["text_a"], p["text_b"] = excerpt(p["text_a"], 280), excerpt(p["text_b"], 280)

    # Editorial links, each with the linked measure's own numbers where they exist.
    links = rows(con, "select concept_id, kind, target_id, note from gold.mart_concept_links order by concept_id, kind")
    tensions = {t["tension_id"]: t for t in rows(con, "select tension_id, label_en, label_sv from gold.dim_tension")}
    framing = {}
    for r in rows(con, """select c.concept_id, d.label_en, d.label_sv, c.period, c.ai_speeches, c.speeches_with_concept, c.share
                          from gold.mart_ai_politics_concepts as c
                          join seeds.ai_politics_concepts as d using (concept_id)
                          where c.party = 'ALL' and c.period_kind in ('all', 'phase')"""):
        f = framing.setdefault(r["concept_id"], {"label_en": r["label_en"], "label_sv": r["label_sv"], "periods": {}})
        f["periods"][r["period"]] = {"ai_speeches": r["ai_speeches"], "with_concept": r["speeches_with_concept"],
                                     "share": r["share"]}
    terms = {}
    if has_table(con, "gold", "mart_job_ai_governance_yearly"):
        for r in rows(con, """select y.term_id, t.label_en, t.label_sv, y.year, y.ads, y.mention_count, y.share
                              from gold.mart_job_ai_governance_yearly as y
                              join seeds.job_ai_governance_terms as t using (term_id)
                              where y.field_id = 'ALL' order by y.year"""):
            t = terms.setdefault(r["term_id"], {"label_en": r["label_en"], "label_sv": r["label_sv"], "years": []})
            t["years"].append({"year": r["year"], "ads": r["ads"], "with_term": r["mention_count"], "share": r["share"]})
    for link in links:
        if link["kind"] == "philosophy_tension":
            link["target"] = tensions.get(link["target_id"])
        elif link["kind"] == "riksdag_framing":
            link["target"] = framing.get(link["target_id"])
        elif link["kind"] == "job_term":
            link["target"] = terms.get(link["target_id"])

    summary = {
        "concepts": concepts, "corpora": corpora, "relation_types": RELATION_TYPES,
        "run": {k: run[k] for k in ("model", "chunks", "corpus_size", "words", "concepts", "top_rank",
                                    "representatives", "act_version", "baselines", "evaluation", "ran_at")},
        "reviewed_cluster_links": int(con.sql("select count(*) from gold.bridge_cluster_concept").fetchone()[0]),
    }
    written = [dump("summary.json", summary), dump("profiles.json", profiles),
               dump("relations.json", {"concepts": concept_relations, "corpora": corpus_relations}),
               dump("passages.json", passages), dump("pairs.json", pairs), dump("links.json", links)]
    sys.path.insert(0, str(ROOT / "platform/publish/symbolic"))
    import export_symbolic

    export_symbolic.register(written)
    print(f"Concept layer: {len(concepts)} concepts, {sum(c['chunks'] for c in corpora)} chunks, "
          f"{len(pairs)} cross-corpus pairs -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
