-- One row per actor × obligation × article: who must do what, where it is written and from when.
--
-- Three kinds of content, kept apart:
--   source_quote      the sentence of the Act the obligation rests on, verbatim (a test checks
--                     it appears in the current text of the article);
--   actor, risk class and requirement type: our classification of that sentence (curated);
--   summary_en/sv     a short explanation written for this site, not legal text.
-- applies_from comes from the article's Article 113 rule (dim_ai_act_article).
select
    o.obligation_id,
    o.actor_id,
    ac.official_term as actor_official_term,
    ac.label_en as actor_label_en,
    ac.label_sv as actor_label_sv,
    o.requirement_type,
    o.risk_class_id,
    rc.label_en as risk_class_en,
    rc.label_sv as risk_class_sv,
    o.article as article_number,
    nullif(cast(o.paragraph as varchar), '') as paragraph,
    ar.title_en as article_title_en,
    ar.title_sv as article_title_sv,
    ar.chapter,
    ar.section,
    o.source_quote,
    o.summary_en,
    o.summary_sv,
    ar.applies_from,
    ar.applies_from_second,
    ar.applies_partially,
    ar.application_quote,
    ar.change_type as article_change_type,
    ar.source_url,
    'source' as quote_type,
    'interpretation' as classification_type,
    'interpretation' as summary_type
from {{ ref('ai_act_obligations') }} as o
join {{ ref('dim_ai_act_actor') }} as ac on ac.actor_id = o.actor_id
join {{ ref('dim_ai_act_risk_class') }} as rc on rc.risk_class_id = o.risk_class_id
join {{ ref('dim_ai_act_article') }} as ar on ar.article_number = cast(o.article as varchar)
