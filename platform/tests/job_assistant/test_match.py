"""Matching: class rules, quotes on both sides, education apart, and the AI budget as a soft limit."""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform/job_assistant"))
sys.path.insert(0, str(ROOT / "platform/lib"))
import ai  # noqa: E402
import rank  # noqa: E402
import rawstore  # noqa: E402
from cv import PDF, parse, read_text  # noqa: E402
from cv_profile import approve, correct  # noqa: E402
from match import match  # noqa: E402

CV = ROOT / "frontend/public/cv/Anton_Ernstsson_CV_final.pdf"
NOW = datetime(2026, 10, 23, 12, tzinfo=timezone.utc)
WISHES = {"locations": ["Stockholm", "Solna"], "remote": "hybrid",
          "roles": ["data_engineering", "applied_ai", "python_backend"], "interests": ["Kubernetes"]}


@pytest.fixture(scope="module")
def profile():
    data = CV.read_bytes()
    draft = correct(parse(data, PDF, CV.name, NOW), {"wishes": WISHES}, "wishes", NOW)
    return approve(draft, read_text(data, PDF), [], NOW)


def ad(headline="Data Engineer", text=None, municipality="Stockholm", **extra):
    text = text or ("Om tjänsten\nDu kommer att bygga pipelines.\nKrav:\nDu har erfarenhet av Python och PySpark. "
                    "Du har arbetat med Databricks. Du har kunskap om dbt.\nMeriterande:\nKubernetes är ett plus.")
    return {"id": "1", "headline": headline, "description": text, "municipality": municipality,
            "region": "Stockholms län", "must_have": [], "nice_to_have": [], "content_hash": "h1",
            "published": "2026-10-20T08:00:00", **extra}


def test_strong_match_quotes_both_sides(profile):
    m = match(ad(), profile)
    assert m["class"] == "strong" and m["role"] == "data_engineering" and m["role_from_title"]
    python = next(j for j in m["skills"] if j["skill"] == "Python")
    assert python["strength"] == "required" and python["cv_level"] == "practical"
    assert "Python" in python["ad_quotes"][0]["quote"] and python["cv_quotes"][0]["quote"]
    kube = next(j for j in m["skills"] if j["skill"] == "Kubernetes")
    assert kube["strength"] == "preferred" and kube["cv_level"] == "interest" and kube["cv_quotes"] == []
    assert "Kubernetes" in m["gaps"] and m["profile_version"] == 1 and m["cv_sha256"] == profile["cv"]["sha256"]
    assert any("3 of 4 required skills shown in practical work" in r for r in m["reasons"])
    assert "1 more only in projects or education" in m["reasons"]


def test_project_or_education_skills_alone_are_a_stretch(profile):
    # SQL and dbt sit in the owner's projects and education, not in employment.
    m = match(ad(text="Krav: Du har erfarenhet av SQL och dbt."), profile)
    assert m["class"] == "stretch" and "2 more only in projects or education" in m["reasons"]
    assert match(ad(text="Du kommer att bygga pipelines."), profile)["class"] == "stretch", \
        "possible needs at least one judged skill"


def test_senior_title_or_years_is_a_stretch(profile):
    assert match(ad("Senior Data Engineer"), profile)["class"] == "stretch"
    years = ad(text="Krav: Du har minst 5 års erfarenhet av Python, SQL och Databricks.")
    m = match(years, profile)
    assert m["class"] == "stretch" and m["seniority"]["years"] == 5


def test_place_role_and_coverage_send_ads_outside(profile):
    assert match(ad(municipality="Umeå", region="Västerbottens län"), profile)["class"] == "outside"
    remote = ad(municipality="Umeå", region="Västerbottens län",
                text="Krav: Python, SQL och Databricks. Tjänsten utförs på distans.")
    assert match(remote, profile)["class"] == "strong"
    assert match(ad("Javautvecklare", text="Krav: Java, Spring och Kubernetes."), profile)["class"] == "outside"
    assert match(ad(text="Krav: Du har erfarenhet av Java, Scala, Go och AWS."), profile)["class"] == "outside"


