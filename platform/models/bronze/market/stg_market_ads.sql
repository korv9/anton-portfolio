-- Ads and vacancies per month, occupation group and county, from every archive since 2020.
-- A few ads carry a publication date outside their archive's period (a handful in the year
-- before, some far in the future); only months from 2020 up to the current month count.
-- The county is the ad's workplace county; ads with none, or "Ospecificerad arbetsort",
-- are kept as an unknown county so national totals stay whole.
-- Each archive counts only its own period (its year, or its quarter), so an ad that appears
-- in two archives (republished across the turn of a year) is counted once. The daily stream
-- (ingest_stream.py, archive 'stream') counts only the months after the archives end; those
-- months are preliminary and are replaced when their archive is published.
with source as (
    select
        cast(publication_month || '-01' as date) as month,
        field_id,
        field,
        group_id,
        ssyk,
        occupation_group,
        case
            when region is null or region in ('', 'Ospecificerad arbetsort') then 'Okänt län'
            else region
        end as region,
        ads,
        vacancies,
        regexp_extract(filename, '_(\d{4}(-Q\d)?|stream)\.parquet$', 1) as archive
    from {{ source('jobtech_market', 'ads') }}
    where publication_month similar to '\d{4}-\d{2}'
),
-- The last day the archives cover: a year archive ends on 31 December, a quarter's on the
-- quarter's last day.
archives_end as (
    select max(case when archive like '%-Q%'
                    then last_day(make_date(cast(left(archive, 4) as integer),
                                            cast(right(archive, 1) as integer) * 3, 1))
                    else make_date(cast(archive as integer), 12, 31) end) as last_day
    from source
    where archive <> 'stream'
)
select
    month, field_id, field, group_id, ssyk, occupation_group, region, archive,
    sum(ads)::bigint as ads,
    sum(vacancies)::bigint as vacancies
from source
where month between date '2020-01-01' and date_trunc('month', current_date)
  and (
        case when archive = 'stream'
            then month > (select last_day from archives_end)
            when archive like '%-Q%'
            then year(month) = cast(left(archive, 4) as integer)
             and quarter(month) = cast(right(archive, 1) as integer)
            else year(month) = cast(archive as integer)
        end)
group by all
