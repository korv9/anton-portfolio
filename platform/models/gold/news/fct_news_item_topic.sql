-- The topics a news item is about: forming a government, or one of the site's policy issues
-- (seeds/news/news_topics.csv, matched on lower case).
select distinct n.item_id, t.topic
from {{ ref('stg_news_items') }} as n
join {{ ref('news_topics') }} as t
    on regexp_matches(lower(n.text), t.pattern)
