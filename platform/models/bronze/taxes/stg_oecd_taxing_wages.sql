-- OECD Taxing Wages: labour taxation per country, year, household type and wage level.
select
    REF_AREA as country_code,
    cast(TIME_PERIOD as integer) as year,
    MEASURE as measure,
    UNIT_MEASURE as unit,
    HOUSEHOLD_TYPE as household_type,
    INCOME_PRINCIPAL as wage_level,
    INCOME_SPOUSE as spouse_wage_level,
    try_cast(OBS_VALUE as double) as value
from read_csv('{{ env_var('PORTFOLIO_RAW', '../warehouse/raw') }}/oecd/taxing_wages.csv.gz',
              all_varchar = true)
where OBS_VALUE is not null and OBS_VALUE <> ''
