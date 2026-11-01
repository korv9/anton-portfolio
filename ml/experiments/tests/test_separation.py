"""Job-ad clustering stays separate from the job assistant's CV matching, in both directions.

Everything under ml/ may read the shared ad store (ads.json). It may not import the job assistant,
and may not name its matches or any CV file.
"""
import ast
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
SKIPPED = {'.venv', '.cache', 'runs', '__pycache__', 'node_modules'}
FORBIDDEN_READS = re.compile(
    r'matches\.json|cv_profile|profile-draft|(^|[/\\])cv[/\\]|\bcv\.(pdf|md|txt|json)\b'
    r'|[_-]cv[_.-].*\.(pdf|docx?|md)\b',
    re.IGNORECASE)


def sources(folder: Path):
    for path in folder.rglob('*.py'):
        if not SKIPPED & set(path.relative_to(folder).parts) and path != Path(__file__).resolve():
            yield path


def imported(tree: ast.AST) -> set[str]:
    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names |= {a.name for a in node.names}
        elif isinstance(node, ast.ImportFrom) and node.module:
            names.add(node.module)
    return names


def named_files(tree: ast.AST) -> set[str]:
    return {node.value for node in ast.walk(tree) if isinstance(node, ast.Constant)
            and isinstance(node.value, str) and FORBIDDEN_READS.search(node.value)}


def trees(folder: Path) -> dict[str, ast.AST]:
    return {str(path.relative_to(REPO)): ast.parse(path.read_text(encoding='utf-8')) for path in sources(folder)}


def test_ml_never_imports_the_job_assistant():
    found = trees(REPO / 'ml')
    assert any('experiments' in name for name in found) and any('atlas' in name for name in found)
    assert {f: n for f, t in found.items() if (n := {m for m in imported(t) if 'job_assistant' in m})} == {}


def test_ml_never_names_matches_or_cv_files():
    assert {f: n for f, t in trees(REPO / 'ml').items() if (n := named_files(t))} == {}


def test_the_read_check_catches_what_it_is_for():
    caught = ["warehouse/raw/job_assistant/matches.json", "public/cv/Anton_CV_final.pdf", "cv.pdf",
              "tmp/profile-draft.json", "platform/job_assistant/cv_profile.py"]
    allowed = ["warehouse/raw/job_assistant/ads.json", "grouped-cv", "recv", "archive/csv/x"]
    assert named_files(ast.parse('\n'.join(repr(text) for text in caught))) == set(caught)
    assert not named_files(ast.parse('\n'.join(repr(text) for text in allowed)))


def test_job_assistant_never_imports_ml():
    found = trees(REPO / 'platform' / 'job_assistant')
    assert found, 'no job assistant modules found'
    used = {f: n for f, t in found.items()
            if (n := {m for m in imported(t) if m == 'ml' or m.startswith('ml.') or 'experiments' in m or 'mlkit' in m})}
    assert used == {}
