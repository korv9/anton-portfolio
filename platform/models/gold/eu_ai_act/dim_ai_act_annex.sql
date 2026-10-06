-- One row per annex of the current consolidated text, English and Swedish, verbatim.
with current_version as (
    select celex from {{ ref('int_ai_act_documents') }} where is_current
)

select
    en.provision_id as annex_id,
    en.number as annex_number,
    en.position,
    en.title as title_en,
    sv.title as title_sv,
    en.text as text_en,
    sv.text as text_sv,
    coalesce(c.change_type, 'unchanged') as change_type,
    en.version_celex,
    'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:' || en.version_celex
        || '#' || en.provision_id as source_url,
    'source' as content_type
from {{ ref('int_ai_act_provisions') }} as en
join current_version as v on en.version_celex = v.celex
left join {{ ref('int_ai_act_provisions') }} as sv
    on sv.version_celex = en.version_celex and sv.language = 'sv' and sv.provision_id = en.provision_id
left join {{ ref('int_ai_act_provision_changes') }} as c on c.provision_id = en.provision_id
where en.language = 'en' and en.provision_kind = 'annex'
