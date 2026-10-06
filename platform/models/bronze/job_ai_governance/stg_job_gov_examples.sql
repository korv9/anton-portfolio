-- Example ads per term (masked context windows), newest archive first.
select
    term_id,
    ad_id,
    publication_month,
    headline,
    occupation,
    field,
    matched,
    context,
    regexp_extract(replace(filename, '\', '/'), 'examples_(.+)\.parquet$', 1) as archive
from {{ source('jobtech_governance', 'examples') }}
