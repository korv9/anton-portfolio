-- Valmyndigheten's count of each Riksdag election on its results site: the election date,
-- whether the count is preliminary or final, and when it was last updated.
select
    election_year,
    any_value(election_date) as election_date,
    any_value(count_status) as count_status,
    any_value(last_updated) as last_updated
from {{ ref('stg_val_riksdag_result') }}
group by election_year
