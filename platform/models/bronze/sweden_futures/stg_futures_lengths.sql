-- Session × year × words in the speech (capped): speeches and future-oriented speeches.
select * from {{ source('futures', 'lengths') }}