def test_body_only_role_and_thin_evidence_stay_possible(profile):
    m = match(ad("Konsult", text="Vi bygger en dataplattform. Krav: Python, SQL och Databricks."), profile)
    assert (m["class"], m["role_from_title"]) == ("possible", False) and m["uncertain"]
    assert match(ad(text="Krav: Python."), profile)["class"] == "possible"


def test_education_and_conditions_never_change_the_class(profile):
    base = match(ad(), profile)
    extra = ad(text=ad()["description"] + "\nKrav: Du har en masterexamen i datavetenskap. "
               "Du måste ha svenskt medborgarskap och klara en säkerhetsprövning.")
    m = match(extra, profile)
    assert m["class"] == base["class"] == "strong"
    assert {c["kind"] for c in m["checks"]} == {"education", "conditions"}
    assert all(c["quote"] for c in m["checks"])


@pytest.fixture
def store(tmp_path, monkeypatch, profile):
    monkeypatch.setattr(rawstore, "RAW", tmp_path)
    folder = tmp_path / "job_assistant"
    folder.mkdir()
    ads = {"1": ad(), "2": {**ad("Senior Data Engineer"), "id": "2", "content_hash": "h2"}}
    (folder / "ads.json").write_text(json.dumps(list(ads.values())), encoding="utf-8")
    return folder


def by_id(result):
    return {r["id"]: r for r in result["matches"]}


class Http:
    """Workers AI over REST: bge-m3 vectors, then gemma answers; `quota` makes every call fail with 4006."""
    def __init__(self, answer='It fits: "Du har erfarenhet av Python och PySpark."', quota=False, status=200):
        self.answer, self.quota, self.status, self.posts = answer, quota, status, []

    def post(self, url, json, timeout):
        self.posts.append(url.rsplit("/", 1)[-1])
        if self.status != 200:
            return type("R", (), {"ok": False, "status_code": self.status, "headers": {}, "json": lambda self: {}})()
        if self.quota:
            body = {"success": False, "errors": [{"code": 4006, "message": "daily free allocation"}]}
        elif "text" in json:
            body = {"success": True, "result": {"data": np.ones((len(json["text"]), 1024)).tolist(),
                                                "meta": {"cost_metric_value_1": 100, "neurons": 0.1}}}
        else:
            body = {"success": True, "result": {"response": self.answer,
                                                "usage": {"prompt_tokens": 1000, "completion_tokens": 60}}}
        return type("R", (), {"ok": True, "status_code": 200, "headers": {"content-type": "application/json"},
                              "json": lambda self: body})()


def test_rank_embeds_explains_and_reuses(store, profile, monkeypatch):
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "acct")
    result = rank.run(profile, Http(), NOW)
    first = by_id(result)["1"]
    assert [r["id"] for r in result["matches"]] == ["1", "2"] and first["rank"] == 1
    assert first["similarity"] == pytest.approx(1.0)
    assert first["explanation"]["status"] == "verified" and result["note"]["explained"] == 1
    rows = [json.loads(line) for line in (store / "ledger.jsonl").read_text().splitlines()]
    assert {r["agent"] for r in rows} == {"job-assistant"} and rows[-1]["model"] == ai.EXPLAIN_MODEL
    again = Http()
    rank.run(profile, again, NOW)
    assert again.posts == [], "cached vectors and kept explanations are not paid for twice"


def test_unverified_explanation_is_not_kept(store, profile, monkeypatch):
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "acct")
    result = rank.run(profile, Http(answer='Strong fit: "ten years of Kubernetes".'), NOW)
    assert by_id(result)["1"]["explanation"]["status"] == "unverified"


def test_budget_and_quota_degrade_to_rules(store, profile, monkeypatch):
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "acct")
    ai.workers_ai.append_ledger("job-assistant", 10**6, ai.CAP, ai.ledger())
    capped = Http()
    result = rank.run(profile, capped, NOW)
    assert capped.posts == [] and result["note"]["embeddings"]["stopped"] == "project budget"
    assert by_id(result)["1"]["class"] == "strong" and by_id(result)["1"]["explanation"] is None
    (store / "ledger.jsonl").unlink()
    result = rank.run(profile, Http(quota=True), NOW)
    assert result["note"]["embeddings"]["stopped"] == "account quota" and by_id(result)["1"]["class"] == "strong"
    assert by_id(rank.run(profile, None, NOW))["1"]["similarity"] is None


