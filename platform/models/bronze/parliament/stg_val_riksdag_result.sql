-- The national Riksdag result from Valmyndigheten's results site: votes, share and seats per
-- party. Used for elections SCB has not yet published, and to reconcile the ones it has.
with results as (
    -- The year comes from the file (val2022/RD_S.json): not every file carries its date.
    select cast(regexp_extract(filename, 'val(\d{4})', 1) as integer) as election_year,
           valdatum as election_date,
           rakningstillfalle as count_status,
           senasteUppdateringstid as last_updated,
           rosterPaverkaMandat.partiroster as parties,
           partiMandat as seats,
           filename
    from {{ source('val', 'riksdag_result') }}
), votes as (
    select election_year, election_date, count_status, last_updated,
           unnest(parties) as p
    from results
), seat_rows as (
    select election_year, unnest(seats) as s from results
)
select
    v.election_year, cast(v.election_date as date) as election_date, v.count_status,
    v.last_updated,
    coalesce(nullif(p.partiforkortning, ''), 'OTHER') as party_code,
    -- visa 0 is a party reported on its own, 2 the sum of all other parties. Types 1 (each
    -- small party) and 6 (a placeholder) would count the same votes twice.
    case when p.visa = 0 then {{ parliament_party('p.partiforkortning') }} else 'OTHER' end as party,
    p.partibeteckning as party_name,
    cast(p.antalRoster as bigint) as votes,
    cast(p.andelRoster as double) as share_pct,
    s.s.antalMandat as seats
from votes as v
left join seat_rows as s
    on s.election_year = v.election_year and s.s.partiforkortning = v.p.partiforkortning
    and v.p.visa = 0
where v.p.visa in (0, 2)
