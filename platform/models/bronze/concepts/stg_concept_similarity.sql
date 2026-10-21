-- Concept × concept similarity of the anchor sentences (each pair once).
select * from {{ source('concept_features', 'concept_similarity') }}
