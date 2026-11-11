"""The committed memory files stay consistent: PROJECTS.md names real projects, the generated
views are not older than the journal, and the hook reads only the assistant's final message."""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform/idea_lineage"))

import hook  # noqa: E402
import store  # noqa: E402

PROJECTS_MD = (ROOT / "PROJECTS.md").read_text(encoding="utf-8")


def test_projects_md_headings_are_registry_ids():
    ids = set(store.projects())
    listed = re.findall(r"^### ([\w-]+) · ", PROJECTS_MD, flags=re.M)
    assert listed, "PROJECTS.md has no project headings"
    assert not set(listed) - ids, f"unknown project ids in PROJECTS.md: {set(listed) - ids}"


def test_projects_md_links_point_at_existing_paths():
    live = PROJECTS_MD.split("## Delete zone")[0]  # the delete zone names removed paths on purpose
    paths = []
    for p in re.findall(r"`((?:frontend|platform|ml|docs|configs|infra|worker)/[^`*]+?)`", live):
        if m := re.match(r"(.*)\{([^}]+)\}(.*)", p):  # a/{b,c} names several paths
            paths += [m.group(1) + part + m.group(3) for part in m.group(2).split(",")]
        else:
            paths.append(p)
    missing = sorted({p for p in paths if not (ROOT / p.rstrip("/")).exists()})
    assert not missing, f"PROJECTS.md names paths that do not exist: {missing}"


def test_generated_views_are_not_older_than_the_public_journal():
    journal = max(p.stat().st_mtime for p in (ROOT / ".idea-lineage/public/journal").glob("*.jsonl"))
    for name in ["docs/decisions/DECISIONS.md", "docs/decisions/DATA_DECISIONS.md", "docs/idea-lineage/README.md"]:
        path = ROOT / name
        assert path.exists(), f"{name} missing: run npm run ideas:build"
        text = path.read_text(encoding="utf-8")
        assert text.startswith("<!-- Generated from the Idea Lineage journal"), name
    # Content check rather than mtime: every public decision id appears in DECISIONS.md.
    ids = [json.loads(l)["id"] for p in (ROOT / ".idea-lineage/public/journal").glob("*.jsonl")
           for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]
    decisions = (ROOT / "docs/decisions/DECISIONS.md").read_text(encoding="utf-8")
    missing = [i for i in ids if i.startswith(("decision-", "rejection-")) and i not in decisions]
    assert not missing, f"stale DECISIONS.md, run npm run ideas:build: {missing}"
    assert journal  # the journal exists


def test_continuity_stays_a_short_handover():
    lines = [l for l in (ROOT / "CONTINUITY.md").read_text(encoding="utf-8").splitlines() if l.strip()]
    assert len(lines) <= 40, f"CONTINUITY.md has {len(lines)} non-empty lines; move history to the journal"


def test_hook_reads_only_the_last_assistant_message(tmp_path):
    transcript = tmp_path / "t.jsonl"
    transcript.write_text("\n".join([
        json.dumps({"type": "user", "message": {"content": "Beslut: the user's text must not be read"}}),
        json.dumps({"type": "assistant", "message": {"content": [{"type": "text", "text": "earlier answer"}]}}),
        json.dumps({"type": "assistant", "message": {"content": [{"type": "text", "text": "Final.\nFynd: 3 of 4 pass."}]}}),
    ]), encoding="utf-8")
    assert hook.last_answer(transcript) == "Final.\nFynd: 3 of 4 pass."


def test_hook_is_registered_and_exits_zero_on_bad_input():
    settings = json.loads((ROOT / ".claude/settings.json").read_text(encoding="utf-8"))
    commands = [h["command"] for group in settings["hooks"]["Stop"] for h in group["hooks"]]
    assert "python platform/idea_lineage/hook.py" in commands
    done = subprocess.run([sys.executable, str(ROOT / "platform/idea_lineage/hook.py")],
                          input="not json", capture_output=True, text=True)
    assert done.returncode == 0
