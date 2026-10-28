"""CV parsing keeps a CV quote behind every fact, and a correction cannot invent experience."""
import copy
import io
import json
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform/job_assistant"))
from cv import CONTACT, DOCX, PDF, clean_lines, parse, read_text  # noqa: E402
from cv_profile import approve, correct, problems  # noqa: E402

CV = ROOT / "frontend/public/cv/Anton_Ernstsson_CV_final.pdf"
# Shared with worker/jobs.test.ts, so both CONTACT patterns agree.
CASES = json.loads((ROOT / "platform/tests/job_assistant/contact_cases.json").read_text(encoding="utf-8"))
NOW = datetime(2026, 10, 23, tzinfo=timezone.utc)
DOCX_LINES = [
    "Kim Example", "Data engineer", "kim@example.com / +46 70 123 45 67", "linkedin.com/in/kim",
    "Data engineer with two years of pipeline work.",
    "Arbetslivserfarenhet",
    "Data Engineer · Exempel AB jan 2023 - pågående",
    "Built Airflow-free Python ingestion and dbt models on Azure.",
    "Praktikant · Lilla Bolaget aug 2022 - dec 2022",
    "LIA praktik",
    "Wrote SQL reports in Power BI.",
    "Utbildning",
    "Datavetenskap · Stockholms universitet 2019 - 2022",
    "Kandidatexamen, 180 hp, examen jun 2022.",
    "Kompetenser",
    "Python, SQL, Kubernetes",
    "Språk",
    "Svenska (modersmål) / Engelska (flytande)",
]


def docx(lines):
    body = "".join(f"<w:p><w:r><w:t>{line}</w:t></w:r></w:p>" for line in lines)
    xml = ('<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/'
           f'wordprocessingml/2006/main"><w:body>{body}</w:body></w:document>')
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as z:
        z.writestr("word/document.xml", xml)
    return out.getvalue()


@pytest.fixture(scope="module")
def owner():
    data = CV.read_bytes()
    return parse(data, PDF, CV.name, NOW), read_text(data, PDF)


def skill(profile, name):
    return next(s for s in profile["skills"] if s["skill"] == name)


def test_public_cv_entries_and_evidence_levels(owner):
    profile, text = owner
    exp = {e["organisation"]: e for e in profile["experience"]}
    assert exp["Fora AB"]["kind"] == "internship" and exp["Fora AB"]["start"] == "Nov 2025"
    assert exp["Avtalat"]["kind"] == "internship" and exp["Delicato AB"]["kind"] == "employment"
    assert skill(profile, "Python")["level"] == "practical"
    assert skill(profile, "Databricks")["level"] == "practical"
    assert skill(profile, "Microsoft Fabric")["level"] == "education_or_project"
    assert skill(profile, "Azure DevOps")["level"] == "listed"
    names = {s["skill"] for s in profile["skills"]}
    assert not names & {"Kubernetes", "Java", "AWS", "Spring"}
    edu = profile["education"][0]
    assert (edu["level"], edu["credits"], edu["completed"]) == ("higher_vocational", 400, "Jun 2026")
    assert [x["language"] for x in profile["languages"]] == ["Swedish", "English"]
    assert profile["professional_years"] is None and profile["wishes"]["interests"] == []
    assert problems(profile, text) == []


def test_contact_details_never_enter_the_profile(owner):
    profile, _ = owner
    blob = str(profile)
    assert "@" not in blob and "541 024" not in blob and "+46" not in blob and "linkedin" not in blob


@pytest.mark.parametrize("text", CASES["contact"])
def test_personnummer_and_addresses_count_as_contact(owner, text):
    assert CONTACT.search(text)
    profile = copy.deepcopy(owner[0])
    profile["summary"] = text
    assert any("contact details" in p for p in problems(profile))


@pytest.mark.parametrize("text", CASES["not_contact"])
def test_ordinary_cv_text_is_not_contact(text):
    assert not CONTACT.search(text)


def test_a_contact_span_is_cut_and_the_rest_of_its_line_kept():
    lines = clean_lines("Kungsholmen, Hantverkargatan 5\nkim@example.com / +46 70 123 45 67\nAnalyst, 123 45 Stockholm")
    assert lines == ["Kungsholmen", "Analyst"]
    assert not any(CONTACT.search(line) for line in lines)


def test_docx_swedish_headings_and_ongoing_role():
    data = docx(DOCX_LINES)
    profile = parse(data, DOCX, "cv.docx", NOW)
    first, second = profile["experience"]
    assert (first["kind"], first["end"]) == ("employment", "pågående")
    assert second["kind"] == "internship" and "Power BI" in second["skills"]
    assert profile["education"][0]["level"] == "bachelor" and profile["education"][0]["credits"] == 180
    assert skill(profile, "Kubernetes")["level"] == "listed"
    assert skill(profile, "Azure")["level"] == "practical"
    assert "kim@example.com" not in str(profile) and "123 45 67" not in str(profile)
    assert problems(profile, read_text(data, DOCX)) == []


