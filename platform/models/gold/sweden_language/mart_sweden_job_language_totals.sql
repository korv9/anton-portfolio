-- The Ideal Human: year × occupation field × county over all job ads. `texts` counts distinct
-- ad texts (an ad posted for many workplaces counts once) and `words` the words of those texts.
-- The 2020–2023 and 2026-Q1 archives also use eight field labels outside the taxonomy
-- ("Pedagogiskt arbete" beside "Pedagogik"); the crosswalk seed folds them into the 21 fields.
-- Per-category counts are in mart_sweden_job_language.
select try_cast(year as integer) as year, coalesce(x.field, t.field, 'Unknown') as field,
       coalesce(region, 'Unknown') as region,
       sum(ads) as ads, sum(distinct_texts) as texts, sum(words) as words
from {{ ref('stg_ad_language_totals') }} t
left join {{ ref('occupation_field_crosswalk') }} x on x.label = t.field
where try_cast(year as integer) is not null
group by all
