-- One row per topic model, session, party and topic: the topic's share of the party's words.
-- Shares include the unclustered topic (-1); the two models are not comparable.
select
    model_id, session, session_year, party, topic_id, topic_label, segments, words,
    word_share_pct, make_date(cast(session_year as integer), 1, 1) as session_year_start,
    file_order
from {{ ref('stg_topic_session_party') }}
