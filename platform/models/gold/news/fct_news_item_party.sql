-- The parties a news item names, by the way newsrooms write them: "(S)", "S-ledaren",
-- "SD:s", "Vänsterpartiet" (seeds/news/news_party_terms.csv, case-sensitive).
select distinct n.item_id, t.party
from {{ ref('stg_news_items') }} as n
join {{ ref('news_party_terms') }} as t
    on regexp_matches(n.text, t.pattern)
