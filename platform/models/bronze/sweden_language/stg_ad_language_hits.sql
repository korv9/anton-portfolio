-- Archive × year × field × county × category: texts matching and matches.
select * from {{ source('ad_language', 'hits') }}
