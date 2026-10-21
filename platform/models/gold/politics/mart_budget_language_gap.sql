-- One row per corpus, method, session, party and area where the party's budget proposal
-- covers all 27 expenditure areas: its budget share beside its lexical attention. The
-- difference in percentage points is formed at delivery (publish/export_politics.py) so it
-- rounds as the legacy build did. Descriptive only; no stance or causal inference.
with complete_frames as (
    select session, actor
    from {{ ref('fct_budget_frame') }}
    where actor <> 'GOV'
    group by session, actor
    having count(distinct expenditure_area) = 27
       and min(expenditure_area) = 1 and max(expenditure_area) = 27
)
select
    l.corpus, l.method, l.session, l.party, l.expenditure_area,
    f.budget_year, f.amount_msek, f.budget_share_pct,
    l.occurrences as keyword_occurrences, l.keyword_share_pct,
    l.keyword_share_pct - f.budget_share_pct as attention_minus_budget,
    f.source_url,
    make_date(cast(f.budget_year as integer), 1, 1) as budget_year_start,
    l.file_order
from {{ ref('fct_language_area') }} as l
join complete_frames as c on c.session = l.session and c.actor = l.party
join {{ ref('fct_budget_frame') }} as f
    on f.session = l.session and f.actor = l.party and f.expenditure_area = l.expenditure_area
