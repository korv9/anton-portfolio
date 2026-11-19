-- Metro boardings per station on an average winter weekday, per edition of "Fakta om SL och
-- länet" (2013–2022), with the appendix's four time bands where the edition has them (2013–2020).
-- The appendix is used where it has the station (its rows per line are summed); otherwise the
-- map's value. Vreten was renamed Solna strand in 2014.
with boardings as (
    select *, case station_key when 'vreten' then 'solnastrand' else station_key end as key
    from {{ ref('stg_outdoor_boardings') }}
), appendix as (
    select year, key, sum(day) as day, sum(h06_09) as h06_09, sum(h0730_0830) as h0730_0830,
           sum(h15_18) as h15_18, sum(h1630_1730) as h1630_1730, count(*) as appendix_rows
    from boardings where read_from = 'appendix' group by all
), map as (
    select year, key, max(day) as day from boardings where read_from = 'map' group by all
), editions as (
    select distinct year, url, original_url, sha256 from boardings
)
select
    s.station_key,
    cast(e.year as integer) as year,
    cast(coalesce(a.day, m.day) as bigint) as boardings,
    {% for band in ['h06_09', 'h0730_0830', 'h15_18', 'h1630_1730'] %}cast(a.{{ band }} as bigint) as {{ band }},
    {% endfor %}
    case when a.key is not null then 'appendix' when m.key is not null then 'map' end as read_from,
    e.url as source_url,
    e.original_url,
    e.sha256 as source_sha256
from {{ ref('dim_outdoor_station') }} as s
cross join editions as e
left join appendix as a on a.key = s.station_key and a.year = e.year
left join map as m on m.key = s.station_key and m.year = e.year
