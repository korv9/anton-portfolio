-- Every member's vote on every roll call, 1993/94 to now, one row per member and roll call.
-- The file layout changed over the years: early files have a header row and put the point
-- before the roll-call id; later ones have no header and the id first. Which layout a row
-- has is read from the row itself (a point is a number, an id never is).
{{ config(materialized="table") }}

with raw as (
    select *
    from read_csv(
        '{{ env_var('PORTFOLIO_RAW', '../warehouse/raw') }}/riksdagen/votes/*.csv.gz',
        header = false, all_varchar = true, quote = '"', delim = ',', filename = true,
        names = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11', 'c12',
                 'c13', 'c14'])
), rows as (
    select *, regexp_matches(c3, '^\d+$') as point_first
    from raw
    where regexp_replace(c1, '^﻿', '') <> 'rm'
)
select
    {{ parliament_session('trim(c1)') }} as session,
    trim(c2) as designation,
    upper(trim(case when point_first then c4 else c3 end)) as vote_id,
    trim(case when point_first then c3 else c4 end) as point,
    trim(regexp_replace(c5, '\s+', ' ', 'g')) as member_name,
    nullif(nullif(trim(c6), '?'), '') as member_id,
    {{ parliament_party('c7') }} as party,
    nullif(trim(c8), '') as constituency,
    case trim(c9)
        when 'Ja' then 'yes' when 'Nej' then 'no' when 'Avstår' then 'abstain'
        when 'Frånvarande' then 'absent'
    end as vote,
    nullif(trim(c10), '') as subject,  -- sakfrågan or motivfrågan; not recorded in the earliest files
    try_cast(c11 as integer) as seat,
    try_cast(c14 as date) as vote_date,
    regexp_extract(filename, '([0-9]+)\.csv\.gz$', 1) as source_file
from rows