def test_internship_named_only_in_the_title():
    lines = [line for line in DOCX_LINES if line != "LIA praktik"]
    assert parse(docx(lines), DOCX, "cv.docx", NOW)["experience"][1]["kind"] == "internship"


def test_evidence_level_follows_the_cv_section_of_its_quote(owner):
    profile, text = owner
    listed = next(s for s in profile["skills"] if s["level"] == "listed")
    row = next(r for r in listed["evidence"] if r["ref"] == "skills")
    real = next(e for e in profile["experience"] if e["details"])
    # A skills-list line paired with a real experience sentence must not lift the skill to practical.
    lifted = [{**s, "level": "practical", "evidence": [{**row, "level": "practical", "ref": real["id"]},
                                                       {"level": "practical", "ref": real["id"],
                                                        "quote": real["details"][0]}]}
              if s is listed else s for s in profile["skills"]]
    found = problems(correct(profile, {"skills": lifted}, "", NOW), text)
    assert any(f"skills/{listed['skill']}/{real['id']}: quote is not in the CV experience" in p for p in found)
    relabelled = [{**s, "level": "practical", "evidence": [{**row, "level": "practical"}]} if s is listed else s
                  for s in profile["skills"]]
    assert any("does not match the CV section" in p
               for p in problems(correct(profile, {"skills": relabelled}, "", NOW), text))


def test_unreadable_file_and_missing_sections():
    with pytest.raises(ValueError):
        read_text(b"plain text", "text/plain")
    profile = parse(docx(["Kim Example", "Python everywhere."]), DOCX, "cv.docx", NOW)
    assert any("experience" in u for u in profile["uncertain"])


def test_correction_cannot_invent_experience(owner):
    profile, text = owner
    kubernetes = {"skill": "Kubernetes", "category": "platform", "level": "practical",
                  "evidence": [{"level": "practical", "ref": "experience-2", "quote": "Ran Kubernetes clusters."}]}
    invented = correct(profile, {"skills": profile["skills"] + [kubernetes]}, "add k8s", NOW)
    assert any("not in the CV experience" in p for p in problems(invented, text))
    raised = [dict(s) for s in profile["skills"]]
    sql = next(s for s in raised if s["skill"] == "SQL")
    sql["level"] = "practical"
    assert any("strongest evidence" in p for p in problems(correct(profile, {"skills": raised}, "", NOW), text))
    wish = correct(profile, {"wishes": {"locations": ["Stockholm"], "remote": "hybrid",
                                        "roles": ["data_engineering", "applied_ai"], "interests": ["Kubernetes"]}},
                   "wishes", NOW)
    assert problems(wish, text) == [] and wish["corrections"][-1]["fields"] == ["wishes"]
    with pytest.raises(ValueError):
        correct(profile, {"cv": {}}, "", NOW)


def test_approval_versions_and_rejects_unchanged(owner):
    profile, text = owner
    v1 = approve(profile, text, [], NOW)
    assert (v1["status"], v1["version"]) == ("approved", 1) and len(v1["profile_sha256"]) == 64
    assert problems(v1, text) == []
    with pytest.raises(ValueError, match="unchanged"):
        approve(correct(v1, {}, "no change", NOW), text, [v1], NOW)
    v2 = approve(correct(v1, {"professional_years": 0}, "no paid years yet", NOW), text, [v1], NOW)
    assert v2["version"] == 2 and v2["profile_sha256"] != v1["profile_sha256"]
    with pytest.raises(ValueError, match="not valid"):
        approve(correct(v1, {"professional_years": -1}, "", NOW), text, [v1], NOW)


def test_seniority_wish_and_evidence_refs(owner):
    profile, text = owner
    wishes = {**profile["wishes"], "seniority": "any"}
    assert problems(correct(profile, {"wishes": wishes}, "", NOW), text) == []
    found = problems(correct(profile, {"wishes": {**wishes, "seniority": "senior"}}, "", NOW), text)
    assert any("wishes/seniority" in p for p in found)
    skills = [{**s, "evidence": [{**e, "ref": "experience-9"} for e in s["evidence"]]} if s["skill"] == "Python" else s
              for s in profile["skills"]]
    assert any("ref names no profile entry" in p for p in problems(correct(profile, {"skills": skills}, "", NOW), text))


def test_every_cv_quote_is_word_for_word_in_the_cv_text(owner):
    # Only whitespace may differ (PDF line wraps); punctuation and order are the CV's own.
    profile, text = owner
    import re
    from cv import LINK

    def fold(s):
        return re.sub(r"\s+", " ", s.replace("•", " ")).strip().casefold()
    whole = fold(text), fold(LINK.sub("", text))
    quotes = [e["quote"] for s in profile["skills"] for e in s["evidence"]]
    quotes += [q for k in ("experience", "projects", "education") for i in profile[k] for q in [i["quote"], *i["details"]]]
    missing = [q for q in quotes if not any(fold(q) in w for w in whole)]
    assert quotes and missing == []
    assert "covering tickets, problems, changes, agents and departments." in " ".join(quotes)
    assert not any(q.startswith("LIA internship · Freshservice ITSM data in Azure Databricks Built") for q in quotes)
