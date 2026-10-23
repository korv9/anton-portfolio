"""The public match files of the job assistant, built from the store by export.py.

matches.json   every current ad's class, role and reasons; for the review list (strong, possible),
               stretch and the evaluation sample also the skill judgements with their ad and CV
               quotes, gaps, conditions to check and the checked explanation
texts.json     the full public ad text of exactly those detailed ads

The evaluation sample is SAMPLE ads outside the list, picked by a hash of the ad id, so the owner's
labels can show ads the rules missed. Which profile version and CV each match used is in `profile`.
"""
from __future__ import annotations

import hashlib
import re

SAMPLE = 30
DETAIL = ("strong", "possible", "stretch")
COMPACT = ("id", "class", "role", "role_from_title", "reasons", "similarity")
FULL = COMPACT + ("skills", "gaps", "checks", "seniority", "remote", "uncertain", "explanation")


def sample(ids: list[str]) -> set[str]:
    return set(sorted(ids, key=lambda i: hashlib.sha256(f"job-assistant-sample-v1:{i}".encode()).hexdigest())[:SAMPLE])


def build(ads: dict, store: dict, generated_at: str) -> tuple[dict, dict]:
    rows = store.get("matches") or {}
    outside = [k for k, r in rows.items() if r["class"] not in DETAIL]
    picked = sample(outside)
    out, texts = [], {}
    for key in store.get("order") or []:
        row = rows[key]
        detailed = row["class"] in DETAIL or key in picked
        item = {k: row.get(k) for k in (FULL if detailed else COMPACT)}
        item["sample"] = key in picked
        out.append(item)
        if detailed:
            ad = ads[key]
            texts[key] = {"description": ad["description"], "text_origin": ad["text_origin"],
                          "contact_redactions": ad["contact_redactions"], "content_hash": ad["content_hash"]}
    head = {"schema_version": 1, "generated_at": generated_at}
    matches = {**head, "profile": store.get("profile"), "engine": store.get("engine"),
               "note": store.get("note"), "matches": out}
    return matches, {**head, "texts": texts}


def problems(matches: dict, texts: dict, ad_ids: set[str]) -> list[str]:
    out = []
    if matches.get("schema_version") != 1 or texts.get("schema_version") != 1:
        return ["matches.json and texts.json need schema_version 1"]
    rows = matches.get("matches")
    if matches.get("profile") is None:
        return [] if rows == [] and texts.get("texts") == {} else ["matches without an approved profile"]
    ids = [r["id"] for r in rows]
    if len(ids) != len(set(ids)) or not set(ids) <= ad_ids:
        out.append("matches.json: duplicate ids or ids missing from ads.json")
    for r in rows:
        if r["class"] not in ("strong", "possible", "stretch", "outside") or not r["reasons"]:
            out.append(f"match {r['id']}: class or reasons missing")
        detailed = "skills" in r
        if detailed != (r["id"] in texts["texts"]):
            out.append(f"match {r['id']}: detail and text do not go together")
        for j in r.get("skills", []):
            if not j["ad_quotes"] or (j["cv_level"] in ("practical", "education_or_project") and not j["cv_quotes"]):
                out.append(f"match {r['id']}: judgement of {j['skill']} lacks its quotes")
                break
    blob = str(texts.get("texts"))
    if re.search(r"[\w.+-]+@[\w-]+\.[a-z]{2,}", blob, re.I):
        out.append("texts.json: an e-mail address is present")
    return out
