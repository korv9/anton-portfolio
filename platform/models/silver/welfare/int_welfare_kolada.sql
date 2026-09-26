-- Kolada values for municipalities, counties and the country only; Kolada's municipality
-- groups are dropped. Region ids: '0000' is the country, '00LL' county LL, else the
-- municipality code.
select
    'kolada_' || v.kpi_id as indicator_key,
    case when v.kolada_region_id = '0000' then '00'
         when m.kolada_region_type = 'L' then right(v.kolada_region_id, 2)
         else v.kolada_region_id end as region_code,
    cast(v.year as varchar) as period_key,
    v.sex_code as sex_key,
    v.value,
    v.value_status
from {{ ref('stg_kolada_values') }} as v
join {{ ref('stg_kolada_municipalities') }} as m using (kolada_region_id)
where not v.is_deleted
  and v.kpi_id in (select kpi_id from {{ ref('kolada_kpis') }})
