-- AKU conformed to the shared keys. One row per region, period, sex, age group, series
-- type and labour-force status, with the level in thousands and the matching rate:
--   employed      -> employment rate (share of the population)
--   unemployed    -> unemployment rate (share of the labour force)
--   labour_force  -> participation rate (share of the population)
-- County figures are annual and quarterly, unadjusted, ages 15-74. National figures are
-- monthly with sex and age breakdowns, in three series types.
with county as (
    select
        region_code,
        case when period_code like '%K%'
             then left(period_code, 4) || '-Q' || right(period_code, 1)
             else period_code end as period_key,
        {{ welfare_sex_key('sex_code') }} as sex_key,
        '15-74' as age_group_key,
        'unadjusted' as series_type,
        case labour_status_code
            when 'TOTALT' then 'population'
            when 'SYS' then 'employed'
            when 'ALÖS' then 'unemployed'
            when 'EIAKR' then 'not_in_labour_force'
        end as labour_status,
        persons_thousands,
        persons_thousands_moe,
        rate_pct,
        rate_pct_moe
    from {{ ref('stg_scb_aku_region') }}
), national_cells as (
    select
        '00' as region_code,
        left(period_code, 4) || '-' || right(period_code, 2) as period_key,
        {{ welfare_sex_key('sex_code') }} as sex_key,
        -- Totals are coded 'tot15-74'; the band itself is what the key needs.
        replace(age_code, 'tot', '') as age_group_key,
        case series_type_code
            when 'O_DATA' then 'unadjusted'
            when 'SR_DATA' then 'seasonally_adjusted'
            when 'TC_DATA' then 'trend'
        end as series_type,
        case rtrim(labour_measure_code, 'P')
            when 'TOTB' then 'population'
            when 'SYS' then 'employed'
            when 'ALÖS' then 'unemployed'
            when 'IAKR' then 'labour_force'
            when 'EIAKR' then 'not_in_labour_force'
        end as labour_status,
        labour_measure_code like '%P' as is_rate,
        value
    from {{ ref('stg_scb_aku_month') }}
), national as (
    select
        region_code, period_key, sex_key, age_group_key, series_type, labour_status,
        max(value) filter (where not is_rate) as persons_thousands,
        null::double as persons_thousands_moe,
        max(value) filter (where is_rate) as rate_pct,
        null::double as rate_pct_moe
    from national_cells
    group by all
)
select * from county
union all
select * from national
