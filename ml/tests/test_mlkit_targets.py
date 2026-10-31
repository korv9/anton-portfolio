import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from mlkit.tasks.government_defeat import within_session_auc
from mlkit.tasks.reply import label


def test_within_session_auc_ignores_pairs_across_sessions():
    # Session 0 is ranked perfectly, session 1 perfectly backwards: one win, one loss.
    truth = np.array([1, 0, 1, 0])
    packed = np.array([[0.9, 0], [0.1, 0], [0.2, 1], [0.8, 1]])
    assert within_session_auc(truth, packed) == 0.5
    # Shifting a whole session's scores changes nothing, since no pair crosses sessions.
    packed[2:, 0] += 10
    assert within_session_auc(truth, packed) == 0.5


def test_a_reply_labels_the_main_speech_before_it_in_the_same_debate():
    row = lambda path, n, reply, text: (path, 1, n, reply, 'S', 'Anna Ek (S)', '2020/21',
                                        'issues', text)
    speeches = label([row('a', 1, False, 'Fru talman! Ett'), row('a', 2, False, 'Två'),
                      row('a', 3, True, 'Replik'), row('a', 4, True, 'Svar'),
                      row('b', 1, True, 'Replik utan huvudanförande'), row('b', 2, False, 'Tre')])
    assert [(s['debate'], s['position'], s['label']) for s in speeches] == [
        ('a#1', 1, 0), ('a#1', 2, 1), ('b#1', 1, 0)]
    assert speeches[0]['text'] == 'Ett'
