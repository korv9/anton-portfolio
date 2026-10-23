-- One row per foundation, year and party as ml/moral/ wrote it.
select * from {{ source('philosophy_moral', 'shares') }}
