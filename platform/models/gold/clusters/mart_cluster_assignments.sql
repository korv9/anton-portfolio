-- One row per clustering × entity × period. Municipal clusterings take the SCB name from
-- dim_municipality; cluster_share is the cluster's share of the period's assigned entities.
with assignments as (
    select * from {{ ref('stg_cluster_assignments') }}
), named as (
    select
        a.clustering, a.entity_id,
        coalesce(m.municipality_name, a.entity_name) as entity_name,
        a.period, a.cluster, a.cluster < 0 as is_noise, a.probability
    from assignments as a
    left join {{ ref('dim_municipality') }} as m
        on m.municipality_code = a.entity_id and m.valid_to is null
        and (a.clustering like 'municipal-%' or a.clustering like 'labour-market-%')
)
select
    *,
    case when not is_noise then
        count(*) over (partition by clustering, period, cluster)
        / count(*) filter (where not is_noise) over (partition by clustering, period)
    end as cluster_share
from named
