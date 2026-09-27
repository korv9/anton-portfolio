-- Riksdag election results from SCB: Sweden and each municipality, 1973-2022.
-- Votes and share of valid votes per party; blank and invalid ballots and non-voters are
-- rows of their own (party_code OGILTIGA, VALSKOLKARE) and are kept apart downstream.
with country as (
    {{ pxweb_rows(source('scb_elections', 'election_country')) }}
), municipality as (
    {{ pxweb_rows(source('scb_elections', 'election_municipality')) }}
), rows as (
    select '00' as region_code, {{ px_dim('Partimm') }} as party_code,
           cast({{ px_dim('Tid') }} as integer) as election_year,
           {{ px_value('ME0104B6') }} as votes, {{ px_value('ME0104B7') }} as share_pct
    from country
    union all
    select {{ px_dim('Region') }}, {{ px_dim('Partimm') }}, cast({{ px_dim('Tid') }} as integer),
           {{ px_value('ME0104B6') }}, {{ px_value('ME0104B7') }}
    from municipality
)
select region_code, election_year, party_code,
       {{ parliament_party('party_code') }} as party, votes, share_pct
from rows
-- Old multi-municipality constituencies (VR...) are not municipalities.
where region_code = '00' or regexp_matches(region_code, '^\d{4}$')
