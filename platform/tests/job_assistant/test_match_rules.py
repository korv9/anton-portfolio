"""Rule fixes from the manual evaluation of 2026-10-27, each built from the ad wording it quotes."""
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform/job_assistant"))
sys.path.insert(0, str(ROOT / "platform"))
from cv import PDF, parse, read_text  # noqa: E402
from cv_profile import approve, correct  # noqa: E402
from match import match, remote_quote, role, years_asked  # noqa: E402
from publish.job_content import requirements  # noqa: E402

CV = ROOT / "frontend/public/cv/Anton_Ernstsson_CV_final.pdf"
NOW = datetime(2026, 10, 27, 12, tzinfo=timezone.utc)
WISHES = {"locations": ["Stockholm", "Solna", "Sundbyberg"], "remote": "remote",
          "roles": ["data_engineering", "applied_ai", "python_backend", "data_analysis", "bi"], "interests": []}


@pytest.fixture(scope="module")
def profile():
    data = CV.read_bytes()
    return approve(correct(parse(data, PDF, CV.name, NOW), {"wishes": WISHES}, "", NOW), read_text(data, PDF), [], NOW)


def ad(headline, text, municipality="Stockholm"):
    return {"id": "1", "headline": headline, "description": text, "municipality": municipality, "region": None,
            "must_have": [], "nice_to_have": [], "content_hash": "h"}


@pytest.mark.parametrize("text, years", [
    ("4+ years of professional team-based software development experience", 4),
    ("Have 5+ years professional software development experience", 5),
    ("At least 5 years of hands-on experience", 5),
    (">5 years of hands-on DevOps / CI/CD experience", 5),
    ("Minst 4 års aktuell och relevant erfarenhet", 4),
    ("Minst 4 års arbete", 4),
    ("Du har minst fem år inom området", 5),
    ("Minst tre år inom IT", 3),
    ("gedigen flerårig erfarenhet av fullstackutveckling", 3),
    ("Flera års erfarenhet av databashantering", 3),
    ("Several years of professional experience in backend software engineering with Typescript", 3),
])
def test_years_of_experience_are_read(text, years):
    assert max(years_asked(text)) == years


def test_years_that_are_no_ask_are_ignored(profile):
    assert years_asked("Vi har funnits i över 20 år.") == [] and years_asked("Anställningen gäller 2 år.") == []
    text = "Krav: Python, SQL och Azure.\n4+ years of professional team-based software development experience"
    assert match(ad("AI Engineer", text), profile)["class"] == "stretch"


@pytest.mark.parametrize("text", [
    "Vi erbjuder möjlighet att arbeta på distans en dag i veckan.",
    "Du har möjlighet att arbeta hemifrån när arbetsuppgifterna tillåter det.",
    "Remote work is not available.",
    "Vi erbjuder möjlighet till distansarbete.",
    "Arbetet sker delvis på distans.",
])
def test_partial_or_negated_remote_does_not_widen_the_place(text):
    assert remote_quote(text) is None


def test_full_remote_widens_the_place(profile):
    assert remote_quote("Om tjänsten\nTjänsten utförs på distans.") == "Tjänsten utförs på distans."
    assert remote_quote("Rollen är helt på distans.")
    hybrid = "Krav: Power BI, SQL och DAX.\nMöjlighet att arbeta på distans en dag i veckan."
    assert match(ad("BI utvecklare", hybrid, "Ulricehamn"), profile)["class"] == "outside"


def test_role_patterns_need_their_context():
    support = "Vi är ett bolag inom data, AI, molntjänster och IT-support."
    assert role("Junior IT-Support / Servicedesk", support) == ("other", False)
    assert role("Backend Developer (TypeScript)", "Du bygger tjänster i TypeScript.")[0] != "python_backend"
    assert role("Software Engineer - Backend", "Krav: Python.", python="required")[0] == "python_backend"
    assert role("Junior analytiker inom Cyberhot", "Analysera angrepp och andra företeelser i cyberdomänen")[0] == "other"
    assert role("Teknisk underrättelseanalytiker", "Arbeta med komplexa datamängder i våra system")[0] == "data_analysis"


