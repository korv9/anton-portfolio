-- Article → article cross-references in the current English text, found by pattern
-- ("Article 16", "Articles 8 to 15"); references to other acts are left out.
with refs as (
    select
        a.article_number as from_article,
        unnest(cast(json(a.article_refs) as varchar[])) as to_article
    from {{ ref('dim_ai_act_article') }} as a
)

select distinct
    refs.from_article,
    refs.to_article,
    'pattern' as method,
    'derived' as content_type
from refs
join {{ ref('dim_ai_act_article') }} as target on target.article_number = refs.to_article
