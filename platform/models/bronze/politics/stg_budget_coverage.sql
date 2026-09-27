-- The budget comparison document per session: the one parsed, else the first candidate
-- that was tried and failed, which is still the session's FiU1 report.
with documents as (
    select unnest(documents) as d from {{ source('politics_delivery', 'budget_coverage') }}
), errors as (
    select unnest(errors) as e from {{ source('politics_delivery', 'budget_coverage') }}
)
select d.session, d.document_id, true as comparison_table_found from documents
union all
select e.session, e.candidates[1].document_id, false from errors
where e.session not in (select d.session from documents)
