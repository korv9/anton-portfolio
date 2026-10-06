-- One row per analytical validity diagnostic: question, target construct, proxy measure, the
-- diagnostic's result (derived, read from the pipelines' own artefacts), its status
-- (supported, warning, insufficient_evidence, invalidated, not_evaluated) and a person's
-- interpretation. Kept apart from data quality: correct data can support an invalid conclusion.
select
    analysis_id,
    product_id,
    kind,
    question_en,
    question_sv,
    target_construct,
    proxy_measure,
    diagnostic_id,
    diagnostic,
    experiment,
    result,
    details,
    rule,
    status,
    analysis_status,
    interpretation,
    conclusion_en,
    conclusion_sv,
    source,
    evaluated_at::timestamptz as evaluated_at,
    'derived' as result_content_type,
    'interpretation' as interpretation_content_type
from {{ source('quality_features', 'validity') }}
