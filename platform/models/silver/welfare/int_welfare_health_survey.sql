-- Nationella folkhälsoenkäten conformed. County results cover ages 16-84 and are pooled
-- over four survey years; age-group results are national and annual. The statistic
-- variable is pivoted into share, interval bounds and number of responses.
with cells as (
    select
        'fohm_' || regexp_extract(source_table, '^hlv1(psy|allm|soc)', 1) || '_' || measure_code
            as indicator_key,
        coalesce(region_code, '00') as region_code,
        period_code as period_key,
        {{ welfare_sex_key('sex_code') }} as sex_key,
        case when breakdown = 'region' then '16-84'
             else case age_code
                when '29' then '16+' when '30' then '16-84' when '31' then '16-29'
                when '32' then '30-44' when '33' then '45-64' when '34' then '65-84'
                when '35' then '85+' end
        end as age_group_key,
        statistic_code,
        value
    from {{ ref('stg_fohm_health') }}
)
select
    indicator_key, region_code, period_key, sex_key, age_group_key,
    max(value) filter (where statistic_code = '01') as share_pct,
    max(value) filter (where statistic_code = '02') as ci_low_pct,
    max(value) filter (where statistic_code = '03') as ci_high_pct,
    max(value) filter (where statistic_code = '04') as responses
from cells
group by all
