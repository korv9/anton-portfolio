-- The products the quality registry covers (platform/quality/evaluate.py).
select * from {{ source('quality_features', 'products') }}
