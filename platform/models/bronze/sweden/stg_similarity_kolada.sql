-- Kolada's 2024 values (both sexes) for the four key figures the panel lacks, named as the
-- clustering's features.
with structure as (
    select content::json as j from {{ source('sweden_similarity', 'kolada_structure') }}
), kpis as (
    select feature, j -> 'kpis' ->> feature as kpi
    from structure, unnest(json_keys(j -> 'kpis')) as u(feature)
), observations as (
    select unnest(json_extract(j, '$.values[*]')) as r from structure
), values_t as (
    select r ->> 'municipality' as municipality_code, r ->> 'kpi' as kpi,
           unnest(json_extract(r, '$.values[*]')) as v
    from observations
)
select v.municipality_code, k.feature, cast(v.v ->> 'value' as double) as value
from values_t as v
join kpis as k on k.kpi = v.kpi
where v.v ->> 'gender' = 'T'
