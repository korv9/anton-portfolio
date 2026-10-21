-- One row per corpus, method, session, party and expenditure area: lexical attention to the
-- area as a share of the party's area-assigned matches. Topic attention, not support.
select
    corpus, method, session, party, expenditure_area, occurrences, keyword_share_pct, forms,
    make_date(cast(left(session, 4) as integer), 1, 1) as session_year_start, file_order
from {{ ref('stg_budget_language_area') }}
