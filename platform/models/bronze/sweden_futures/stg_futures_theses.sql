-- DiVA thesis abstracts per harvested month × record × theme (theme '_all' carries the words).
select * from {{ source('futures', 'theses') }}
