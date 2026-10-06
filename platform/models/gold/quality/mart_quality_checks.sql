-- One row per data-quality check result (ISO/IEC 25012-inspired dimensions). Status is pass,
-- warning, fail, not_measured or not_applicable; severity is separate. A check that measured
-- nothing is not_measured, never pass. Values are derived; the definitions are in
-- platform/quality/quality_registry.yml.
select
    quality_check_id,
    product_id,
    project_id,
    dataset_id,
    dimension,
    dimension_label,
    description,
    measure_name,
    numerator_definition,
    denominator_definition,
    comparator,
    threshold,
    warn_at,
    value,
    numerator,
    denominator,
    sample_size,
    reviewed_at,
    status,
    severity,
    method,
    source,
    gate,
    details,
    evaluated_at::timestamptz as evaluated_at,
    'derived' as content_type
from {{ source('quality_features', 'checks') }}
