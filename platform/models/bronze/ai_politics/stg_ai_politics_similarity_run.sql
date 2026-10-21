-- The similarity run: model, Act version and the random-pair baseline (one row).
select * from {{ source('ai_politics_features', 'run') }}
