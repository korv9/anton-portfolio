-- ICD-10 chapter codes and labels as FK publishes them.
with dimensions as (
    select unnest(filter.dimension) as dimension
    from {{ source('fk', 'started_by_diagnosis_meta') }}
)
select unnest(dimension."values").key as diagnosis_code,
       unnest(dimension."values").label as diagnosis_label
from dimensions
where dimension.key = 'diagnoskapitel_kod'
