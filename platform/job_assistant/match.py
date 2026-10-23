"""Compare each ad with the approved profile: role, technique, seniority and wishes, as rules.

The result is a match class with the rule that set it, never a chance of being hired. Every skill
judgement carries the ad sentence and the CV lines it rests on. Formal education and conditions such
as citizenship are listed on their own and never change the class.

Classes, in order:
    strong    a wished role read from the title, in a wished place, not senior, at least three
              skills named and at least 60 % of them shown in practical work or projects
    possible  a wished role in a wished place, not senior, at least 30 % shown (or no skills named)
    stretch   a wished role in a wished place with at least 30 % shown, but senior or 3+ years asked
    outside   anything else: another role, another place, or under 30 % shown
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from publish.job_content import requirements  # noqa: E402
from skills import find_skills  # noqa: E402

ENGINE = "job-match-v1"
CLASSES = ("strong", "possible", "stretch", "outside")
LISTED = ("strong", "possible")
# Title first, in this order; the first that matches names the role.
ROLE_PATTERNS = (
    ("analytics_engineering", r"analytics.?engineer"),
    ("data_engineering", r"data.?engineer|dataingenjör|data.?platform|dataplattform|\betl\b|data.?warehouse|\bdwh\b|data.?arkitekt|data.?architect"),
    ("ml_engineering", r"machine.?learning|\bml.?(?:engineer|ops)|mlops|maskininlärning"),
    ("applied_ai", r"\bai\b|artificial intelligence|\bllm|gen.?ai|generativ"),
    ("bi", r"\bbi\b|business intelligence|power bi|rapportutvecklare"),
    ("data_analysis", r"data.?anal|dataanalytiker|\banalytiker\b|\banalyst\b"),
    ("python_backend", r"python|back.?end"),
    ("fullstack", r"full.?stack"),
    ("frontend", r"front.?end|react|ux.?utvecklare"),
)
# Seniority wording from the feature study (ml/feature_study/job_ads.py on korv9/ml-feature-engineering).
SENIOR = r"\b(?:senior\w*|lead|principal|staff|sr|chef|head of|erfarn?\w*)\b|arkitekt|architect"
JUNIOR = r"\b(?:junior|graduate|trainee|jr|nyexad\w*|nyexaminerad\w*|entry.level)\b"
YEARS = r"\b(\d{1,2})\s*\+?\s*(?:års?|years?)\s*(?:av\s+|of\s+)?(?:\w+\s+){0,2}(?:erfarenhet|experience)"
# Hybrid work is still work at the ad's own office, so only remote wording widens the place.
REMOTE = r"\b(?:på distans|distansarbete|helt på distans|remote|work from home|arbeta hemifrån)\b"
MET = ("practical", "education_or_project")
NOT_SKILLS = {"seniority", "education", "experience", "conditions", "responsibilities", "benefits"}
STRENGTH = {"required": 0, "preferred": 1, "ambiguous": 2}


def role(headline: str, text: str) -> tuple[str, bool]:
    """(role category, read from the title). A role found only in the body is marked uncertain."""
    for source, from_title in ((headline, True), (text[:600], False)):
        for name, pattern in ROLE_PATTERNS:
            if re.search(pattern, source or "", re.I):
                return name, from_title
    return "other", False


def asked_skills(ad: dict) -> dict[str, dict]:
    """Each taxonomy skill the ad names, with its strongest wording and the sentences that say so."""
    source = {"must_have": {"skills": [{"label": s} for s in ad.get("must_have", [])]},
              "nice_to_have": {"skills": [{"label": s} for s in ad.get("nice_to_have", [])]}}
    found: dict[str, dict] = {}
    for req in requirements(ad.get("description") or "", source)["requirements"]:
        if req["category"] in NOT_SKILLS:
            continue
        for skill, _ in find_skills(req["quote"]):
            row = found.setdefault(skill, {"skill": skill, "strength": req["strength"], "ad_quotes": []})
            if STRENGTH[req["strength"]] < STRENGTH[row["strength"]]:
                row["strength"] = req["strength"]
            quote = {"quote": req["quote"], "line": req["line"], "field": req["source_field"]}
            if quote not in row["ad_quotes"]:
                row["ad_quotes"].append(quote)
    return found


def judge(asked: dict[str, dict], profile: dict) -> list[dict]:
    levels = {s["skill"]: s for s in profile["skills"]}
    interests = set(profile["wishes"]["interests"])
    out = []
    for skill, row in sorted(asked.items(), key=lambda kv: (STRENGTH[kv[1]["strength"]], kv[0].casefold())):
        cv = levels.get(skill)
        level = cv["level"] if cv else "interest" if skill in interests else None
        out.append({**row, "cv_level": level,
                    "cv_quotes": [{"ref": e["ref"], "level": e["level"], "quote": e["quote"]}
                                  for e in (cv["evidence"] if cv else [])][:3]})
    return out


def first(pattern: str, text: str) -> str | None:
    """The sentence of the first match, as the quote for a judgement."""
    m = re.search(pattern, text or "", re.I)
    if not m:
        return None
    start = max(text.rfind("\n", 0, m.start()), text.rfind(". ", 0, m.start()) + 1, 0)
    end = min([i for i in (text.find("\n", m.end()), text.find(". ", m.end())) if i >= 0] or [len(text)])
    return text[start:end + 1].strip()


def match(ad: dict, profile: dict) -> dict:
    text, headline = ad.get("description") or "", ad.get("headline") or ""
    category, from_title = role(headline, text)
    wishes = profile["wishes"]
    judgements = judge(asked_skills(ad), profile)
    required = [j for j in judgements if j["strength"] == "required"]
    basis = required or judgements
    shown = [j for j in basis if j["cv_level"] in MET]
    share = len(shown) / len(basis) if basis else None
    years = [int(y) for y in re.findall(YEARS, text, re.I)]
    senior_title = first(SENIOR, headline)
    senior = bool(senior_title) or (max(years, default=0) >= 3)
    roles = wishes["roles"]
    role_ok = category in roles if roles else category != "other"
    places = [p.casefold() for p in wishes["locations"]]
    remote = first(REMOTE, text)
    place_ok = (not places or (ad.get("municipality") or "").casefold() in places
                or (ad.get("region") or "").casefold() in places
                or (wishes["remote"] in ("hybrid", "remote") and bool(remote)))
    enough = share is None or share >= 0.3
    if role_ok and place_ok and enough and not senior:
        klass = ("strong" if from_title and share is not None and share >= 0.6 and len(basis) >= 3
                 else "possible")
    elif role_ok and place_ok and enough:
        klass = "stretch"
    else:
        klass = "outside"

    reasons = [f"{category.replace('_', ' ')}" + (" (from the title)" if from_title else " (only the ad text suggests it)")
               + ("" if role_ok else ", not a wished role")]
    if basis:
        kind = "required" if required else "named"
        reasons.append(f"{len(shown)} of {len(basis)} {kind} skills shown in practical work or projects")
    else:
        reasons.append("the ad names no skill from the vocabulary")
    place = ad.get("municipality") or ad.get("region") or "no place given"
    reasons.append(place + ("" if place_ok else ", outside the wished places") + (", remote work mentioned" if remote else ""))
    if senior_title:
        reasons.append("the title says senior or lead")
    if years:
        reasons.append(f"{max(years)} years of experience asked")
    gaps = [j["skill"] for j in judgements if j["cv_level"] not in MET and j["strength"] != "ambiguous"]
    checks = []
    for req in requirements(text, {})["requirements"]:
        if req["category"] in ("education", "conditions") and req["strength"] != "ambiguous":
            item = {"kind": req["category"], "label": req["label"], "quote": req["quote"], "line": req["line"]}
            if item not in checks:
                checks.append(item)
    uncertain = []
    if not from_title:
        uncertain.append("The role is read from the ad text, not the title.")
    if share is not None and len(basis) < 3:
        uncertain.append(f"Only {len(basis)} skill(s) named, so the share rests on little.")
    return {
        "id": ad["id"],
        "engine": ENGINE,
        "profile_version": profile.get("version"),
        "cv_sha256": profile["cv"]["sha256"],
        "role": category,
        "role_from_title": from_title,
        "class": klass,
        "reasons": reasons,
        "skills": judgements,
        "gaps": gaps,
        "checks": checks,
        "seniority": {"title": senior_title, "years": max(years, default=None), "junior": first(JUNIOR, headline + "\n" + text)},
        "remote": remote,
        "uncertain": uncertain,
    }


def order(rows: list[dict], ads: dict, profile: dict, similarity: dict[str, float]) -> list[dict]:
    """Class, then the owner's role order, then similarity to the profile, then newest first."""
    roles = profile["wishes"]["roles"]
    newest = sorted(rows, key=lambda m: ads[m["id"]].get("published") or "", reverse=True)
    return sorted(newest, key=lambda m: (
        CLASSES.index(m["class"]),
        roles.index(m["role"]) if m["role"] in roles else len(roles),
        -similarity.get(m["id"], 0.0),
    ))
