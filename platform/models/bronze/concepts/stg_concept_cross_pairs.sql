-- Per concept and corpus pair, the closest representative chunks and the baseline.
select * from {{ source('concept_features', 'cross_pairs') }}
