-- fct_social_survey_country keeps one survey mode per country and round. If a country
-- ever appears in both an interview and a self-completion file, it must not be pooled.
select country_code, period_key, count(distinct survey_mode) as modes
from {{ ref('int_welfare_ess_answers') }}
group by all
having count(distinct survey_mode) > 1
