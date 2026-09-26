{{ config(materialized="table") }}
-- ESS answers, one row per respondent and item, restricted to each item's valid range
-- (refusals, don't know and no answer drop out here). `weight` is the post-stratification
-- weight, correct within one country; `pooled_weight` is the analysis weight, for estimates
-- over several countries (ESS weighting guide).
-- Swedish NUTS regions: NUTS3 in rounds 5-8, NUTS2 from round 9, both mapped to NUTS2.
-- Rounds 1-4 use a national code list (`regionse`) that is not mapped.
with respondents as (
    select
        'ESS' || essround as period_key,
        essround,
        datafile,
        case when datafile like 'ESS__SC%' then 'self_completion' else 'interview' end as survey_mode,
        country_code,
        respondent_id,
        post_stratification_weight as weight,
        -- For pooling countries: ESS's analysis weight, which rounds 2-3 lack; it is
        -- defined as pspwght x pweight, so rebuild it there.
        coalesce(analysis_weight, post_stratification_weight * population_weight) as pooled_weight,
        case gender_code when 1 then 'M' when 2 then 'K' end as sex_key,
        case when age between 15 and 29 then '15-29'
             when age between 30 and 44 then '30-44'
             when age between 45 and 64 then '45-64'
             when age between 65 and 120 then '65+' end as age_group_key,
        case when country_code = 'SE' and region_code like 'SE%' then left(region_code, 4) end as nuts2_code,
        * exclude (study, datafile, essround, country_code, respondent_id,
                   post_stratification_weight, design_weight, analysis_weight, population_weight,
                   gender_code, age, region_code, region_se_code)
    from {{ ref('stg_ess_respondents') }}
), answers as (
    unpivot respondents
    on columns(* exclude (period_key, essround, datafile, survey_mode, country_code,
                          respondent_id, weight, pooled_weight, sex_key, age_group_key, nuts2_code))
    into name variable value raw_value
)
select
    answers.* exclude (raw_value),
    try_cast(answers.raw_value as integer) as answer
from answers
join {{ ref('ess_variables') }} as items using (variable)
where try_cast(answers.raw_value as integer) between items.scale_min and items.scale_max
  and answers.weight > 0
