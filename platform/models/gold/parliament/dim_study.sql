-- Every government study a bill can rest on: the published series (SOU, Ds, RiR) from
-- Riksdagen's listings, the ministry memoranda (promemorior) that bills name in their
-- preparation but that no series lists (known by title or diary number), and the few series
-- reports a bill names that the listings lack, known only by their number.
with memoranda as (
    select
        'pm:' || lower(r.key) as study_key,
        'pm' as kind,
        min(year(b.bill_date)) as year,
        cast(null as integer) as number,
        coalesce(nullif(r.title, ''), 'Promemoria ' || r.diary) as designation,
        max(r.diary) as diary,
        coalesce(nullif(r.title, ''), 'Promemoria ' || r.diary) as title,
        cast(null as varchar) as inquiry,
        cast(null as date) as published,
        -- A memorandum has no document of its own in Riksdagen's data; the bill is its source.
        min(b.source_url) as source_url
    from {{ ref('stg_riksdagen_bill_preparation') }} as b, unnest(b."references") as t(r)
    where r.kind = 'pm'
    group by 1, 2, 5, 7
), listed as (
    select study_key, kind, year, number, designation, cast(null as varchar) as diary, title,
           inquiry, published, source_url
    from {{ ref('stg_riksdagen_studies') }}
), cited_only as (
    select distinct
        r.kind || ':' || r.key as study_key,
        r.kind,
        cast(split_part(r.key, ':', 1) as integer) as year,
        cast(split_part(r.key, ':', 2) as integer) as number,
        case r.kind when 'rir' then 'RiR' when 'ds' then 'Ds' else upper(r.kind) end
            || ' ' || r.key as designation,
        cast(null as varchar) as diary,
        cast(null as varchar) as title,
        cast(null as varchar) as inquiry,
        cast(null as date) as published,
        'https://www.riksdagen.se/sv/sok/?doktyp=' || r.kind || '&q='
            || replace(r.key, ':', '%3A') as source_url
    from {{ ref('stg_riksdagen_bill_preparation') }} as b, unnest(b."references") as t(r)
    where r.kind in ('sou', 'ds', 'rir')
      and r.kind || ':' || r.key not in (select study_key from listed)
)
select * from listed
union all
select study_key, kind, year, number, designation, diary, title, inquiry, published, source_url
from memoranda
union all
select * from cited_only
