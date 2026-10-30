"""Philosophy Lab experiments: dataset and split, run records, rejection. Synthetic fixtures only."""
import pandas as pd

from ml.experiments import accept, contract
from ml.experiments import philosophy as ph
from ml.experiments import philosophy_runs as runs
from ml.experiments.registry import Registry

DOCUMENTS = [{'id': f'w{i}', 'title': f'Work {i}', 'original_language': 'en' if i % 3 == 0 else 'de',
              'genre': 'treatise' if i % 2 else 'essay', 'translator': None if i % 3 == 0 else f'T{i % 2}'}
             for i in range(8)]


def frame(duplicate: bool = True) -> pd.DataFrame:
    rows = [{'passage_id': f'w{w}-{p}', 'document_id': f'w{w}', 'position': p, 'author': f'A{w}',
             'tradition': 'x', 'text': f'passage {p} of work {w}'} for w in range(8) for p in range(5)]
    if duplicate:  # a passage reprinted in another work joins the two works' components
        rows[-1]['text'] = rows[0]['text']
    return ph.observations(pd.DataFrame(rows), DOCUMENTS)


def test_split_has_no_leaks_and_version_follows_text():
    data, leaks = ph.assign_sides(frame())
    assert leaks == []
    for column in ('document_id', 'text_hash'):
        sides = data.groupby(column)['side'].nunique()
        assert (sides == 1).all()
    assert data.loc[0, 'side'] == data.loc[len(data) - 1, 'side']
    assert set(data.side) == {'selection', 'evaluation'}
    changed = frame()
    changed.loc[3, 'text_hash'] = 'other'
    assert ph.dataset_version(frame()) != ph.dataset_version(changed)
    assert data.loc[data.document_id == 'w0', 'translator'].iloc[0] == 'original English'
    assert data.loc[data.document_id == 'w1', 'translator'].iloc[0] == 'T1'


def test_unnamed_translators_stay_apart():
    assert ph.translator_value(None, 'grc', 'a') != ph.translator_value(None, 'grc', 'b')


def metrics(ari: float, work: float, translator: float, sil: float = 0.1, groups: int = 8, noise: float = 0.3):
    return {'cluster_count': groups, 'noise_share': noise, 'seed_stability': {'ari_mean': ari},
            'separation_representation': sil,
            'dominance': {'work': {'weighted_top_share': work}, 'translator': {'weighted_top_share': translator}}}


META = {'dataset_version': 'synthetic', 'sides': {'evaluation': {'works': ['w1', 'w2']}}}


def test_run_record_validates():
    run = runs.run_record(runs.CHAMPION, metrics(0.6, 0.5, 0.5), {'seconds': 1}, META, 10, 'synthetic', ['synthetic'])
    assert contract.validate(run) == []
    assert run['pipeline']['embedding']['revision']


def test_candidate_failing_frozen_criteria_is_rejected(tmp_path):
    reg = Registry('philosophy', tmp_path)
    champion = runs.run_record(runs.CHAMPION, metrics(0.6, 0.5, 0.5), {}, META, 10, 'champion', ['synthetic'])
    reg.register(champion, 'champion', 'synthetic')
    p = runs.pipeline('mpnet', 'passage', 'raw', {'method': 'kmeans', 'k': 6})
    # More stable (a measured gain) but far more dominated by work: must be rejected.
    worse = runs.run_record(p, metrics(0.9, 0.8, 0.5), {}, META, 10, 'worse', ['synthetic'])
    reg.register(worse)
    assert runs.judge(reg, champion, worse, accept.criteria('philosophy')) == 'rejected'
    report = reg.load()['runs'][worse['run_id']]['acceptance']
    assert report['failed'] == ['work dominance not worse']
    better = runs.run_record(runs.pipeline('mpnet', 'passage', 'centred', {'method': 'kmeans', 'k': 6}),
                             metrics(0.7, 0.42, 0.5), {}, META, 10, 'better', ['synthetic'])
    reg.register(better)
    assert runs.judge(reg, champion, better, accept.criteria('philosophy')) == 'candidate'


def test_chunks_cover_the_whole_passage():
    text = ' '.join(f'w{i}' for i in range(170))
    pieces = ph.chunks(text)
    assert [len(p.split()) for p in pieces] == [80, 80, 10] and ' '.join(pieces) == text
    assert ph.chunks('') == ['']
