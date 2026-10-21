-- One row per data-quality check result (platform/quality/evaluate.py).
select * from {{ source('quality_features', 'checks') }}
