-- One row per article of the current consolidated text: English and Swedish title and text
-- verbatim, chapter and section, how it changed since the Official Journal text, and the date
-- from which it applies under Article 113 (seeds/eu_ai_act/ai_act_application_rules.csv, each
-- rule carrying the sentence of Article 113 it rests on).
with current_version as (
    select celex from {{ ref('int_ai_act_documents') }} where is_current
),

en as (
    select p.*
    from {{ ref('int_ai_act_provisions') }} as p
    join current_version as v on p.version_celex = v.celex
    where p.language = 'en' and p.provision_kind = 'article'
),

sv as (
    select p.provision_id, p.title, p.chapter_title, p.section_title, p.text
    from {{ ref('int_ai_act_provisions') }} as p
    join current_version as v on p.version_celex = v.celex
    where p.language = 'sv' and p.provision_kind = 'article'
),

rules as (
    select * from {{ ref('ai_act_application_rules') }}
),

matched as (
    select
        en.provision_id,
        r.rule_id,
        r.applies_from,
        r.applies_from_second,
        r.partial,
        r.source_quote,
        r.note_en,
        r.note_sv,
        row_number() over (partition by en.provision_id order by r.priority desc) as rank
    from en
    join rules as r
        on r.scope = 'all'
        or (r.scope = 'chapter' and r.chapter = en.chapter)
        or (r.scope = 'section' and r.chapter = en.chapter and cast(r.section as varchar) = en.section)
        or (r.scope = 'article'
            and en.number = cast(try_cast(regexp_extract(en.number, '^\d+') as integer) as varchar)
            and try_cast(en.number as integer) between r.article_from and r.article_to)
)

select
    en.provision_id as article_id,
    en.number as article_number,
    try_cast(regexp_extract(en.number, '^\d+') as integer) as article_sort,
    en.position,
    en.title as title_en,
    sv.title as title_sv,
    en.chapter,
    en.chapter_title as chapter_title_en,
    sv.chapter_title as chapter_title_sv,
    en.section,
    en.section_title as section_title_en,
    sv.section_title as section_title_sv,
    en.text as text_en,
    sv.text as text_sv,
    en.char_count,
    coalesce(c.change_type, 'unchanged') as change_type,
    coalesce(c.amended_by, '[]') as amended_by,
    m.rule_id as application_rule_id,
    m.applies_from,
    m.applies_from_second,
    m.partial as applies_partially,
    m.source_quote as application_quote,
    m.note_en as application_note_en,
    m.note_sv as application_note_sv,
    en.article_refs,
    en.annex_refs,
    en.version_celex,
    en.source_hash,
    en.retrieved_at,
    'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:' || en.version_celex
        || '#' || en.provision_id as source_url,
    'source' as content_type
from en
left join sv on sv.provision_id = en.provision_id
left join {{ ref('int_ai_act_provision_changes') }} as c on c.provision_id = en.provision_id
left join matched as m on m.provision_id = en.provision_id and m.rank = 1
