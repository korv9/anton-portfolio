import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from mlkit import promote

CARDS = Path(__file__).resolve().parents[1] / 'cards'


def test_a_failed_card_leaves_no_published_file(tmp_path, monkeypatch):
    cards, out, runs = tmp_path / 'cards', tmp_path / 'out', tmp_path / 'runs'
    cards.mkdir(), out.mkdir(), (runs / 'r1').mkdir(parents=True)
    for task in ('government_defeat', 'polarization'):
        shutil.copy(CARDS / f'{task}.md', cards)
        (out / f'{task}.json').write_text('{}', encoding='utf-8')  # left by an earlier passed run
    monkeypatch.setattr(promote, 'CARDS', cards)
    monkeypatch.setattr(promote, 'OUT', out)
    monkeypatch.setattr(promote, 'RUNS', runs)
    monkeypatch.setattr(sys, 'argv', ['promote', 'r1'])
    promote.main()
    register = {e['task']: e for e in promote.json.loads((out / 'models.json').read_text(encoding='utf-8'))}
    assert not register['government_defeat']['gate_passed'] and not register['government_defeat']['published']
    assert not (out / 'government_defeat.json').exists()
    assert register['polarization']['published'] and (out / 'polarization.json').exists()
