"""Compare each ad with the approved profile: role, technique, seniority and wishes, as rules.

The result is a match class with the rule that set it, never a chance of being hired. Every skill
judgement carries the ad sentence and the CV lines it rests on. Formal education and conditions such
as citizenship are listed on their own and never change the class.

Classes, in order. "Practical" is a skill shown in employment or an internship; skills shown only
in projects or education are counted and reported apart and never lift an ad to strong or possible.
"Senior" below is a senior or lead title, senior wording in the text ("med din expertis och
erfarenhet", "technical leadership") or 3+ years asked; it lowers the class only under the default
wish `seniority: junior`. With `seniority: any` it is still reported, as a reason and an uncertainty.
    strong    a wished role read from the title, in a wished place, not senior, at least three
              skills named and at least 60 % of them practical
    possible  a wished role read from the title, in a wished place, not senior, and either at least
              30 % of the named skills practical or no skill from the vocabulary named; a strong
              case whose ad states no place
    stretch   a wished role in a wished place with at least 30 % shown in practical work, projects or
              education (or no skill named, or a title role in an ad with a junior ask), but senior,
              3+ years asked, under 30 % practical or the role read only from the ad text
    outside   anything else: another role, another place, or under 30 % shown
A wished place is a wished municipality or region, any place when the ad states full remote work,
or an ad that states no place (noted as uncertain).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from publish.job_content import requirements  # noqa: E402
from skills import SKILLS, find_skills  # noqa: E402

ENGINE = "job-match-v4"
CLASSES = ("strong", "possible", "stretch", "outside")
LISTED = ("strong", "possible")
# Title first, in this order; the first that matches names the role.
ROLE_PATTERNS = (
    ("analytics_engineering", r"analytics.?engineer"),
    ("data_engineering", r"data.?engineer|dataingenjör|data.?platform|dataplattform|\betl\b|data.?warehouse|\bdwh\b|data.?arkitekt|data.?architect"),
    ("ml_engineering", r"machine.?learning|\bml.?(?:engineer|ops)|mlops|maskininlärning|deep.?learning|djupinlärning|computer.?vision"),
    ("applied_ai", r"\bai\b|artificial intelligence|\bllm|\bgen[- ]?ai\b|generativ"),
    ("bi", r"\bbi\b|business intelligence|power bi|rapportutvecklare"),
    ("data_analysis", r"data.?anal|\w*analytiker\b|\banalyst\b"),
    ("python_backend", r"python|back.?end"),
    ("fullstack", r"full.?stack"),
    ("frontend", r"front.?end|react|ux.?utvecklare"),
)
# A generic developer title is Python backend, read from the title, when the ad names Python.
GENERIC_DEV = r"systemutvecklare|mjukvaruutvecklare|\butvecklare\b|software (?:engineer|developer)|\bdeveloper\b"
# Senior wording in the ad text, beyond the title. "erfarenhet av X" alone is not one.
SENIOR_TEXT = (r"\b(?:som|as an?|en|a) senior\b|\bsenior[- ](?:level|developer|engineer|utvecklare|konsult|consultant)"
               r"|\bas (?:a |the )?(?:tech(?:nical)? )?lead\b|technical leadership|med din expertis och erfarenhet"
               r"|gedigen erfarenhet|lång erfarenhet|omfattande erfarenhet|extensive experience")
# Seniority wording from the feature study (ml/feature_study/job_ads.py on korv9/ml-feature-engineering).
# "arkitekt"/"architect" is a senior title; "Arkitektur"/"Architecture" in a title is not.
SENIOR = r"\b(?:senior\w*|lead|principal|staff|sr|chef|head of|erfarn?\w*|\w*arkitekt(?!ur)\w*|\w*architect(?!ure)\w*)\b"
JUNIOR = r"\b(?:junior|graduate|trainee|jr|nyexad\w*|nyexaminerad\w*|entry.level|blivande)\b"
NUMBERS = {"ett": 1, "one": 1, "två": 2, "two": 2, "tre": 3, "three": 3, "fyra": 4, "four": 4, "fem": 5,
           "five": 5, "sex": 6, "six": 6, "sju": 7, "seven": 7, "åtta": 8, "eight": 8, "nio": 9, "nine": 9,
           "tio": 10, "ten": 10}
_N = r"(\d{1,2}|" + "|".join(NUMBERS) + r")"
# "4+ years of professional team-based software development experience", "Minst 4 års arbete",
# "minst fem år": a number, then up to six words before the experience word, or "minst/at least".
YEARS = (r"\(?" + _N + r"\s*\+?\s*\)?\s*(?:års?|years?'?|yrs)\s+(?:[\w/+#&-]+\s+){0,6}?(?:\w*erfarenhet\w*|experience|arbete)\b"
         r"|\b(?:minst|minimum|at least)\s+" + _N + r"\s*\+?\s*(?:års?|years?)\b")
# "flerårig", "flera års", "several years": no number, read as three years.
# Only with experience wording close by: "pågår under flera år" and "mångårigt samarbete" are no ask.
SEVERAL = (r"\b(?:flerårig\w*|mångårig\w*|flera års?|several years|many years|multiple years)"
           r"\s+(?:[\w/+#&-]+\s+){0,4}?(?:\w*erfarenhet\w*|experience)\b")
# A number after these words is the company's own age or record, not an ask: "Vi har 12 års erfarenhet".
COMPANY_LEAD = r"(?:\bvi har|\bwe have|\bföretaget har|\bbolaget har|\bwith over|\bmed över|\bfor over|\bi över)\s*$"
# Hybrid work is still work at the ad's own office, so only full-remote wording widens the place.
FULL_REMOTE = (r"helt (?:på distans|hemifrån|remote)|100\s*%\s*(?:på\s+)?(?:distans|remote)|full(?:y)?[- ]remote"
               r"|remote[- ](?:first|only)|\b(?:utförs|sker|görs|arbetar du|jobbar du)\s+(?:helt\s+)?på distans"
               r"|distansanställning|\bis an? (?:\w+ )?remote (?:position|role|job)\b|work from anywhere")
# Partial remote ("på distans en dag i veckan") or a negation ("Remote work is not available").
NOT_FULL_REMOTE = r"delvis|hybrid|dagar? i veckan|days? (?:a|per) week|ibland|partly|partial|\b(?:not|inte|ej|ingen|no)\b"
# A role read from "analytiker"/"analyst" or "backend" needs this in the ad as well.
DATA_CONTEXT = (r"\bsql\b|power bi|\bbi\b|statisti|datamängd|\bdatasets?\b|dataanalys|analys av data"
                r"|analys\w* (?:large |stora )?data|data.?driven|data science")
MET = ("practical", "education_or_project")
NOT_SKILLS = {"seniority", "education", "experience", "conditions", "responsibilities", "benefits"}
STRENGTH = {"required": 0, "preferred": 1, "ambiguous": 2}


def role(headline: str, text: str, python: str | None = None) -> tuple[str, bool]:
    """(role category, read from the title). A role found only in the body is marked uncertain.

    python: how strongly the ad asks for Python (required, preferred, ambiguous) or None.
    "analytiker"/"analyst" is data analysis only with data wording in the ad, "backend" is Python
    backend only when the title names Python or the ad requires it, a generic developer title
    ("Systemutvecklare", "Software Engineer") is Python backend when the ad names Python, and a
    bare "AI" in the body (company boilerplate: "data, AI, molntjänster") names no role.
    """
    data = bool(re.search(DATA_CONTEXT, text or "", re.I))
    for source, from_title in ((headline, True), (text[:600], False)):
        for name, pattern in ROLE_PATTERNS:
            for m in re.finditer(pattern, source or "", re.I):
                word = m.group().casefold()
                if ((name == "data_analysis" and not word.startswith("data") and not data)
                        or (name == "python_backend" and word != "python" and python != "required")
                        or (name == "applied_ai" and word == "ai" and not from_title)):
                    continue
                return name, from_title
        if from_title and python and re.search(GENERIC_DEV, headline or "", re.I):
            return "python_backend", True
    return "other", False


def years_asked(text: str) -> list[int]:
    """Years of experience the ad asks for; "several years" counts as three. Over 15 is not an ask."""
    text = text or ""
    found = [int(n) if n.isdigit() else NUMBERS[n.casefold()]
             for m in re.finditer(YEARS, text, re.I) for n in m.groups()
             if n and not re.search(COMPANY_LEAD, text[max(0, m.start() - 30):m.start()], re.I)]
    # ponytail: "i över 20 år" is a company's age, not an ask; a cap of 15 years drops most of those.
    found = [n for n in found if n <= 15]
    return found + [3] * bool(re.search(SEVERAL, text or "", re.I))


def remote_quote(text: str) -> str | None:
    """The first sentence that states full remote work, without partial or negated wording."""
    for sentence in re.split(r"\n|(?<=[.!?])\s+", text or ""):
        if re.search(FULL_REMOTE, sentence, re.I) and not re.search(NOT_FULL_REMOTE, sentence, re.I):
            return sentence.strip()
    return None


def asked_skills(ad: dict) -> dict[str, dict]:
    """Each taxonomy skill the ad names, with its strongest wording and the sentences that say so."""
    source = {"must_have": {"skills": [{"label": s} for s in ad.get("must_have", [])]},
              "nice_to_have": {"skills": [{"label": s} for s in ad.get("nice_to_have", [])]}}
    found: dict[str, dict] = {}
    for req in requirements(ad.get("description") or "", source, SKILLS)["requirements"]:
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


def sources(profile: dict) -> dict[str, str]:
    """Each evidence ref's kind of source, read from the profile entry it names; cv_profile.problems checks every ref names one."""
    out = {"skills": "skills_list", "summary": "summary"}
    out.update({e["id"]: e["kind"] for e in profile["experience"]})
    # A project counts as education only when the CV marks it as a thesis (cv.py THESIS sets context).
    out.update({p["id"]: "education" if p.get("context") == "education" else "project" for p in profile["projects"]})
    out.update({e["id"]: "education" for e in profile["education"]})
    return out


