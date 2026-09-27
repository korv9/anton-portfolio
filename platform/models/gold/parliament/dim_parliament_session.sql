-- Riksmöten from 1993/94: when each ran, the election it followed and who governed at its start.
with sessions as (
    select session, min(vote_date) as first_vote, max(vote_date) as last_vote,
           count(*) as roll_calls
    from {{ ref('int_parliament_roll_calls') }}
    group by session
), elections as (
    select distinct election_year from {{ ref('fct_election') }}
)
select
    s.session,
    cast(left(s.session, 4) as integer) as start_year,
    s.first_vote, s.last_vote, s.roll_calls,
    (select max(election_year) from elections as e
     where e.election_year <= cast(left(s.session, 4) as integer)) as election_year,
    g.government_key, g.government_name, g.government_parties, g.agreement_parties
from sessions as s
left join {{ ref('dim_government') }} as g
    on s.first_vote >= g.start_date and s.first_vote < coalesce(g.end_date, date '9999-12-31')
