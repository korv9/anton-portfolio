-- Riksdag election results per municipality, 1973-2022 (SCB): votes and share of valid votes.
select region_code as municipality_code, election_year,
       case when party = 'ÖVRIGA' then 'OTHER' else party end as party, votes, share_pct
from {{ ref('stg_scb_elections') }}
where region_code <> '00' and party_code not in ('OGILTIGA', 'VALSKOLKARE')
