-- Year × term for the whole market and per occupation field: ads, mentions, share.
select
    year(month) as year,
    field_id,
    any_value(field) as field,
    term_id,
    sum(mention_count) as mention_count,
    sum(ads) as ads,
    sum(mention_count) / sum(ads) as share,
    count(*) as months
from {{ ref('mart_job_ai_governance_terms') }}
group by 1, 2, 4
