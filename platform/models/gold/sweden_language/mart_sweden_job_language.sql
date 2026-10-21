-- The Ideal Human: year × occupation field × county × category. Only the per-category counts;
-- the ads, distinct texts and words of a cell are in mart_sweden_job_language_totals, once per
-- cell. Every category gets a row for every cell, zero when unused. Fields go through the same
-- crosswalk as the totals.
with hits as (
    select try_cast(year as integer) as year, coalesce(x.field, h.field, 'Unknown') as field,
           coalesce(region, 'Unknown') as region, category,
           sum(texts) as texts_matching, sum(matches) as matches
    from {{ ref('stg_ad_language_hits') }} h
    left join {{ ref('occupation_field_crosswalk') }} x on x.label = h.field
    group by all
)

select
    t.year, t.field, t.region, c.term_id as category, c.family,
    coalesce(h.texts_matching, 0) as texts_matching,
    coalesce(h.matches, 0) as matches
from {{ ref('mart_sweden_job_language_totals') }} t
cross join {{ ref('ad_language_terms') }} c
left join hits h
    on h.year = t.year and h.field = t.field and h.region = t.region and h.category = c.term_id
