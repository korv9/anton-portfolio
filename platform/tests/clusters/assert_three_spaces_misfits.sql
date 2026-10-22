-- Exactly 20 misfits, and each has 10 neighbours in every space.
select 'misfit_count' as problem, count(*) as n
from {{ ref('mart_municipality_three_spaces') }} where is_misfit
having count(*) <> 20
union all
select 'neighbours', count(*)
from {{ ref('mart_municipality_three_spaces') }}
where len(neighbours_social) <> 10 or len(neighbours_jobs) <> 10 or len(neighbours_votes) <> 10
having count(*) > 0
