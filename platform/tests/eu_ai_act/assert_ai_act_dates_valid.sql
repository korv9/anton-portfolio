-- Application dates and milestones lie between the Act's entry into force and the last
-- deadline it sets, and a second application date never precedes the first.
select 'article:' || article_id as row_id, applies_from as date
from {{ ref('dim_ai_act_article') }}
where applies_from not between date '2024-08-01' and date '2030-12-31'
   or applies_from_second < applies_from
union all
select 'milestone:' || milestone_id, date
from {{ ref('mart_ai_act_timeline') }}
where date not between date '2024-07-12' and date '2030-12-31'
