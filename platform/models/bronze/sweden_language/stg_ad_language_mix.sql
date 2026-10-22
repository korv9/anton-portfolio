-- Archive × year × SSYK-4 occupation group × employer type × category: texts, words, matches.
select * from {{ source('ad_language', 'mix') }}