def judge(asked: dict[str, dict], profile: dict) -> list[dict]:
    levels = {s["skill"]: s for s in profile["skills"]}
    source = sources(profile)
    interests = set(profile["wishes"]["interests"])
    out = []
    for skill, row in sorted(asked.items(), key=lambda kv: (STRENGTH[kv[1]["strength"]], kv[0].casefold())):
        cv = levels.get(skill)
        level = cv["level"] if cv else "interest" if skill in interests else None
        out.append({**row, "cv_level": level,
                    "cv_quotes": [{"ref": e["ref"], "level": e["level"], "source": source[e["ref"]], "quote": e["quote"]}
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
    asked = asked_skills(ad)
    category, from_title = role(headline, text, (asked.get("Python") or {}).get("strength"))
    wishes = profile["wishes"]
    judgements = judge(asked, profile)
    required = [j for j in judgements if j["strength"] == "required"]
    basis = required or judgements
    practical = [j for j in basis if j["cv_level"] == "practical"]
    shown = [j for j in basis if j["cv_level"] in MET]
    share = len(practical) / len(basis) if basis else None
    years = years_asked(text)
    senior_title = first(SENIOR, headline)
    senior_text = None if senior_title else first(SENIOR_TEXT, text)
    senior = bool(senior_title or senior_text) or (max(years, default=0) >= 3)
    demote = senior and wishes.get("seniority", "junior") == "junior"
    roles = wishes["roles"]
    role_ok = category in roles if roles else category != "other"
    places = [p.casefold() for p in wishes["locations"]]
    remote = remote_quote(text)
    # An ad without municipality or region is not outside on place alone; it is at most possible.
    no_place = not (ad.get("municipality") or ad.get("region"))
    place_ok = (not places or no_place or (ad.get("municipality") or "").casefold() in places
                or (ad.get("region") or "").casefold() in places
                or (wishes["remote"] in ("hybrid", "remote") and bool(remote)))
    # A junior ask ("junior", "blivande", at most one year) keeps a title-read wished role at stretch
    # even when the CV shows few of the named skills.
    junior_ask = bool(first(JUNIOR, headline + "\n" + text)) or (bool(years) and max(years) <= 1)
    # A role read only from the ad text is at most a stretch. A title-read role with no skill from
    # the vocabulary is possible, with that uncertainty noted.
    if role_ok and from_title and place_ok and not demote and (share is None or share >= 0.3):
        klass = "strong" if share is not None and share >= 0.6 and len(basis) >= 3 and not no_place else "possible"
    elif role_ok and place_ok and (not basis or len(shown) / len(basis) >= 0.3
                                   or (from_title and junior_ask and not senior)):
        klass = "stretch"
    else:
        klass = "outside"

    reasons = [f"{category.replace('_', ' ')}" + (" (from the title)" if from_title else " (only the ad text suggests it)")
               + ("" if role_ok else ", not a wished role")]
    if basis:
        kind = "required" if required else "named"
        reasons.append(f"{len(practical)} of {len(basis)} {kind} skills shown in practical work")
        if len(shown) > len(practical):
            reasons.append(f"{len(shown) - len(practical)} more only in projects or education")
    else:
        reasons.append("the ad names no skill from the vocabulary")
    place = ad.get("municipality") or ad.get("region") or "no place given"
    reasons.append(place + ("" if place_ok else ", outside the wished places") + (", full remote work stated" if remote else ""))
    if senior_title:
        reasons.append("the title says senior or lead")
    if senior_text:
        reasons.append(f"the ad text asks for seniority: {senior_text}")
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
    if not basis:
        uncertain.append("No skill from the vocabulary named, so the class rests on role, place and seniority.")
    if no_place:
        uncertain.append("The ad states no place.")
    if senior and not demote:
        uncertain.append("The ad asks for seniority; the wish to see any level keeps it from lowering the class.")
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
