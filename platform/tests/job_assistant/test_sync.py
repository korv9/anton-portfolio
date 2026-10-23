"""The hourly sync: a new CV becomes a draft, an approval request is checked against the CV text."""
import copy
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform/job_assistant"))
import sync  # noqa: E402
from cv import PDF, parse  # noqa: E402
from cv_profile import correct  # noqa: E402

CV = ROOT / "frontend/public/cv/Anton_Ernstsson_CV_final.pdf"
DATA = CV.read_bytes()
SHA = parse(DATA, PDF, CV.name)["cv"]["sha256"]
WISHES = {"locations": ["Stockholm"], "remote": "hybrid", "roles": ["data_engineering"], "interests": []}


class Worker:
    """The Worker's /api/jobs routes over one in-memory state."""
    def __init__(self, draft=None, approved=None, status=200, newer=()):
        self.draft, self.approved, self.status, self.writes = draft, approved, status, []
        self.files = [{"sha256": SHA, "filename": CV.name, "media_type": PDF}, *newer]

    def response(self, body=None, content=b"", status=200):
        return type("R", (), {"status_code": status, "content": content, "json": lambda s: body,
                              "raise_for_status": lambda s: None})()

    def get(self, url, timeout, headers=None):
        path = url.split("/api/jobs")[1]
        assert headers == {"Authorization": "Bearer token"}, "the draft and CV files are owner-only"
        if path == "/profile":
            return self.response({"draft": self.draft, "approved": self.approved}, status=self.status)
        if path == "/cv":
            return self.response({"files": self.files})
        assert path == f"/cv/{SHA}"
        return self.response(content=DATA)

    def put(self, url, json, headers, timeout):
        assert headers["Authorization"] == "Bearer token"
        self.writes.append(("draft", copy.deepcopy(json)))
        self.draft = json
        return self.response()

    def post(self, url, json, headers, timeout):
        self.writes.append(("version", copy.deepcopy(json)))
        self.approved = json
        return self.response()


def test_new_cv_becomes_a_draft_keeping_wishes():
    old = correct(parse(DATA, PDF, CV.name), {"wishes": WISHES}, "wishes")
    old["cv"]["sha256"] = "0" * 64
    worker = Worker(draft={"profile": old, "approval_requested": False, "problems": []})
    assert sync.sync(worker, "token").startswith("parsed")
    kind, body = worker.writes[0]
    assert kind == "draft" and body["profile"]["cv"]["sha256"] == SHA
    assert body["profile"]["wishes"] == WISHES and body["problems"] == []


def test_approval_request_adds_a_version_once():
    draft = correct(parse(DATA, PDF, CV.name), {"wishes": WISHES}, "wishes")
    worker = Worker(draft={"profile": draft, "approval_requested": True, "problems": []})
    assert sync.sync(worker, "token") == "approved version 1"
    assert worker.writes[0][0] == "version" and worker.writes[0][1]["version"] == 1
    assert worker.draft["approval_requested"] is False
    worker.draft = json.loads(json.dumps({**worker.draft, "approval_requested": True}))
    assert sync.sync(worker, "token").startswith("approval refused: profile is unchanged")


def test_a_newer_cv_waits_for_a_pending_approval():
    draft = correct(parse(DATA, PDF, CV.name), {"wishes": WISHES}, "wishes")
    newer = {"sha256": "f" * 64, "filename": "new.pdf", "media_type": PDF}
    worker = Worker(draft={"profile": draft, "approval_requested": True, "problems": []}, newer=[newer])
    assert sync.sync(worker, "token") == "approved version 1; new.pdf is parsed next run"
    assert [w[0] for w in worker.writes] == ["version", "draft"]


def test_invented_experience_is_refused_with_its_problem():
    draft = parse(DATA, PDF, CV.name)
    draft["skills"].append({"skill": "Kubernetes", "category": "platform", "level": "practical",
                            "evidence": [{"level": "practical", "ref": "experience-1", "quote": "Ran Kubernetes."}]})
    worker = Worker(draft={"profile": draft, "approval_requested": True, "problems": []})
    assert sync.sync(worker, "token").startswith("approval refused")
    assert any("not in the CV experience" in p for p in worker.draft["problems"]) and worker.approved is None


def test_without_storage_or_token_nothing_is_written():
    assert sync.sync(Worker(status=503), "token") == "storage is not configured"
    worker = Worker()
    assert sync.sync(worker, "") == "no JOB_ASSIST_TOKEN; nothing written" and worker.writes == []
