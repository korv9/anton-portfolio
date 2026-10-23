-- One row per ETHICS subset and wording as ml/moral/ wrote it.
select * from {{ source('philosophy_moral', 'ethics') }}
