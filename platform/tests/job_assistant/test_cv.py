"""CV parsing keeps a CV quote behind every fact, and a correction cannot invent experience."""
import io
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform/job_assistant"))
from cv import DOCX, PDF, parse, read_text  # noqa: E402
from cv_profile import approve, correct, problems  # noqa: E402

CV = ROOT / "frontend/public/cv/Anton_Ernstsson_CV_final.pdf"
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
    assert any("not in the CV text" in p for p in problems(invented, text))
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
        approve(correct(v1, {}, "no change", NOW) | {"corrections": v1["corrections"]}, text, [v1], NOW)
    v2 = approve(correct(v1, {"professional_years": 0}, "no paid years yet", NOW), text, [v1], NOW)
    assert v2["version"] == 2 and v2["profile_sha256"] != v1["profile_sha256"]
    with pytest.raises(ValueError, match="not valid"):
        approve(correct(v1, {"professional_years": -1}, "", NOW), text, [v1], NOW)
