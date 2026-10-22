-- Year × category (terms and sub-terms), nationally, in three measures with the occupation mix
-- fixed at its pooled share as in mart_sweden_job_language_trends: the share of texts using the
-- category, matches per thousand words, and the share of texts within each 2010 length band,
-- combined with the band weights of 2010. Longer ads raise the first, and a requirement stated
-- once per ad lowers the second as ads grow; the third holds length at its 2010 distribution.
-- A change is read as stable only when all three agree in sign. The same rules as the trends
-- mart apply: a field-year (or field-year-band) cell needs 30 distinct texts, and a year where
-- fewer than half the texts have a field gets no standardised value.
with cells as (
    select * from {{ ref('mart_sweden_job_language_bands') }}
),

field_year as (
    select year, field, category, any_value(parent) as parent,
           sum(texts) as texts, sum(words) as words,
           sum(texts_matching) as texts_matching, sum(matches) as matches
    from cells
    group by all
),

weights as (
    select field, sum(texts) / sum(sum(texts)) over () as weight
    from field_year
    where category = 'competence' and field <> 'Unknown'
    group by field
),

band_weights as (
    select band, sum(texts) / sum(sum(texts)) over () as weight
    from cells
    where year = 2010 and category = 'competence'
    group by band
),

standardised as (
    select f.year, f.category,
           sum(f.texts) as known_texts,
           sum(w.weight * f.texts_matching / f.texts) filter (where f.texts >= 30)
               / nullif(sum(w.weight) filter (where f.texts >= 30), 0) as share,
           sum(w.weight * f.matches * 1000.0 / f.words) filter (where f.texts >= 30 and f.words > 0)
               / nullif(sum(w.weight) filter (where f.texts >= 30 and f.words > 0), 0) as per_1000_words
    from field_year f
    join weights w using (field)
    group by all
),

banded as (
    select c.year, c.category,
           sum(w.weight * b.weight * c.texts_matching / c.texts) filter (where c.texts >= 30)
               / nullif(sum(w.weight * b.weight) filter (where c.texts >= 30), 0) as share
    from cells c
    join weights w using (field)
    join band_weights b using (band)
    group by all
),

national as (
    select year, category, any_value(parent) as parent,
           sum(texts) as texts, sum(words) as words,
           sum(texts_matching) as texts_matching, sum(matches) as matches
    from field_year
    group by all
)

select
    n.year, n.category, n.parent, n.texts, n.words, n.texts_matching, n.matches,
    n.texts_matching / nullif(n.texts, 0) as share,
    n.matches * 1000.0 / nullif(n.words, 0) as per_1000_words,
    case when s.known_texts >= 0.5 * n.texts then s.share end as share_standardised,
    case when s.known_texts >= 0.5 * n.texts then s.per_1000_words end as per_1000_words_standardised,
    case when s.known_texts >= 0.5 * n.texts then b.share end as share_banded_standardised
from national n
left join standardised s using (year, category)
left join banded b using (year, category)
