-- Passage × map variant: map position and cluster from the ML stage.
select * from {{ source('philosophy_features', 'atlas') }}
