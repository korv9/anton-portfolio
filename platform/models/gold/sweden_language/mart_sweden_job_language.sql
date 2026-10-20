-- The Ideal Human: year × occupation field × county × category. Rates are over distinct ad
-- texts (an ad posted for many workplaces counts once) and per thousand words of those texts.
with totals as (
    select try_cast(year as integer) as year, coalesce(field, 'Unknown') as field,
           coalesce(region, 'Unknown') as region,
           sum(ads) as ads, sum(distinct_texts) as texts, sum(words) as words
    from {{ source('ad_language', 'totals') }}
    group by all
),

hits as (
    select try_cast(year as integer) as year, coalesce(field, 'Unknown') as field,
           coalesce(region, 'Unknown') as region, category,
           sum(texts) as texts_matching, sum(matches) as matches
    from {{ source('ad_language', 'hits') }}
    group by all
)

select
    t.year, t.field, t.region, c.term_id as category, c.family,
    t.ads, t.texts, t.words,
    coalesce(h.texts_matching, 0) as texts_matching,
    coalesce(h.matches, 0) as matches
from totals t
cross join {{ ref('ad_language_terms') }} c
left join hits h
    on h.year = t.year and h.field = t.field and h.region = t.region and h.category = c.term_id
where t.year is not null
