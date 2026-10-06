-- What changed, newest first: documents that amended, corrected or consolidated the Act or
-- propose to, Commission guidance as published, and article by article what the amending act
-- changed. Every row names its document and links to the official source.
--
-- Article rows come from comparing the Official Journal text with the current consolidated text
-- (int_ai_act_provision_changes); `affected_actors` are the actors the amended article's text
-- puts under a "shall" (derived, bridge_ai_act_article_actor).
with docs as (
    select * from {{ ref('dim_ai_act_document') }}
),

document_events as (
    select
        'doc:' || celex as change_id,
        published_at as change_date,
        case document_type
            when 'amending_regulation' then 'amendment'
            when 'corrigendum' then 'corrigendum'
            when 'consolidated_version' then 'consolidated_version'
            when 'legislative_proposal' then 'proposal'
            when 'original_proposal' then 'proposal'
            when 'regulation_based_on' then 'implementing_act'
            when 'decision_based_on' then 'implementing_act'
            when 'commission_document' then 'commission_report'
        end as change_kind,
        celex as document_id,
        title as document_title,
        null as article_number,
        null as provision_id,
        null as provision_title,
        null as change_type,
        null as affected_actors,
        source_url,
        'Cellar' as basis
    from docs
    where document_type in ('amending_regulation', 'corrigendum', 'consolidated_version',
                            'legislative_proposal', 'original_proposal', 'regulation_based_on', 'decision_based_on',
                            'commission_document')
),

guidance_events as (
    select
        'guidance:' || guidance_id,
        published_at,
        'guidance',
        guidance_id,
        title,
        null, null, null, null, null,
        source_url,
        'Commission page'
    from {{ ref('dim_ai_act_guidance') }}
    where published_at is not null
),

actors as (
    select article_number, string_agg(actor_id, ';' order by actor_id) as actors
    from {{ ref('bridge_ai_act_article_actor') }}
    where duty_sentences > 0
    group by article_number
),

provision_events as (
    select
        'provision:' || c.provision_id || ':' || coalesce(json_extract_string(c.amended_by, '$[0]'), 'unmarked'),
        coalesce(d.published_at, (select published_at from docs where is_current)),
        'provision',
        coalesce(json_extract_string(c.amended_by, '$[0]'), (select celex from docs where is_current)),
        coalesce(d.title, 'Consolidated text'),
        case when c.provision_kind = 'article' then c.number end,
        c.provision_id,
        c.title,
        c.change_type,
        a.actors,
        'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:' || c.to_version || '#' || c.provision_id,
        'comparison of the Official Journal text with the consolidated text'
    from {{ ref('int_ai_act_provision_changes') }} as c
    left join docs as d on d.celex = json_extract_string(c.amended_by, '$[0]')
    left join actors as a on a.article_number = c.number and c.provision_kind = 'article'
    where c.change_type <> 'unchanged'
)

select * from document_events
union all select * from guidance_events
union all select * from provision_events
