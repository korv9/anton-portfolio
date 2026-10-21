-- Session × year × party: speeches, future-oriented speeches, words and marker matches.
select * from {{ source('futures', 'totals') }}
