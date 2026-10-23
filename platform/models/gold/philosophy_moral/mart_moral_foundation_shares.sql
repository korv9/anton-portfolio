-- Flagged share of sampled Riksdag passages per validated foundation, year and party (party null:
-- the whole year), with the bootstrap interval and, for party cells, the shuffle null's band.
select
    foundation,
    year,
    party,
    passages,
    share,
    ci_low,
    ci_high,
    null_low,
    null_high,
    party is not null and (share < null_low or share > null_high) as outside_null_band
from {{ ref('stg_moral_shares') }}
