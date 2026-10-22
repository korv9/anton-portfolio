{{ config(tags=['ai_act_diffusion']) }}
-- Corpus × term × language × month: documents that use one of the AI Act's own terms, all
-- documents, the share and a three-month rolling share (sums over the window), for the AI Act
-- diffusion clock (docs/ai-act-diffusion-preregistration.md). The terms are the kept rows of
-- seeds/cross_domain/ai_act_terms.csv. Only whole months: a corpus's first and last month count
-- only when its documents reach the month's first or last day. Riksdag speeches and job ads are
-- never added together.
with coverage as (
    select
        corpus,
        case when day(min(first_date)) = 1 then date_trunc('month', min(first_date))
             else date_trunc('month', min(first_date)) + interval 1 month end as first_month,
        case when max(last_date) = last_day(max(last_date)) then date_trunc('month', max(last_date))
             else date_trunc('month', max(last_date)) - interval 1 month end as last_month
    from {{ ref('stg_ai_act_diffusion_sources') }}
    group by corpus
),

months as (
    select corpus, cast(unnest(generate_series(first_month, last_month, interval 1 month)) as date) as month
    from coverage
),

terms as (
    select term_id, 'sv' as language, term_sv as term from {{ ref('ai_act_terms') }} where decision = 'keep'
    union all
    select term_id, 'en', term_en from {{ ref('ai_act_terms') }} where decision = 'keep' and en_decision = 'keep'
),

grid as (
    select
        m.corpus,
        t.term_id,
        t.language,
        t.term,
        m.month,
        coalesce(h.matches, 0) as matches,
        coalesce(d.documents, 0) as documents
    from months as m
    cross join terms as t
    left join {{ ref('stg_ai_act_diffusion_months') }} as d on d.corpus = m.corpus and d.month = m.month
    left join {{ ref('stg_ai_act_diffusion_terms') }} as h
        on h.corpus = m.corpus and h.month = m.month and h.term_id = t.term_id and h.language = t.language
)

select
    corpus,
    term_id,
    language,
    term,
    month,
    matches,
    documents,
    matches / nullif(documents, 0) as share,
    sum(matches) over w / nullif(sum(documents) over w, 0) as share_rolling_3m,
    'derived' as content_type
from grid
window w as (partition by corpus, term_id, language order by month rows between 2 preceding and current row)
