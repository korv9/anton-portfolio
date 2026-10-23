-- One row per foundation (MFRC test split) as ml/moral/ wrote it.
select * from {{ source('philosophy_moral', 'agreement') }}
