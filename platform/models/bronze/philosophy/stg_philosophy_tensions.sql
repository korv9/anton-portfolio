-- Passage × tension: similarity to each pole and the position between them.
select * from {{ source('philosophy_features', 'tensions') }}
