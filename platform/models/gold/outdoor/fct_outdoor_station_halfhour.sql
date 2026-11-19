-- Scheduled metro departures that take on passengers, per station and half-hour on one ordinary weekday of today's GTFS:
-- the Tuesday, Wednesday or Thursday in the feed's first 28 days with the most metro trips (the
-- earliest such date on a tie). Half-hour 0 starts at the service day's midnight; GTFS times
-- after 24:00 give half-hours past 47.
with departures as (
    select * from {{ ref('stg_outdoor_gtfs_departures') }} where route_type = '401' and boarding
), dates as (
    select sd.service_date, count(distinct d.trip_id) as trips
    from {{ ref('stg_outdoor_gtfs_service_dates') }} as sd
    join departures as d using (service_id)
    group by all
), chosen as (
    select service_date from dates
    where isodow(service_date) in (2, 3, 4)
      and service_date < (select min(service_date) from dates) + interval 28 day
    order by trips desc, service_date
    limit 1
)
select
    s.station_key,
    (select service_date from chosen) as service_date,
    d.departure_minute // 30 as half_hour,
    count(*) as departures
from departures as d
join {{ ref('stg_outdoor_gtfs_service_dates') }} as sd
    on sd.service_id = d.service_id and sd.service_date = (select service_date from chosen)
join {{ ref('stg_outdoor_gtfs_stops') }} as st using (stop_id)
join (select stop_id as station_id, {{ outdoor_name_key('stop_name') }} as station_key
      from {{ ref('stg_outdoor_gtfs_stops') }}) as s using (station_id)
group by all