def test_server_error_degrades_to_rules(store, profile, monkeypatch):
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "acct")
    monkeypatch.setattr(ai.workers_ai.time, "sleep", lambda s: None)
    result = rank.run(profile, Http(status=500), NOW)
    assert result["note"]["embeddings"]["stopped"] == "error"
    assert by_id(result)["1"]["class"] == "strong" and by_id(result)["1"]["similarity"] is None


def test_explain_error_is_recorded(store, profile, monkeypatch):
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "acct")
    monkeypatch.setattr(ai, "vectors", lambda texts, http, note: {})
    result = rank.run(profile, Http(status=500), NOW)
    assert result["note"]["explain_stopped"] == "error: RuntimeError"
    assert by_id(result)["1"]["explanation"] is None
    entry = json.loads((store / "ledger.jsonl").read_text(encoding="utf-8").splitlines()[-1])
    assert entry["model"] == ai.EXPLAIN_MODEL and entry["neurons_est"] > 0, "a failed call keeps its estimate"


def test_explain_timeout_keeps_its_estimate(store, profile, monkeypatch):
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "acct")
    monkeypatch.setattr(ai, "vectors", lambda texts, http, note: {})

    class Slow:
        def post(self, url, json, timeout):
            raise TimeoutError("read timed out")

    result = rank.run(profile, Slow(), NOW)
    assert result["note"]["explain_stopped"] == "error: TimeoutError"
    entry = json.loads((store / "ledger.jsonl").read_text(encoding="utf-8").splitlines()[-1])
    assert entry["model"] == ai.EXPLAIN_MODEL and entry["neurons_est"] > 0, "a timed-out call keeps its estimate"


def test_unquoted_claim_is_unverified():
    assert ai.verified('It fits: "Python". You will surely be hired.', ["Python"]) is None
    assert ai.verified('It fits: "Python". The gap is "dbt".', ["Python och dbt"]) == ["Python", "dbt"]


def test_daily_cap_counts_every_explanation(store, profile, monkeypatch):
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "acct")
    monkeypatch.setattr(ai, "EXPLAIN_PER_DAY", 1)
    result = rank.run(profile, Http(answer="No quotes here."), NOW)
    assert by_id(result)["1"]["explanation"]["at"].startswith("2026-10-23")
    path = store / "ads.json"
    rows = json.loads(path.read_text(encoding="utf-8"))
    path.write_text(json.dumps(rows + [{**ad(), "id": "3", "content_hash": "h3"}]), encoding="utf-8")
    again = Http()
    result = rank.run(profile, again, NOW)
    assert by_id(result)["3"]["explanation"] is None, "the unverified one already used today's budget"


def test_expired_ads_are_not_matched(store, profile):
    path = store / "ads.json"
    rows = json.loads(path.read_text(encoding="utf-8"))
    rows[0]["application_deadline"] = "2026-10-22T23:59:59"
    path.write_text(json.dumps(rows), encoding="utf-8")
    assert "1" not in by_id(rank.run(profile, None, NOW))


def test_matches_of_removed_ads_are_refused():
    import export_matches
    ads = {"ads": [{"id": "1", "removed_at": None, "expired": False},
                   {"id": "2", "removed_at": "2026-10-23", "expired": False},
                   {"id": "3", "removed_at": None, "expired": True}]}
    assert export_matches.open_ids(ads) == {"1"}
    head = {"schema_version": 1, "profile": {"version": 1}}
    found = export_matches.problems({**head, "matches": [{"id": "2", "class": "outside", "reasons": ["x"],
                                                           "detailed": False}]},
                                    {"schema_version": 1, "texts": {}}, export_matches.open_ids(ads))
    assert any("removed, expired" in p for p in found)


def test_no_profile_means_no_matches(store):
    result = rank.run(None, None, NOW)
    assert result["matches"] == [] and result["note"]["skipped"] == "no approved profile"
