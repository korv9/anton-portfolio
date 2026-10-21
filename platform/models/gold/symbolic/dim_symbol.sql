-- One row per symbol in the dictionary with how often its words occur in the whole corpus
-- (int_symbol_occurrences, before the atlas sample).
select
    s.symbol_id,
    s.label,
    count(o.occurrence_id) as occurrence_count
from {{ ref('symbols') }} as s
left join {{ ref('int_symbol_occurrences') }} as o using (symbol_id)
group by s.symbol_id, s.label
