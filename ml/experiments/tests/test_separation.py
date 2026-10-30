"""Job-ad clustering stays separate from the job assistant's CV matching, in both directions."""
import ast
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]


def imports(folder: Path) -> dict[str, set[str]]:
    found = {}
    for path in folder.glob('*.py'):
        names = set()
        for node in ast.walk(ast.parse(path.read_text(encoding='utf-8'))):
            if isinstance(node, ast.Import):
                names |= {a.name for a in node.names}
            elif isinstance(node, ast.ImportFrom) and node.module:
                names.add(node.module)
        found[path.name] = names
    return found


def test_experiments_never_import_the_job_assistant():
    used = imports(REPO / 'ml' / 'experiments')
    assert used, 'no experiment modules found'
    assert {f: n for f, n in used.items() if any('job_assistant' in m for m in n)} == {}


def test_job_assistant_never_imports_the_experiments():
    used = imports(REPO / 'platform' / 'job_assistant')
    assert used, 'no job assistant modules found'
    assert {f: n for f, n in used.items() if any('experiments' in m for m in n)} == {}
