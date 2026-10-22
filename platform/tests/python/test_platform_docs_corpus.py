"""Ask the platform's corpus: only tracked public files, each passage traceable to its file at a commit."""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform" / "nlp"))
import platform_docs_corpus as corpus  # noqa: E402

META = ROOT / "frontend" / "public" / "data" / "workers-ai" / "platform" / "meta.json"


def git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")


def test_allowed_refuses_untracked_ignored_and_private_paths():
    tracked = {"docs/pipeline.md", ".env", "warehouse/portfolio.duckdb",
               "platform/products/thesis/private/notes.md", ".idea-lineage/journal.md"}
    assert corpus.allowed("docs/pipeline.md", tracked)
    assert not corpus.allowed("docs/not-tracked.md", tracked)
    for path in tracked - {"docs/pipeline.md"}:
        assert not corpus.allowed(path, tracked), path
    # Ignored by .gitignore even if a stale index still listed it.
    assert not corpus.allowed("tmp/notes.md", {"tmp/notes.md"})


def test_sections_skip_headings_inside_code_fences():
    text = "# Title\nintro\n\n```sh\n# a comment, not a heading\n```\n\n## Next\nbody"
    assert [h for h, _ in corpus.sections(text)] == ["Title", "Next"]


def test_every_published_passage_is_a_tracked_public_file_at_its_commit():
    items = json.loads(META.read_text(encoding="utf-8"))["items"]
    tracked = set(git("ls-files", "-z").stdout.split("\0"))
    ids = [i["id"] for i in items]
    assert len(ids) == len(set(ids))
    for path in {i["path"] for i in items}:
        assert corpus.allowed(path, tracked), f"{path} must not be in the corpus"
    for path, commit in {(i["path"], i["commit"]) for i in items}:
        assert git("cat-file", "-e", f"{commit}:{path}").returncode == 0, (path, commit)
    for item in items:
        assert 0 < len(item["text"]) <= corpus.LONG
        assert item["url"].endswith(f"/{item['commit']}/{item['path']}")
