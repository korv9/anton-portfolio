-- Documents matching each term per corpus, term list, language and month, summed over the counted
-- sources. A key term:lang is the pre-registered (primary) list, term:lang:amended the amended one.
select
    case when filename like '%speeches_terms.parquet' then 'riksdag' else 'job_ads' end as corpus,
    cast(month || '-01' as date) as month,
    split_part(term_key, ':', 1) as term_id,
    split_part(term_key, ':', 2) as language,
    coalesce(nullif(split_part(term_key, ':', 3), ''), 'primary') as term_list,
    sum(documents) as matches
from {{ source('ai_act_diffusion', 'terms') }}
group by all
