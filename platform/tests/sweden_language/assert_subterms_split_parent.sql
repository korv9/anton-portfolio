-- Each match of a parent category goes to exactly one sub-term, so per cell the sub-terms'
-- matches add up to the parent's, and no sub-term is used by more texts than the parent while
-- together they cover every text that uses it.
with sub as (
    select year, field, band, parent, sum(matches) as matches, sum(texts_matching) as texts,
           max(texts_matching) as widest
    from {{ ref('mart_sweden_job_language_bands') }}
    where category <> parent
    group by all
)

select s.*, p.matches as parent_matches, p.texts_matching as parent_texts
from sub s
join {{ ref('mart_sweden_job_language_bands') }} p
    on p.year = s.year and p.field = s.field and p.band = s.band and p.category = s.parent
where s.matches <> p.matches or s.widest > p.texts_matching or s.texts < p.texts_matching
