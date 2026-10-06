-- Every curated row that rests on a sentence of the Act (obligations, milestones, application
-- rules, risk classes) must find that sentence, verbatim, in the current English text of the
-- article it cites. White space and quote styles are folded; nothing else. A row returned here
-- means a quote was mistyped or the law changed under it.
with articles as (
    select
        article_number,
        regexp_replace(replace(replace(text_en, '‘', ''''), '’', ''''), '\s+', ' ', 'g') as text
    from {{ ref('dim_ai_act_article') }}
),

quotes as (
    select 'obligation:' || obligation_id as row_id, cast(article as varchar) as article, source_quote
    from {{ ref('ai_act_obligations') }}
    union all
    select 'milestone:' || milestone_id, cast(source_article as varchar), source_quote
    from {{ ref('ai_act_milestones') }}
    union all
    select 'rule:' || rule_id, cast(source_article as varchar), source_quote
    from {{ ref('ai_act_application_rules') }}
    union all
    select 'risk_class:' || risk_class_id, cast(source_article as varchar), source_quote
    from {{ ref('ai_act_risk_classes') }}
)

select q.row_id, q.article, q.source_quote
from quotes as q
left join articles as a on a.article_number = q.article
where a.article_number is null
   or strpos(a.text, regexp_replace(replace(replace(q.source_quote, '‘', ''''), '’', ''''), '\s+', ' ', 'g')) = 0
