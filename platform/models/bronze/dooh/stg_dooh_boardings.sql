-- One row per edition, station and line as read from "Fakta om SL och länet": the appendix rows
-- (2013–2020, with the four time bands) and the map values (every edition, day only).
-- `station_key` is the name lowercased with everything but letters removed, the key gold joins
-- GTFS stations on. Station names are as printed (terminals are in capitals on the maps).
with editions as (
    select * from {{ source('sl_facts', 'parsed') }}
), appendix as (
    select year, sha256, url, original_url, 'appendix' as read_from, a.station, a.line,
           a.day, a.h06_09, a.h0730_0830, a.h15_18, a.h1630_1730
    from editions, unnest(appendix) as t(a)
), map as (
    select year, sha256, url, original_url, 'map' as read_from, m.station, null as line,
           m.day, null::bigint as h06_09, null::bigint as h0730_0830, null::bigint as h15_18,
           null::bigint as h1630_1730
    from editions, unnest(stations) as t(m)
)
select *, {{ dooh_name_key('station') }} as station_key
from (select * from appendix union all by name select * from map)
