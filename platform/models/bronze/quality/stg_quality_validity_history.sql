-- Validity diagnostics across recorded runs (platform/quality/evaluate.py).
select * from {{ source('quality_features', 'validity_history') }}
