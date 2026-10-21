-- Year × category, nationally. `share` is the crude share of distinct ad texts that use the
-- category; `share_standardised` holds the occupation mix fixed at its pooled share of all
-- years (direct standardisation), so a change in which jobs are advertised does not read as a
-- change in language. `per_1000_words` is matches per thousand words, and
-- `per_1000_words_standardised` the same with the occupation mix fixed: ads grew several times
-- longer since 2006, so shares of ads rise with length alone and rates per word are the fairer
-- comparison over time. Texts without an occupation field take no part in the standardisation,
-- and a year where fewer than half the texts have one gets no standardised value (the 2006
-- archive records no occupation at all). A field-year with fewer than 30 distinct texts takes
-- no part either: a handful of texts would otherwise carry the field's full weight.
with field_year as (
    select year, field, category, family,
           sum(texts) as texts, sum(words) as words,
           sum(texts_matching) as texts_matching, sum(matches) as matches
    from {{ ref('mart_sweden_job_language') }}
    join {{ ref('mart_sweden_job_language_totals') }} using (year, field, region)
    group by all
),

weights as (
    select field, sum(texts) / sum(sum(texts)) over () as weight
    from field_year
    where category = 'competence' and field <> 'Unknown'
    group by field
),

standardised as (
    select f.year, f.category,
           sum(f.texts) / any_value(t.texts) as known_share,
           sum(w.weight * f.texts_matching / f.texts) filter (where f.texts >= 30)
               / nullif(sum(w.weight) filter (where f.texts >= 30), 0) as share,
           sum(w.weight * f.matches * 1000.0 / f.words) filter (where f.texts >= 30 and f.words > 0)
               / nullif(sum(w.weight) filter (where f.texts >= 30 and f.words > 0), 0) as per_1000_words
    from field_year f
    join weights w using (field)
    join (select year, category, sum(texts) as texts from field_year group by all) t
        using (year, category)
    group by f.year, f.category
)

select
    f.year, f.category, any_value(f.family) as family,
    sum(f.texts) as texts,
    sum(f.words) as words,
    sum(f.texts_matching) as texts_matching,
    sum(f.matches) as matches,
    sum(f.texts_matching) / nullif(sum(f.texts), 0) as share,
    sum(f.matches) * 1000.0 / nullif(sum(f.words), 0) as per_1000_words,
    any_value(case when s.known_share >= 0.5 then s.share end) as share_standardised,
    any_value(case when s.known_share >= 0.5 then s.per_1000_words end) as per_1000_words_standardised,
    coalesce(any_value(s.known_share), 0) as known_field_share
from field_year f
left join standardised s using (year, category)
group by f.year, f.category
