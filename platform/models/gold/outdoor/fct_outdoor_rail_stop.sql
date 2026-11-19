-- Stations on SL's commuter-rail, local-railway and tram routes (route_type 100 and 900) with the
-- routes that call there, for counting the interchanges near a metro station.
select
    s.station_id,
    min(p.stop_name) as stop_name,
    min(p.latitude) as latitude,
    min(p.longitude) as longitude,
    list_sort(list(distinct d.route_id)) as route_ids
from {{ ref('stg_outdoor_gtfs_departures') }} as d
join {{ ref('stg_outdoor_gtfs_stops') }} as s using (stop_id)
join {{ ref('stg_outdoor_gtfs_stops') }} as p on p.stop_id = s.station_id
where d.route_type in ('100', '900')
group by s.station_id
