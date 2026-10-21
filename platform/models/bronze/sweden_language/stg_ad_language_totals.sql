-- Archive × year × field × county: ads, distinct texts and words.
select * from {{ source('ad_language', 'totals') }}
