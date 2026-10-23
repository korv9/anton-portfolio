-- One row per validated foundation as ml/moral/ wrote it.
select * from {{ source('philosophy_moral', 'spread') }}
