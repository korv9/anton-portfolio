-- Metro stops and their parent stations from SL's GTFS (metro part). A platform's station is
-- its parent; a stop without a parent is its own station.
select
    s.stop_id,
    s.stop_name,
    cast(s.stop_lat as double) as latitude,
    cast(s.stop_lon as double) as longitude,
    coalesce(cast(nullif(s.location_type, '') as integer), 0) as location_type,
    coalesce(nullif(s.parent_station, ''), s.stop_id) as station_id
from {{ source('sl_gtfs', 'stops') }} as s
