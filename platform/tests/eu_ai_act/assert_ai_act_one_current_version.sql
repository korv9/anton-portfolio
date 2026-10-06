-- Exactly one version of the regulation is current, and version windows do not overlap.
with versions as (
    select * from {{ ref('dim_ai_act_document') }} where document_type = 'consolidated_version'
)

select 'current versions' as problem, count(*) as n
from versions where is_current
having count(*) <> 1
union all
select 'overlap', count(*)
from versions as a
join versions as b
    on a.document_id < b.document_id
   and a.valid_from <= coalesce(b.valid_to, date '9999-12-31')
   and b.valid_from <= coalesce(a.valid_to, date '9999-12-31')
having count(*) > 0
