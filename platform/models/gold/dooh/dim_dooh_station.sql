-- SL's metro stations in today's GTFS, one row per station name (a station whose lines have
-- separate parent stops is one station, as in "Fakta om SL och länet"): position (mean of its
-- parent stops), the metro lines that call there, and whether it ends a line, meaning it is the
-- most common last stop of a route in one direction. A stop where no metro train takes on
-- passengers is not a station.
with departures as (
    select * from {{ ref('stg_dooh_gtfs_departures') }} where route_type = '401'
), stops as (
    select * from {{ ref('stg_dooh_gtfs_stops') }}
), calls as (
    select d.*, s.station_id from departures as d join stops as s using (stop_id)
), last_stops as (
    select route_id, direction_id, station_id, count(*) as trips
    from (select trip_id, route_id, direction_id, arg_max(station_id, stop_sequence) as station_id
          from calls group by all)
    group by all
), terminals as (
    select distinct arg_max(station_id, trips) as station_id
    from last_stops group by route_id, direction_id
), stations as (
    select p.stop_id as station_id, p.stop_name, p.latitude, p.longitude,
           {{ dooh_name_key('p.stop_name') }} as station_key
    from stops as p
    where p.stop_id in (select station_id from calls where boarding)
)
select
    s.station_key,
    min(s.stop_name) as station_name,
    avg(s.latitude) as latitude,
    avg(s.longitude) as longitude,
    list_sort(list_distinct(flatten(list(l.lines)))) as lines,
    bool_or(s.station_id in (select station_id from terminals)) as terminal
from stations as s
left join (select station_id, list(distinct route_short_name) as lines from calls group by all) as l
    using (station_id)
group by s.station_key