def test_requirement_headings_and_merits():
    text = ("Vi ser att du passar bra i rollen om du har:\nGod erfarenhet av programmering med Python\n\n"
            "Det är ett plus om du har erfarenhet inom något av följande områden:\n"
            "Utveckling & data: Du har arbetat med programmeringsspråk som C#, C++ eller Java.\n\n"
            "Vi söker dig som har:\nKunskap om SQL\n\nFluent Spanish and English, both written and spoken")
    rows = requirements(text, {})["requirements"]
    strength = {r["label"]: r["strength"] for r in rows if r["category"] == "language" or r["label"] == "SQL"}
    assert strength == {"Python": "required", "C#": "preferred", "C++": "preferred", "Java": "preferred",
                        "SQL": "required"}
    assert any(r["category"] == "conditions" and "Spanish" in r["label"] for r in rows)


# Round 2 of the evaluation (job-match-v4).
def test_generic_developer_title_with_python_is_python_backend(profile):
    must = ("Dina arbetsuppgifter varierar, exempelvis:\nDatabasmodellering och bearbetning av dataflöden\n\n"
            "Kvalifikationer\nErfarenhet av programmering i Python\nErfarenhet av databaser")
    m = match(ad("SYSTEMUTVECKLARE VID MUST", must), profile)
    assert (m["role"], m["role_from_title"], m["class"]) == ("python_backend", True, "possible")
    assert role("Mjukvaruutvecklare", "Profil och Meriter/Kompetens:\nReact, JavaScript, Python och API.",
                "ambiguous") == ("python_backend", True)
    # Legora's "Software Engineer" names no Python: "solid skills in backend development".
    assert role("Software Engineer", "Comfortable working across the stack, with solid skills in backend development.") \
        == ("other", False)


def test_graph_vocabulary_and_a_title_role_without_named_skills(profile):
    rows = requirements("Meriterande\nErfarenhet av grafdatabaser, exempelvis Neo4j", {}, __import__("skills").SKILLS)["requirements"]
    assert {"graph databases", "Neo4j"} <= {r["label"] for r in rows}
    m = match(ad("Data Engineer – grafdatabaser och AI",
                 "Minst ett års relevant erfarenhet genom arbete, alternativ examensarbete inom det relevanta ämnet",
                 "Solna"), profile)
    assert m["class"] == "possible" and any("No skill from the vocabulary" in u for u in m["uncertain"])


def test_bracketed_years_and_senior_wording_in_the_text(profile):
    assert years_asked("Vi söker dig som har flera (5+) års erfarenhet av administration, konfiguration och "
                       "optimering av Microsoft 365") == [5]
    interim = ("Här får du, med din expertis och erfarenhet, möjligheten att gå in och stötta en av våra kunder.\n"
               "Krav: Databricks, SQL och Azure.")
    m = match(ad("Konsult / Interim Data Engineer / BI i Stockholm", interim), profile)
    assert m["class"] == "stretch" and any("asks for seniority" in r for r in m["reasons"])
    lead = "Krav: Python.\nStrong technical leadership skills, analytical with ability to develop strategies."
    assert match(ad("Concepts Researcher: AI in 6G RAN", lead), profile)["class"] == "stretch"
    assert match(ad("Data Engineer", "Du har erfarenhet av Python och SQL. Krav: Databricks."), profile)["class"] != "stretch"


def test_junior_ask_keeps_a_title_role_at_stretch(profile):
    graph = ("Vi söker nu en blivande specialist inom ontologier, semantiska lager och datacentrisk arkitektur.\n"
             "Översätta information från relationsdatabaser till grafdatabaser och kunskapsgrafer\n\n"
             "Minst ett års relevant erfarenhet genom arbete, alternativ examensarbete inom det relevanta ämnet")
    m = match(ad("Data Engineer – grafdatabaser och AI", graph, "Solna"), profile)
    named = {j["skill"] for j in m["skills"]}
    assert m["class"] == "stretch" and {"ontologies", "graph databases", "knowledge graphs"} <= named


def test_deep_learning_title_and_an_ad_without_a_place(profile):
    assert role("Deep Learning Engineer", "") == ("ml_engineering", True)
    nowhere = {**ad("Utvecklare sökes 4BrightRX, AI-driven rekryteringsplattform",
                    "Krav: Python, SQL och Azure. Flexibelt arbetssätt med möjlighet till distansarbete"),
               "municipality": None}
    m = match(nowhere, profile)
    assert m["class"] == "possible" and "The ad states no place." in m["uncertain"]
