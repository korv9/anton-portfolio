"""Publish the EU AI Act Observatory from the warehouse's gold tables.

    python platform/publish/eu_ai_act/export_ai_act.py

Writes under frontend/public/data/ai-act/:

    summary.json        counts, the current and original versions, the latest retrieval, and
                        the official sources (first paint)
    articles.json       every article of the current text: titles (en/sv), chapter, section,
                        change since 2024, application date with its Article 113 rule, the
                        actors its text puts under a "shall" (derived), cross-references and
                        guidance; no article text
    article-text-en.json, article-text-sv.json
                        the text of every article and annex, verbatim, by id; read only when
                        an article is opened
    chapters.json       chapter and section titles (en/sv)
    actors.json         the actors with their Article 3 definition verbatim
    risk-classes.json   the risk classes, the sentence each rests on and our description
    obligations.json    actor × obligation × article: verbatim sentence, our classification,
                        our plain-language summary, application date
    timeline.json       application dates, deadlines and document dates
    changes.json        documents, guidance and article-level changes, newest first
    documents.json      every document of the Act's family from Cellar
    guidance.json       the Commission's guidance pages
    navigator.json      the Startup Navigator's questions (platform/publish/eu_ai_act/navigator.json),
                        checked against the obligations and articles

Every row that comes from the Act carries its official source URL. Interpretations (summaries,
classifications, navigator rules) are marked as such in the files. The files are registered in
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
OUT = ROOT / "frontend/public/data/ai-act"
HERE = Path(__file__).resolve().parent


def rows(con, sql: str) -> list[dict]:
    frame = con.sql(sql).df()
    records = json.loads(frame.to_json(orient="records", date_format="iso", force_ascii=False))
    for record in records:
        for key, value in record.items():
            # Dates come out as ISO timestamps; keep the day for date columns.
            if isinstance(value, str) and value.endswith("T00:00:00.000"):
                record[key] = value[:10]
    return records


def split(value: str | None, sep: str = ";") -> list[str]:
    return [v for v in (value or "").split(sep) if v]


def dump(name: str, payload) -> Path:
    path = OUT / name
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
                    encoding="utf-8")
    return path


def check_navigator(navigator: dict, obligations: set[str], articles: set[str], actors: set[str],
                    risk_classes: set[str]) -> None:
    problems = []
    ids = {q["id"] for q in navigator["questions"]}
    for q in navigator["questions"]:
        problems += [f"{q['id']}: article {a}" for a in q.get("articles", []) if a not in articles]
        for cond in (q.get("show_if") or {}) | (q.get("show_if_any") or {}):
            if cond not in ids:
                problems.append(f"{q['id']}: condition on unknown question {cond}")
        for effect in q["effects"].values():
            problems += [f"{q['id']}: obligation {o}" for o in effect.get("obligations", []) if o not in obligations]
            for role, listed in effect.get("obligations_by_role", {}).items():
                if role not in actors:
                    problems.append(f"{q['id']}: role {role}")
                problems += [f"{q['id']}: obligation {o}" for o in listed if o not in obligations]
            problems += [f"{q['id']}: role {r}" for r in effect.get("roles", []) if r not in actors]
            problems += [f"{q['id']}: risk class {r}" for r in effect.get("risk_classes", [])
                         if r not in risk_classes]
    if problems:
        raise SystemExit("navigator.json names things that do not exist:\n  " + "\n  ".join(problems))


def main() -> int:
    con = duckdb.connect(str(DATABASE), read_only=True)
    OUT.mkdir(parents=True, exist_ok=True)

    documents = rows(con, """
        select document_id, celex, document_type, title, published_at, valid_from, valid_to,
               is_current, text_languages, retrieved_at, source_url
        from gold.dim_ai_act_document order by published_at, document_id""")
    current = next(d for d in documents if d["is_current"])
    original = next(d for d in documents if d["document_type"] == "regulation")

    duties = rows(con, """
        select article_number, actor_id from gold.bridge_ai_act_article_actor
        where duty_sentences > 0 order by actor_id""")
    refs = rows(con, "select from_article, to_article from gold.bridge_ai_act_article_reference")
    guidance_links = rows(con, "select article_number, guidance_id from gold.bridge_ai_act_article_guidance")

    articles = rows(con, """
        select article_id, article_number, article_sort, position, title_en, title_sv, chapter,
               section, char_count, change_type, amended_by, application_rule_id, applies_from,
               applies_from_second, applies_partially, application_quote, application_note_en,
               application_note_sv, source_url
        from gold.dim_ai_act_article order by position""")
    for a in articles:
        n = a["article_number"]
        a["amended_by"] = json.loads(a["amended_by"])
        a["actors"] = [d["actor_id"] for d in duties if d["article_number"] == n]
        a["refers_to"] = sorted({r["to_article"] for r in refs if r["from_article"] == n},
                                key=lambda x: (int("".join(c for c in x if c.isdigit())), x))
        a["guidance"] = [g["guidance_id"] for g in guidance_links if g["article_number"] == n]

    annexes = rows(con, """
        select annex_id, annex_number, title_en, title_sv, change_type, source_url, text_en, text_sv
        from gold.dim_ai_act_annex order by position""")
    texts = rows(con, "select article_id, text_en, text_sv from gold.dim_ai_act_article order by position")
    for lang in ("en", "sv"):
        payload = {t["article_id"]: t[f"text_{lang}"] for t in texts}
        payload.update({x["annex_id"]: x[f"text_{lang}"] for x in annexes})
        dump(f"article-text-{lang}.json", payload)

    chapters = rows(con, """
        select distinct chapter, chapter_title_en, chapter_title_sv, section, section_title_en,
               section_title_sv, min(position) over (partition by chapter, section) as position
        from gold.dim_ai_act_article order by position""")

    actors = rows(con, """
        select actor_id, official_term, label_en, label_sv, actor_group, definition_point,
               defined_term, definition, definition_note, articles_mentioning,
               articles_with_duty_sentences
        from gold.dim_ai_act_actor order by sort_order""")
    risk_classes = rows(con, "select * exclude (description_type) from gold.dim_ai_act_risk_class order by sort_order")
    obligations = rows(con, """
        select obligation_id, actor_id, requirement_type, risk_class_id, article_number, paragraph,
               article_title_en, article_title_sv, chapter, section, source_quote, summary_en,
               summary_sv, applies_from, applies_from_second, applies_partially, application_quote,
               article_change_type, source_url
        from gold.mart_ai_act_obligations
        order by try_cast(regexp_extract(article_number, '^[0-9]+') as integer), article_number,
                 obligation_id""")
    timeline = rows(con, """
        select milestone_id, date, kind, title_en, title_sv, description_en, description_sv,
               affected_articles, affected_actors, source_article, source_quote, source_url, origin
        from gold.mart_ai_act_timeline order by date, milestone_id""")
    for m in timeline:
        m["affected_articles"] = split(m["affected_articles"])
        m["affected_actors"] = split(m["affected_actors"])
    changes = rows(con, """
        select change_id, change_date, change_kind, document_id, document_title, article_number,
               provision_id, provision_title, change_type, affected_actors, source_url, basis
        from gold.mart_ai_act_changes order by change_date desc, change_kind, provision_id""")
    for c in changes:
        c["affected_actors"] = split(c["affected_actors"])
    guidance = rows(con, """
        select guidance_id, kind, title, published_at, published_basis, source_url, articles_json,
               first_fetched_at, last_fetched_at, version_count
        from gold.dim_ai_act_guidance order by published_at desc nulls last, guidance_id""")
    for g in guidance:
        g["articles"] = json.loads(g.pop("articles_json") or "[]")
    retrieved = con.sql("select max(retrieved_at) from gold.dim_ai_act_document").fetchone()[0]
    counts = con.sql("""
        select
            (select count(*) from gold.dim_ai_act_article) as articles,
            (select count(*) from gold.dim_ai_act_recital) as recitals,
            (select count(*) from gold.dim_ai_act_annex) as annexes,
            (select count(*) from gold.dim_ai_act_actor) as actors,
            (select count(*) from gold.mart_ai_act_obligations) as obligations,
            (select count(*) from gold.mart_ai_act_timeline where kind <> 'document') as milestones,
            (select count(*) from gold.dim_ai_act_document) as documents,
            (select count(*) from gold.dim_ai_act_guidance) as guidance,
            (select count(*) from gold.dim_ai_act_article where change_type in ('amended', 'inserted')) as articles_changed,
            (select count(*) from gold.dim_ai_act_article where change_type = 'inserted') as articles_inserted
    """).df().iloc[0].to_dict()

    navigator = json.loads((HERE / "navigator.json").read_text(encoding="utf-8"))
    check_navigator(navigator, {o["obligation_id"] for o in obligations},
                    {a["article_number"] for a in articles}, {a["actor_id"] for a in actors},
                    {r["risk_class_id"] for r in risk_classes})
    navigator.pop("note", None)
    navigator["content_type"] = "interpretation"

    summary = {
        "title": "Regulation (EU) 2024/1689 (Artificial Intelligence Act)",
        "counts": {k: int(v) for k, v in counts.items()},
        "current_version": {k: current[k] for k in ("celex", "published_at", "title", "source_url")},
        "original_version": {k: original[k] for k in ("celex", "published_at", "title", "source_url")},
        "amended_by": [{k: d[k] for k in ("celex", "published_at", "title", "source_url")}
                       for d in documents if d["document_type"] == "amending_regulation"],
        "latest_retrieval": str(retrieved)[:19] if retrieved else None,
        "sources": [
            {"id": "cellar", "label": "Publications Office of the EU (Cellar), the repository behind EUR-Lex",
             "url": "https://publications.europa.eu/webapi/rdf/sparql"},
            {"id": "eur-lex", "label": "EUR-Lex: the consolidated text", "url": current["source_url"]},
            {"id": "commission", "label": "European Commission: AI Act policy page",
             "url": "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai"},
            {"id": "service-desk", "label": "AI Act Service Desk",
             "url": "https://ai-act-service-desk.ec.europa.eu/en"},
        ],
        "content_types": {
            "source": "Official text or metadata, verbatim.",
            "derived": "Computed from the official text by a stated method (patterns, comparison).",
            "interpretation": "Written for this site: summaries, classifications, navigator rules.",
        },
    }

    written = [
        dump("summary.json", summary),
        dump("articles.json", articles),
        dump("chapters.json", chapters),
        dump("actors.json", actors),
        dump("risk-classes.json", risk_classes),
        dump("obligations.json", obligations),
        dump("timeline.json", timeline),
        dump("changes.json", changes),
        dump("documents.json", documents),
        dump("guidance.json", guidance),
        dump("annexes.json", [{k: v for k, v in x.items() if not k.startswith("text_")} for x in annexes]),
        dump("navigator.json", navigator),
        OUT / "article-text-en.json",
        OUT / "article-text-sv.json",
    ]
    sys.path.insert(0, str(ROOT / "platform/publish/symbolic"))
    import export_symbolic

    export_symbolic.register(written)
    print(f"AI Act: {counts['articles']} articles, {counts['actors']} actors, "
          f"{counts['obligations']} obligations, {counts['milestones']} milestones, "
          f"{counts['documents']} documents, {len(changes)} change rows -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
