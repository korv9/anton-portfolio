-- OECD Revenue Statistics: tax revenue of general government per revenue category, country
-- and year, as a share of GDP and in national currency (converted from the file's unit
-- multiplier to kronor, euros...).
select
    REF_AREA as country_code,
    STANDARD_REVENUE as tax_code,
    cast(TIME_PERIOD as integer) as year,
    UNIT_MEASURE as unit,
    case when UNIT_MEASURE = 'XDC' then CURRENCY end as currency,
    try_cast(OBS_VALUE as double) * power(10, coalesce(try_cast(UNIT_MULT as integer), 0)) as value
from read_csv('{{ env_var('PORTFOLIO_RAW', '../warehouse/raw') }}/oecd/revenue.csv.gz',
              all_varchar = true)
where OBS_VALUE is not null and OBS_VALUE <> ''
