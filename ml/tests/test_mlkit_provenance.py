import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from mlkit import cards, metrics, provenance
from mlkit.tasks.government_defeat import PROCEDURE_MASK, procedure_flags


def key_of(inputs):
    return hashlib.sha256(json.dumps(inputs, sort_keys=True).encode()).hexdigest()[:16]


def test_cache_key_changes_with_code_and_data_but_not_for_the_same_input(tmp_path):
    task = tmp_path / 'task.py'
    task.write_text('x = 1\n', encoding='utf-8')
    inputs, rows = {'rows': 2}, [('a', 1), ('b', 2)]
    base = key_of(provenance.stamp(inputs, task, rows))
    assert base == key_of(provenance.stamp(inputs, task, list(rows)))
    # Same row count, one changed value: a key built from counts would call this a cache hit.
    assert base != key_of(provenance.stamp(inputs, task, [('a', 1), ('b', 3)]))
    task.write_text('x = 2\n', encoding='utf-8')
    assert base != key_of(provenance.stamp(inputs, task, rows))


def test_crlf_checkout_has_the_same_code_digest(tmp_path):
    lf, crlf = tmp_path / 'lf.py', tmp_path / 'crlf.py'
    lf.write_bytes(b'x = 1\ny = 2\n')
    crlf.write_bytes(b'x = 1\r\ny = 2\r\n')
    assert provenance.code_digest(lf) == provenance.code_digest(crlf)


def test_card_carries_both_digests_and_the_commit():
    fields = provenance.card_fields({'code_sha256': 'c' * 16, 'data_sha256': 'd' * 16})
    assert fields['code digest'] == 'c' * 16 and fields['data digest'] == 'd' * 16
    assert fields['git commit']


def test_shuffling_between_speakers_is_wider_than_shuffling_rows():
    # Two parties of 20 speakers with 50 passages each. Whole speakers carry their score, so a row
    # shuffle calls speaker differences significant when party has no effect.
    rng = np.random.default_rng(1)
    speakers = np.repeat(np.arange(40), 50)
    party = np.repeat(np.arange(40) % 2, 50)
    scores = rng.normal(size=40)[speakers] + rng.normal(scale=0.1, size=2000)
    auc = metrics.auc
    by_row = metrics.permutation_test(auc, party, scores, iterations=200, seed=0)
    by_speaker = metrics.permutation_test(auc, party, scores, iterations=200, seed=0, groups=speakers)
    assert by_speaker['p_value'] > by_row['p_value']
    assert by_speaker['p_value'] > 0.05 or by_row['p_value'] == by_row['floor']
    # A true party effect still clears a shuffle of speakers, so the test can also pass.
    effect = scores + 3 * party
    assert metrics.permutation_test(auc, party, effect, iterations=200, seed=0,
                                    groups=speakers)['p_value'] == 1 / 201


def test_a_group_with_two_labels_is_refused():
    with pytest.raises(ValueError):
        metrics.permutation_test(metrics.auc, np.array([0, 1]), np.array([0.1, 0.2]), groups=np.array([1, 1]))


def test_procedure_mask_and_flags_cover_the_audited_words():
    titles = ['Uppmaning till regeringen om skatt', 'Motioner om skatt', 'Nej till skatt', 'Skatt på bensin']
    assert procedure_flags(titles).tolist() == [[1, 0], [0, 1], [0, 1], [0, 0]]
    assert [PROCEDURE_MASK.sub('', t).strip() for t in titles[1:3]] == ['om skatt', 'till skatt']
    assert 'regeringen' not in PROCEDURE_MASK.sub('', titles[0]).lower()


def test_cards_write_requires_limitations(tmp_path, monkeypatch):
    monkeypatch.setattr(cards, 'CARDS', tmp_path)
    with pytest.raises(ValueError):
        cards.write_card('t', 'r', {'purpose': 'p'})
