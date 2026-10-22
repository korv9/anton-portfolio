-- The Ideal Human by ad length: year × occupation field × length band × category, nationally,
-- for the categories of ad_language_terms and their sub-terms (ad_language_subterms). The four
-- bands are cut at the 2010 quartiles of words per distinct text (BANDS in ad_language.py), so a
-- year can be compared with itself at the lengths ads had in 2010. Every category gets a row for
-- every cell, zero when unused. Feature files counted before the bands existed have no band and
-- are left out.
with totals as (
    select try_cast(year as integer) as year, coalesce(x.field, t.field, 'Unknown') as field, band,
           sum(distinct_texts) as texts, sum(words) as words
    from {{ ref('stg_ad_language_totals') }} t
    left join {{ ref('occupation_field_crosswalk') }} x on x.label = t.field
    where try_cast(year as integer) is not null and band is not null
    group by all
),

hits as (
    select try_cast(year as integer) as year, coalesce(x.field, h.field, 'Unknown') as field, band,
           category, sum(texts) as texts_matching, sum(matches) as matches
    from {{ ref('stg_ad_language_hits') }} h
    left join {{ ref('occupation_field_crosswalk') }} x on x.label = h.field
    where band is not null
    group by all
),

categories as (
    select term_id as category, term_id as parent from {{ ref('ad_language_terms') }}
    union all
    select term_id, parent from {{ ref('ad_language_subterms') }}
)

select
    t.year, t.field, t.band, c.category, c.parent, t.texts, t.words,
    coalesce(h.texts_matching, 0) as texts_matching,
    coalesce(h.matches, 0) as matches
from totals t
cross join categories c
left join hits h
    on h.year = t.year and h.field = t.field and h.band = t.band and h.category = c.category
