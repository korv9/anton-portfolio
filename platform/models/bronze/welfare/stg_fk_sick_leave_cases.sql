-- Sick-leave case counts from three FK tables, stacked. `yoy_change_pct` is FK's own
-- change against the same month a year earlier; it is published for started cases only.
select
    'started' as case_type,
    'ALL' as county_code,
    'ALL' as age_code,
    dimensions.diagnoskapitel_kod as diagnosis_code,
    dimensions.kon_kod as sex_code,
    cast(dimensions.ar as integer) as year,
    cast(dimensions.manad as integer) as month,
    observations.antal.value as cases,
    observations.antal.rojd as cases_suppressed,
    observations.andel.value as yoy_change_pct
from {{ source('fk', 'started_by_diagnosis') }}
union all
select
    'started', dimensions.lan_kod, 'ALL', 'F43', dimensions.kon_kod,
    cast(dimensions.ar as integer), cast(dimensions.manad as integer),
    observations.antal.value, observations.antal.rojd, observations.andel.value
from {{ source('fk', 'started_stress') }}
union all
select
    'ongoing', dimensions.lan_kod1, dimensions.aldersklass_kod, 'ALL', dimensions.kon_kod,
    cast(dimensions.ar as integer), cast(dimensions.manad as integer),
    observations.antal.value, observations.antal.rojd, null
from {{ source('fk', 'ongoing_by_age') }}
