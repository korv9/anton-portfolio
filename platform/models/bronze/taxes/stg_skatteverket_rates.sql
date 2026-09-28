-- Municipal tax rates per parish and year, as Skatteverket publishes them. Rates in per cent.
with rows as (
    select unnest(results) as r from {{ source('skatteverket', 'municipal_rates') }}
)
select distinct
    cast(r['år'] as integer) as year,
    trim(r['kommun']) as municipality_name,
    replace(trim(r['församlings-kod']), ' ', '') as parish_code,
    left(replace(trim(r['församlings-kod']), ' ', ''), 4) as municipality_code,
    trim(r['församling']) as parish_name,
    try_cast(r['kommunal-skatt'] as double) as municipal_rate,
    try_cast(r['landstings-skatt'] as double) as regional_rate,
    try_cast(r['begravnings-avgift'] as double) as burial_rate,
    try_cast(r['kyrkoavgift'] as double) as church_rate
from rows
