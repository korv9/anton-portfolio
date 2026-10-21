-- The chunks the concept layer sampled, with provenance.
select * from {{ source('concept_features', 'chunks') }}
