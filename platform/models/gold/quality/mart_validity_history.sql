-- Validity diagnostics across recorded runs (for the Symbolic Atlas: before and after paratext
-- cleaning), so a change in a confounder's effect can be followed.
-- Cast, because an empty run writes untyped columns.
select
    cast(analysis_id as varchar) as analysis_id,
    cast(product_id as varchar) as product_id,
    cast(run_label as varchar) as run_label,
    cast(experiment as varchar) as experiment,
    cast(metric as varchar) as metric,
    cast(value as double) as value
from {{ ref('stg_quality_validity_history') }}
