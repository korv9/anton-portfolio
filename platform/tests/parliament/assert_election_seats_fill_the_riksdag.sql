-- Every election fills the Riksdag: 350 seats in 1973, 349 since, and shares add to 100
-- (within rounding: SCB publishes one decimal per party).
select election_year, sum(seats) as seats, sum(share_pct) as share_pct
from {{ ref('fct_election') }}
group by election_year
having sum(seats) <> case when election_year = 1973 then 350 else 349 end
    or abs(sum(share_pct) - 100) > 0.5
