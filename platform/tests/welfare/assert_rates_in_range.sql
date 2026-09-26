-- Percentages must be percentages, and a confidence interval must contain its estimate.
select 'labour_force' as fact, rate_pct as value from {{ ref('fct_labour_force') }}
where rate_pct not between 0 and 100
union all
select 'health_survey', share_pct from {{ ref('fct_health_survey') }}
where share_pct not between 0 and 100 or share_pct not between ci_low_pct and ci_high_pct
union all
select 'social_survey', mean_value from {{ ref('fct_social_survey_country') }}
where share_high_pct not between 0 and 100 or mean_value not between ci_low and ci_high
