"""The public match files of the job assistant, read from the gold marts by export.py.

matches.json   every current ad's class, role and reasons in rank order; for detailed ads (strong,
               possible, stretch and the 30-ad evaluation sample) also the skill judgements with
               their ad and CV quotes, gaps, conditions to check and the checked explanation
texts.json     the full public ad text of exactly the detailed ads
texts-remaining.json  the same for every other open, non-duplicate ad, read on demand
demand.json    per skill, how many matched ads name it and the CV's evidence level for it

Which profile version and CV the matches used is in `profile`; without an approved profile the
files hold no matches. `status` is rank.py's note on the profile route: `skipped` when nothing was
matched, `kept` when the last matches stand because the route could not be read, each with the
reason, the HTTP status (null when unreachable) and the time.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from publish.job_content import EMAIL, PHONE  # noqa: E402

CLASSES = ("strong", "possible", "stretch", "outside")


def rows(db, sql: str) -> list[dict]:
    result = db.execute(sql)
    names = [d[0] for d in result.description]
    return [dict(zip(names, r)) for r in result.fetchall()]


def iso(value):
    return value.isoformat() if hasattr(value, "isoformat") else value


def build(db, generated_at: str, note: dict | None = None) -> tuple[dict, dict, dict, dict]:
    head = {"schema_version": 1, "generated_at": generated_at}
    profile = rows(db, "select * from gold.mart_job_assistant_profile")
    profile = {k: iso(v) for k, v in profile[0].items()} if profile else None
    judgements: dict[str, list] = {}
    quotes: dict[tuple, list] = {}
    for q in rows(db, "select * from gold.mart_job_assistant_evidence order by ad_id, skill, side, quote_number"):
        side = {"quote": q["quote"], "line": q["line"], "field": q["source"]} if q["side"] == "ad" else \
               {"quote": q["quote"], "ref": q["source"], "level": q["cv_level"], "source": q["cv_source"]}
        quotes.setdefault((q["ad_id"], q["skill"], q["side"]), []).append(side)
    for j in rows(db, "select * from gold.mart_job_assistant_judgements order by ad_id, skill"):
        judgements.setdefault(j["ad_id"], []).append({
            "skill": j["skill"], "strength": j["strength"], "cv_level": j["cv_level"],
            "ad_quotes": quotes.get((j["ad_id"], j["skill"], "ad"), []),
            "cv_quotes": quotes.get((j["ad_id"], j["skill"], "cv"), [])})
    checks: dict[str, list] = {}
    for c in rows(db, "select * from gold.mart_job_assistant_checks order by ad_id, line, kind, label"):
        checks.setdefault(c.pop("ad_id"), []).append(c)
    out = []
    for m in rows(db, "select * from gold.mart_job_assistant_matches order by rank"):
        item = {"id": m["ad_id"], "rank": m["rank"], "class": m["match_class"], "role": m["role"],
                "role_from_title": m["role_from_title"], "reasons": m["reasons"], "similarity": m["similarity"],
                "sample": m["sample"], "detailed": m["detailed"]}
        if m["detailed"]:
            item.update(gaps=m["gaps"], uncertain=m["uncertain"], remote=m["remote_quote"],
                        seniority={"title": m["senior_title"], "years": m["years_asked"], "junior": m["junior_quote"]},
                        explanation=m["explanation"], explanation_model=m["explanation_model"] if m["explanation"] else None,
                        skills=judgements.get(m["ad_id"], []), checks=checks.get(m["ad_id"], []))
        out.append(item)
    texts: dict[bool, dict] = {True: {}, False: {}}
    for t in rows(db, "select * from gold.mart_job_assistant_texts order by ad_id"):
        texts[t.pop("detailed")][t.pop("ad_id")] = t
    demand = rows(db, "select * from gold.mart_job_assistant_skill_demand order by ads_naming desc, skill")
    status = {k: v for k, v in (note or {}).items() if k in ("skipped", "kept")}
    return ({**head, "profile": profile, "status": status, "matches": out}, {**head, "texts": texts[True]},
            {**head, "profile": profile, "skills": demand}, {**head, "texts": texts[False]})


def open_ids(ads: dict) -> set[str]:
    """Ids of the ads a match may point at: neither removed nor past their deadline."""
    return {a["id"] for a in ads["ads"] if not a["removed_at"] and not a["expired"]}


def contacts(name: str, texts: dict) -> list[str]:
    """An e-mail address or phone number left in a published text, by ad id."""
    return [f"{name}: {kind} in ad {key}" for key, t in texts.items()
            for kind, pattern in (("an e-mail address", EMAIL), ("a phone number", PHONE))
            if re.search(pattern, t.get("description") or "")]


def remaining_problems(texts: dict, remaining: dict, ads: dict) -> list[str]:
    """texts-remaining.json: every open, non-duplicate ad without a detailed text, and no other."""
    if remaining.get("schema_version") != 1:
        return ["texts-remaining.json needs schema_version 1"]
    wanted = {a["id"] for a in ads["ads"] if not a["removed_at"] and not a["expired"] and not a["duplicate_of"]}
    out = []
    if set(remaining["texts"]) != wanted - set(texts["texts"]):
        out.append("texts-remaining.json: ids differ from the open, non-duplicate ads without a detailed text")
    out += contacts("texts-remaining.json", remaining["texts"])
    return out


def problems(matches: dict, texts: dict, ad_ids: set[str]) -> list[str]:
    out = []
    if matches.get("schema_version") != 1 or texts.get("schema_version") != 1:
        return ["matches.json and texts.json need schema_version 1"]
    found = matches.get("matches")
    if matches.get("profile") is None:
        return [] if found == [] and texts.get("texts") == {} else ["matches without an approved profile"]
    ids = [r["id"] for r in found]
    if len(ids) != len(set(ids)) or not set(ids) <= ad_ids:
        out.append("matches.json: duplicate ids or ids of removed, expired or unknown ads")
    for r in found:
        if r["class"] not in CLASSES or not r["reasons"]:
            out.append(f"match {r['id']}: class or reasons missing")
        if r["detailed"] != (r["id"] in texts["texts"]):
            out.append(f"match {r['id']}: detail and text do not go together")
        for j in r.get("skills", []):
            if not j["ad_quotes"] or (j["cv_level"] in ("practical", "education_or_project") and not j["cv_quotes"]):
                out.append(f"match {r['id']}: judgement of {j['skill']} lacks its quotes")
                break
    out += contacts("texts.json", texts.get("texts") or {})
    return out
