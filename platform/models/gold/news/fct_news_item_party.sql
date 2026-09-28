-- The parties a news item names: by the way newsrooms write them, "(S)", "S-ledaren",
-- "SD:s", "Vänsterpartiet", "Tidöpartierna" (seeds/news/news_party_terms.csv, case-sensitive),
-- or by the full name of a politician in office now, for the news that names a minister
-- without the party ("Ebba Busch", "socialminister Jakob Forssmed"). `via` says which.
with by_term as (
    select distinct n.item_id, t.party, 'term' as via
    from {{ ref('stg_news_items') }} as n
    join {{ ref('news_party_terms') }} as t
        on regexp_matches(n.text, t.pattern)
), by_name as (
    select distinct n.item_id, p.party, 'name' as via
    from {{ ref('stg_news_items') }} as n
    join {{ ref('stg_news_people') }} as p
        on contains(n.text, p.name)
       and regexp_matches(n.text, '\b' || regexp_escape(p.name) || '(s|:s)?\b')
)
select item_id, party, min(via) as via
from (select * from by_term union all select * from by_name)
group by item_id, party
