-- Registered confounders per analysis (platform/quality/evaluate.py).
select * from {{ source('quality_features', 'confounders') }}
