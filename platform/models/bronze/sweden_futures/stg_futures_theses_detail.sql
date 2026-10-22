-- DiVA thesis records per harvested month from 2019-01: subject sets, degree types, words and the
-- future marker's matches split by alternative (no text).
select * from {{ source('futures', 'theses_detail') }}
