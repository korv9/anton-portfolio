-- Seats won per party in the whole country, 1973-2022 (SCB, Riksdagsmandat).
with rows as ({{ pxweb_rows(source('scb_elections', 'election_seats')) }})
select cast({{ px_dim('Tid') }} as integer) as election_year,
       {{ parliament_party(px_dim('Parti')) }} as party,
       cast({{ px_value('ME0104C3') }} as integer) as seats
from rows
