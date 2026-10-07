"""Idea Lineage: the event schema, append-only journal, extraction from final answers only,
duplicates, project ids, visibility, derived views and that nothing conversational is stored."""
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform/idea_lineage"))

import extract  # noqa: E402
import query  # noqa: E402
import store  # noqa: E402
import views  # noqa: E402
from schema import FORBIDDEN_KEYS, validate  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"
DAY = "2026-10-07"
AT = "2026-10-07T13:42:00+02:00"


@pytest.fixture(autouse=True)
def home(tmp_path, monkeypatch):
    monkeypatch.setenv("IDEA_LINEAGE_HOME", str(tmp_path / "private"))
    monkeypatch.setenv("IDEA_LINEAGE_PUBLIC", str(tmp_path / "public"))
    monkeypatch.setattr(views, "EXPORT", tmp_path / "export/events.json")
    return tmp_path


def run(name: str, **kw) -> tuple[list[dict], list[str]]:
    text = (FIXTURES / name).read_text(encoding="utf-8")
    for e in store.read_events():
        text = text.replace("{IDEA_ID}", e["id"])
    events, notes = extract.build(text, store.read_events(), DAY, AT, **kw)
    store.append(events)
    return events, notes


def event(**kw) -> dict:
    return {"id": "idea-2026-10-07-001", "created_at": AT, "type": "idea", "title": "A short idea",
            "projects": ["symbolic-atlas"], **kw}


def test_schema_accepts_a_minimal_event_and_refuses_unknown_projects_and_ids():
    projects = set(store.projects())
    assert validate(event(), set(), projects) == []
    assert any("unknown project" in p for p in validate(event(projects=["symbolic"]), set(), projects))
    assert any("not <type>" in p for p in validate(event(id="idea-7"), set(), projects))
    assert any("prefix differs" in p for p in validate(event(type="decision"), set(), projects))
    assert any("no event" in p for p in validate(event(relations={"supersedes": ["idea-2026-10-01-001"]}),
                                                set(), projects))


def test_project_ids_come_from_the_registry():
    ids = set(store.projects())
    assert {"politics", "ai-act", "jobs", "symbolic-atlas", "concept-constellation", "allegoria",
            store.PORTFOLIO} <= ids


def test_ids_are_readable_and_unique_per_type_and_day():
    taken = {"idea-2026-10-07-001", "idea-2026-10-07-002", "decision-2026-10-07-001"}
    assert store.next_id("idea", DAY, taken) == "idea-2026-10-07-003"
    assert store.next_id("finding", DAY, taken) == "finding-2026-10-07-001"


def test_the_journal_is_append_only_and_refuses_a_reused_id(home):
    store.append([event()])
    path = home / "private/journal/2026-10-07.jsonl"
    before = path.read_text()
    store.append([event(id="idea-2026-10-07-002", title="Another idea")])
    assert path.read_text().startswith(before)
    with pytest.raises(ValueError, match="already used"):
        store.append([event(title="Reuse")])
    assert len(path.read_text().splitlines()) == 2


def test_nothing_is_written_when_one_event_in_a_batch_is_invalid(home):
    with pytest.raises(ValueError):
        store.append([event(), event(id="idea-2026-10-07-002", projects=["nope"])])
    assert store.read_events() == []


def test_an_answer_without_marked_events_records_nothing():
    events, _ = run("no_event.txt")
    assert events == []


def test_a_new_idea_keeps_its_uncertainty_and_project():
    (e,), _ = run("new_idea.txt")
    assert e["type"] == "idea" and e["certainty"] == "proposed"
    assert e["projects"] == ["symbolic-atlas"]
    assert e["source"]["kind"] == "assistant_output" and len(e["source"]["output_sha256"]) == 64


def test_a_hedged_decision_is_stored_as_an_idea():
    (e,), _ = run("hedged_decision.txt")
    assert e["type"] == "idea" and e["certainty"] == "proposed"


def test_a_decision_supersedes_an_earlier_idea_without_editing_it(home):
    (idea,), _ = run("new_idea.txt")
    (decision,), _ = run("decision_supersedes.txt")
    assert decision["type"] == "decision" and decision["certainty"] == "confirmed"
    assert decision["relations"] == {"supersedes": [idea["id"]]}
    assert decision["reason"].startswith("the full constellation")
    assert "concept-constellation" in decision["projects"]
    stored = {e["id"]: e for e in store.read_events()}
    assert "effective_status" not in stored[idea["id"]]
    assert views.effective(store.read_events())[idea["id"]]["effective_status"] == "superseded"


def test_experiments_findings_and_questions_from_sections_and_labels():
    events, _ = run("experiment_finding.txt")
    kinds = [(e["type"], e.get("certainty"), e.get("status")) for e in events]
    assert kinds == [("experiment", "confirmed", "active"), ("finding", "confirmed", "active"),
                     ("finding", "tentative", "active"), ("question", None, "open")]
    assert all(e["projects"] == ["symbolic-atlas"] for e in events)


def test_a_cross_project_idea_names_every_project():
    (e,), _ = run("cross_project.txt")
    assert {"ai-act", "jobs"} <= set(e["projects"])
    view = views.portfolio_state(views.effective(store.read_events()), views.project_names())
    assert "↔" in view


