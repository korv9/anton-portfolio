-- Cluster × map variant: composition and review status from the ML stage.
select * from {{ source('philosophy_features', 'clusters') }}
