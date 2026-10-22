-- Exactly 20 misfits (least agreement), each with 10 neighbours in every space, and one row per
-- municipality ml/three_swedens.py analysed, so the join to dim_municipality cannot drop rows.
select 'misfit_count' as problem, count(*) as n
from {{ ref('mart_municipality_three_spaces') }} where is_misfit
having count(*) <> 20
union all
select 'neighbours', count(*)
from {{ ref('mart_municipality_three_spaces') }}
where len(neighbours_social) <> 10 or len(neighbours_jobs) <> 10 or len(neighbours_votes) <> 10
having count(*) > 0
union all
select 'row_count', count(*)
from {{ ref('mart_municipality_three_spaces') }}
having count(*) <> (select coverage.n from read_json_auto(
    '{{ env_var('PORTFOLIO_FEATURES', '../warehouse/features') }}/clusters/three-swedens/run/metrics.json'))
