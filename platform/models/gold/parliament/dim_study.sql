-- Every government study a bill can rest on: the published series (SOU, Ds) from Riksdagen's
-- listings, and the ministry memoranda (promemorior) that bills name in their preparation but
-- that no series lists. A memorandum is known by its title, or by its diary number.
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
)
select study_key, kind, year, number, designation, cast(null as varchar) as diary, title, inquiry,
       published, source_url
from {{ ref('stg_riksdagen_studies') }}
union all
select study_key, kind, year, number, designation, diary, title, inquiry, published, source_url
from memoranda
