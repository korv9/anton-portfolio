-- Session × year × party × theme: speeches using the theme, of them future-oriented, and matches.
select * from {{ source('futures', 'hits') }}
