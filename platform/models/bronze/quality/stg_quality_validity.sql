-- One row per analytical validity diagnostic (platform/quality/evaluate.py).
select * from {{ source('quality_features', 'validity') }}
