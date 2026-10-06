-- The recitals of the Official Journal text (consolidated versions carry none), both languages.
select
    en.provision_id as recital_id,
    try_cast(en.number as integer) as recital_number,
    en.text as text_en,
    sv.text as text_sv,
    en.version_celex,
    'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:' || en.version_celex
        || '#' || en.provision_id as source_url,
    'source' as content_type
from {{ ref('int_ai_act_provisions') }} as en
left join {{ ref('int_ai_act_provisions') }} as sv
    on sv.version_celex = en.version_celex and sv.language = 'sv' and sv.provision_id = en.provision_id
where en.version_celex = '32024R1689' and en.language = 'en' and en.provision_kind = 'recital'
