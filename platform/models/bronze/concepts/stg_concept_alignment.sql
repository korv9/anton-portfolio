-- Chunk × concept similarity, rank and z-score.
select * from {{ source('concept_features', 'alignment') }}
