-- Article × actor: mentions of the actor's term and sentences where it is followed by "shall".
-- Derived by pattern (int_ai_act_article_actors), a navigation signal, not a legal reading.
select
    article_number,
    actor_id,
    mentions,
    duty_sentences,
    method,
    version_celex,
    'derived' as content_type
from {{ ref('int_ai_act_article_actors') }}
