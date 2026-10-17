"""Source totals, temporal joins and comparable-vote denominators on hand-worked records."""
import importlib.util
import json
import re
from pathlib import Path

import duckdb
import pytest

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('politics_workspace', ROOT / 'platform/publish/politics_workspace.py')
workspace = importlib.util.module_from_spec(spec)
spec.loader.exec_module(workspace)


def vote(key, day='2025-01-01', issue=None):
    return dict(session='2024/25', roll_call_id=key, vote_date=day, issue_key=issue)


def party(key, name, yes=0, no=0, abstain=0, absent=0):
    return dict(session='2024/25', vote_id=key, party=name, yes_votes=yes,
                no_votes=no, abstain_votes=abstain, absent_votes=absent)


def test_contexts_exclude_ties_and_absence_but_compare_abstention():
    votes = [vote(str(i)) for i in range(4)]
    rows = [party('0', 'A', yes=3, no=1), party('0', 'B', yes=2),
            party('1', 'A', abstain=3), party('1', 'B', no=2),
            party('2', 'A', yes=1, no=1), party('2', 'B', yes=2),
            party('3', 'A', absent=4), party('3', 'B', yes=2)]
    pairs, records, sessions = workspace.contexts(votes, rows, [])
    assert len(pairs) == 1 and pairs[0]['same'] == 1 and pairs[0]['compared'] == 2
    a = next(row for row in records if row['party'] == 'A')
    assert (a['eligible'], a['present'], a['aligned_cast'], a['comparable_cast']) == (13, 9, 6, 7)
    assert a['mixed_roll_calls'] == 2
    assert sessions == ['2024/25']


def test_contexts_use_half_open_government_dates_and_reject_duplicate_joins():
    governments = [dict(government_key='old', start_date='2024-01-01', end_date='2025-01-01', prime_minister_party='A'),
                   dict(government_key='new', start_date='2025-01-01', end_date='', prime_minister_party='B')]
    assert workspace.government_at(governments, '2025-01-01')['government_key'] == 'new'
    rows = [party('x', 'A', no=3), party('x', 'B', yes=3)]
    pairs, records, _ = workspace.contexts([vote('x')], rows, governments)
    assert pairs[0]['government_key'] == 'new'
    assert next(r for r in records if r['party'] == 'A')['pm_same'] == 0
    with pytest.raises(ValueError, match='Duplicate party-vote'):
        workspace.contexts([vote('x')], rows + rows[:1], governments)
    with pytest.raises(ValueError, match='Duplicate roll-call'):
        workspace.contexts([vote('x'), vote('x')], rows, governments)
    with pytest.raises(ValueError, match='Overlapping'):
        workspace.government_at(governments + governments[1:], '2025-01-01')


def test_ballot_categories_and_negative_parliamentarism():
    assert workspace.position(dict(yes=0, no=0, abstain=0, absent=0)) == 'not_represented'
    assert workspace.position(dict(yes=0, no=0, abstain=0, absent=2)) == 'absent'
    assert workspace.position(dict(yes=0, no=1, abstain=30, absent=0)) == 'mixed'
    ballots = workspace.ballots([], '2026-10-16')
    assert len(ballots) == 10
    assert all(sum(b['totals'].values()) == 349 for b in ballots)
    first = next(b for b in ballots if b['date'] == '2021-11-24')
    assert first['totals']['yes'] == 117 and first['totals']['no'] == 174 and first['approved']
    assert first['formed_government'] is None
    assert not ballots[-1]['approved']
    assert all(b['date'] < '2020' for b in workspace.ballots([], '2019-12-31'))


def sql(con, name):
    source = (ROOT / f'platform/models/gold/parliament/{name}.sql').read_text(encoding='utf-8')
    return con.execute(re.sub(r"\{\{ ref\('([^']+)'\) \}\}", r'\1', source))


def test_actual_gold_sql_matches_offline_context_counts():
    con = duckdb.connect()
    con.execute("create table fct_roll_call(session varchar,roll_call_id varchar,government_key varchar,government_position varchar)")
    con.execute("insert into fct_roll_call values ('2024/25','x','new','yes'),('2024/25','y','new','abstain')")
    con.execute('create table fct_party_roll_call(session varchar,roll_call_id varchar,party varchar,position varchar,issue_key varchar,is_substantive boolean,members int,present int,yes int,no int,abstain int,absent int)')
    con.execute("insert into fct_party_roll_call values ('2024/25','x','A','no',null,true,4,3,0,3,0,1),('2024/25','x','B','yes',null,true,3,3,3,0,0,0),('2024/25','y','A','abstain',null,true,4,4,0,0,4,0),('2024/25','y','B','abstain',null,true,3,3,0,0,3,0)")
    pairs = sql(con, 'mart_party_pair_context').fetchall()
    assert pairs == [('2024/25','new',None,'A','B',2,1)]
    cursor = sql(con, 'mart_party_cohesion_context')
    rows = [dict(zip([c[0] for c in cursor.description], row)) for row in cursor.fetchall()]
    a = next(row for row in rows if row['party'] == 'A')
    assert (a['eligible'], a['present'], a['aligned_cast'], a['pm_same'], a['pm_compared']) == (8,7,7,0,1)


def test_committed_contract_is_consistent_and_has_no_future_ballots():
    index = json.loads((ROOT / 'frontend/public/data/parliament/workspace/index.json').read_text(encoding='utf-8'))
    assert index['context_sessions'] == ['2024/25','2025/26']
    assert all(row['same'] <= row['compared'] and row['compared'] > 0 for row in index['pairs'])
    assert all(b['date'] <= index['as_of'] for b in index['ballots'])
    for row in index['cohesion']:
        assert 0 <= row['aligned_cast'] <= row['comparable_cast'] <= row['present'] <= row['eligible']
        assert 0 <= row['pm_same'] <= row['pm_compared'] <= row['roll_calls']
