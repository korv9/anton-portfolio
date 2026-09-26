{#
  Weighted ESS aggregates grouped by `keys` and round, for every item in ess_variables.
  With breakdowns, adds rows by sex and by age group next to the total (T, 15+).
  mean: sum(w x) / sum(w). Standard error: weighted SD / sqrt(Kish effective n), which
  ignores clustering and stratification. share_high_pct: share at or beyond the item's
  threshold in ess_variables (for example 7-10 on a 0-10 scale).
#}
{% macro welfare_ess_aggregate(keys, answers, where='true', breakdowns=true) %}
{%- set key_list = keys | join(', ') -%}
with answers as (
    select a.*, v.share_threshold, v.share_direction
    from {{ answers }} as a
    join {{ ref('ess_variables') }} as v using (variable)
    where {{ where }}
), groups as (
    select {{ key_list }}, period_key, variable, survey_mode, 'T' as sex_key, '15+' as age_group_key,
           weight, answer, share_threshold, share_direction
    from answers
    {% if breakdowns %}
    union all
    select {{ key_list }}, period_key, variable, survey_mode, sex_key, '15+', weight, answer, share_threshold, share_direction
    from answers where sex_key is not null
    union all
    select {{ key_list }}, period_key, variable, survey_mode, 'T', age_group_key, weight, answer, share_threshold, share_direction
    from answers where age_group_key is not null
    {% endif %}
), stats as (
    select
        'ess_' || variable as indicator_key,
        {{ key_list }},
        period_key,
        sex_key,
        age_group_key,
        -- One mode per country and round; ESS10 moved some countries to self-completion.
        any_value(survey_mode) as survey_mode,
        count(*) as respondents,
        sum(weight) as weight_sum,
        power(sum(weight), 2) / sum(weight * weight) as effective_n,
        sum(weight * answer) / sum(weight) as mean_value,
        sum(weight * answer * answer) / sum(weight) as mean_square,
        100 * sum(weight) filter (where
            (share_direction = 'ge' and answer >= share_threshold)
            or (share_direction = 'le' and answer <= share_threshold)) / sum(weight) as share_high_pct
    from groups
    group by all
)
select
    indicator_key,
    {{ key_list }}{% if keys == ['nuts2_code'] %} as region_code{% endif %},
    period_key,
    {% if breakdowns %}sex_key, age_group_key,{% endif %}
    survey_mode,
    respondents,
    round(effective_n, 1) as effective_n,
    mean_value,
    mean_value - 1.96 * sqrt(greatest(mean_square - mean_value * mean_value, 0) / effective_n) as ci_low,
    mean_value + 1.96 * sqrt(greatest(mean_square - mean_value * mean_value, 0) / effective_n) as ci_high,
    share_high_pct
from stats
{% endmacro %}
