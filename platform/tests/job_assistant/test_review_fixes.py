"""Code review fixes of 2026-10-27: seniority and years wording, phone redaction, profile checks."""
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform/job_assistant"))
sys.path.insert(0, str(ROOT / "platform"))
import export_matches  # noqa: E402
from ads import hashes, reredact  # noqa: E402
from cv import PDF, parse, read_text  # noqa: E402
from cv_profile import correct, problems  # noqa: E402
from match import SENIOR, role, years_asked  # noqa: E402
from publish.job_content import PHONE, redact  # noqa: E402

CV = ROOT / "frontend/public/cv/Anton_Ernstsson_CV_final.pdf"
NOW = datetime(2026, 10, 27, 12, tzinfo=timezone.utc)


def test_architecture_in_a_title_is_not_senior():
    assert not re.search(SENIOR, "Data Architecture Engineer", re.I)
    assert not re.search(SENIOR, "Utvecklare inom arkitektur och integration", re.I)
    assert re.search(SENIOR, "Lösningsarkitekt", re.I) and re.search(SENIOR, "Solution Architect", re.I)


def test_ingen_ai_names_no_role():
    assert role("Konsult", "Tjänsten innehåller ingen AI, bara drift.") == ("other", False)
    assert role("GenAI Engineer", "")[0] == "applied_ai"


@pytest.mark.parametrize("text", ["Projektet pågår under flera år.", "Vi har ett mångårigt samarbete med kunden.",
                                  "Vi har 12 års erfarenhet av IT-konsulting.", "We have 20 years of experience in data."])
def test_company_age_and_duration_are_no_ask(text):
    assert years_asked(text) == []


def test_several_years_with_experience_wording_is_still_read():
    assert years_asked("Du har flerårig erfarenhet av Java.") == [3]
    assert years_asked("Several years of professional experience in backend") == [3]


@pytest.mark.parametrize("number", ["070.123.45.67", "070 123 45 67", "+46 (0)70 123 45 67", "073-123 45 67",
                                    "08-788 00 00", "+46 107-38 21 85"])
def test_phone_formats_are_redacted(number):
    text, count = redact(f"Ring {number} för frågor.")
    assert count == 1 and "[kontaktuppgift utelämnad]" in text and not re.search(PHONE, text)


def test_dates_amounts_and_org_numbers_are_kept():
    text = "Sista dag 2026-11-16. 5 000 SEK per år. Org.nr 556677-8899. 0,5 tjänst."
    assert redact(text) == (text, 0)


def test_stored_texts_are_redacted_again_and_validators_refuse_phones():
    row = {"headline": "Data Engineer", "employer": "Ab", "municipality": None, "region": None,
           "description": "Frågor: 08-788 00 00", "application_deadline": None, "employment_type": None,
           "working_hours": None, "must_have": [], "nice_to_have": [], "application_url": None, "contact_redactions": 0}
    hashes(row)
    before = row["content_hash"]
    texts = {"1": {"description": row["description"]}}
    assert export_matches.contacts("texts.json", texts) == ["texts.json: a phone number in ad 1"]
    assert reredact({"1": row}) == 1 and row["contact_redactions"] == 1 and row["content_hash"] != before
    assert export_matches.contacts("texts.json", {"1": {"description": row["description"]}}) == []
    assert reredact({"1": row}) == 0


def test_summary_and_professional_years_are_checked():
    data = CV.read_bytes()
    profile, text = parse(data, PDF, CV.name, NOW), read_text(data, PDF)
    assert problems(profile, text) == []
    invented = correct(profile, {"summary": profile["summary"] + " Ten years as a staff engineer."}, "", NOW)
    assert any(p.startswith("summary: quote is not in the CV") for p in problems(invented, text))
    unstated = {**profile, "professional_years": 2}
    assert any("no correction states it" in p for p in problems(unstated, text))
    assert problems(correct(profile, {"professional_years": 0}, "no paid years yet", NOW), text) == []
