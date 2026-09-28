-- News items with the parties and topics they concern. An item is political when it comes
-- from the Government, names a party, is about forming a government, or uses the words of
-- national politics; the site shows only those.
with parties as (
    select item_id, list(party order by party) as parties
    from {{ ref('fct_news_item_party') }} group by item_id
), topics as (
    select item_id, list(topic order by topic) as topics
    from {{ ref('fct_news_item_topic') }} group by item_id
)
select
    n.item_id,
    n.source,
    n.title,
    n.summary,
    n.url,
    coalesce(n.published_at, n.first_seen) as published_at,
    n.first_seen,
    coalesce(p.parties, []) as parties,
    coalesce(t.topics, []) as topics,
    (n.source = 'regeringen'
     or p.parties is not null
     or list_contains(coalesce(t.topics, []), 'regeringsbildning')
     or regexp_matches(lower(n.text),
        'regering|riksdag|minister|partiledare|opposition|proposition|utredning|budgetförhandling')
    ) as is_political
from {{ ref('stg_news_items') }} as n
left join parties as p using (item_id)
left join topics as t using (item_id)