def test_the_same_answer_twice_and_a_repeated_idea_are_not_duplicated():
    run("new_idea.txt")
    again, notes = run("new_idea.txt")
    assert again == [] and "extracted before" in notes[0]
    text = "Idea: Centre the Symbolic Atlas embeddings by translator as well as by book!"
    events, notes = extract.build(text, store.read_events(), DAY, AT)
    assert events == [] and "same as" in notes[0]


def test_a_near_duplicate_is_kept_and_linked_as_inferred():
    (first,), _ = run("new_idea.txt")
    text = "Idea: Centre the Symbolic Atlas embeddings by translator, then compare with book centring."
    (e,), notes = extract.build(text, store.read_events(), DAY, AT)
    assert e["inferred_relations"] == {"related_to": [first["id"]]}
    assert "relations" not in e


def test_a_conversation_export_is_refused():
    assert extract.looks_like_conversation((FIXTURES / "conversation.txt").read_text())
    assert extract.looks_like_conversation(json.dumps({"messages": [{"role": "user", "content": "x"}]}))
    assert not extract.looks_like_conversation((FIXTURES / "new_idea.txt").read_text())
    assert extract.main(["--input", str(FIXTURES / "conversation.txt"), "--mode", "auto"]) == 2
    assert store.read_events() == []


def test_review_mode_writes_nothing_until_applied():
    assert extract.main(["--input", str(FIXTURES / "new_idea.txt")]) == 0
    assert store.read_events() == []
    assert extract.main(["--input", str(FIXTURES / "new_idea.txt"), "--apply"]) == 0
    assert len(store.read_events()) == 1


def test_no_prompt_transcript_or_reasoning_is_persisted(home):
    for name in ["new_idea.txt", "experiment_finding.txt", "cross_project.txt"]:
        run(name)
    for path in (home / "private/journal").glob("*.jsonl"):
        for line in path.read_text().splitlines():
            e = json.loads(line)
            blob = json.dumps(e)
            assert not FORBIDDEN_KEYS & set(e)
            assert all(len(v) <= 600 for v in e.values() if isinstance(v, str))
            assert "Here is how I would approach it" not in blob
    for key in ["prompt", "user_message", "conversation", "raw_response", "chain_of_thought"]:
        problems = validate(event(source={"kind": "manual", key: "x"}), set(), set(store.projects()))
        assert any("forbidden" in p for p in problems)


def test_the_committed_public_journal_is_clean():
    for path in (ROOT / ".idea-lineage/public/journal").glob("*.jsonl"):
        events = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
        known = {e["id"] for e in events}
        for e in events:
            assert e["visibility"] == "public"
            assert validate(e, known, set(store.projects())) == [], e["id"]


def test_only_public_events_and_links_between_them_are_exported():
    store.append([event(visibility="public"),
                  event(id="idea-2026-10-07-002", title="Private", visibility="private"),
                  event(id="decision-2026-10-07-001", type="decision", title="Public decision",
                        visibility="public", source={"kind": "manual", "session_date": DAY},
                        relations={"supersedes": ["idea-2026-10-07-001"], "related_to": ["idea-2026-10-07-002"]})])
    out = views.public_events(store.read_events())
    assert [e["id"] for e in out] == ["decision-2026-10-07-001", "idea-2026-10-07-001"] or \
        {e["id"] for e in out} == {"decision-2026-10-07-001", "idea-2026-10-07-001"}
    decision = next(e for e in out if e["type"] == "decision")
    assert decision["relations"] == {"supersedes": ["idea-2026-10-07-001"]}
    assert all("visibility" not in e and "source" not in e for e in out)


def test_state_diary_and_context_are_rebuilt_from_the_journal(home):
    run("new_idea.txt")
    run("decision_supersedes.txt")
    run("experiment_finding.txt")
    views.build_state()
    views.build_diary()
    symbolic = (home / "private/state/symbolic-atlas.md").read_text()
    assert symbolic.startswith(views.HEADER)
    assert "## Open questions" in symbolic and "translator-driven" in symbolic
    assert "superseded by" in symbolic
    concept = (home / "private/state/concept-constellation.md").read_text()
    assert "## Current direction" in concept and "Concept Journey becomes the default" in concept
    diary = (home / "private/diary/2026-10-07.md").read_text()
    assert "# 7 October 2026" in diary.splitlines()[:4] and "## Findings" in diary
    context = json.loads((home / "private/context.json").read_text())
    assert context["projects"]["symbolic-atlas"]["open_questions"]
    for line in diary.splitlines() + symbolic.splitlines():
        assert not any(w in line.lower() for w in ["streak", "overdue", "productivity", "% complete"])


def test_why_walks_back_and_history_is_chronological():
    (idea,), _ = run("new_idea.txt")
    (decision,), _ = run("decision_supersedes.txt")
    chain = query.why(decision["id"], store.read_events())
    assert [e["id"] for e, _ in chain] == [idea["id"], decision["id"]] or \
        [e["id"] for e, _ in chain] == [decision["id"], idea["id"]]
    assert ("supersedes" in [r for _, r in chain])
    hist = query.history("concept-constellation", store.read_events())
    assert [e["id"] for e in hist][-1] == decision["id"]
    assert query.search("translator centring", store.read_events())[0][1]["id"] == idea["id"]
