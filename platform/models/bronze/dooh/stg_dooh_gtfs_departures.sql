-- One row per scheduled departure on SL's rail routes: stop, trip, route (type and short name),
-- direction, service, the stop's position in the trip, whether passengers can board (GTFS
-- pickup_type 1 means they cannot: the last stop of a trip, or Kymlinge, where trains pass a
-- station that never opened) and the departure in minutes after the service day's midnight (GTFS times pass 24:00 for trips after midnight).
select
    st.trip_id,
    t.route_id,
    r.route_type,
    r.route_short_name,
    t.direction_id,
    t.service_id,
    st.stop_id,
    cast(st.stop_sequence as integer) as stop_sequence,
    coalesce(st.pickup_type, '0') <> '1' as boarding,
    cast(split_part(st.departure_time, ':', 1) as integer) * 60
        + cast(split_part(st.departure_time, ':', 2) as integer) as departure_minute
from {{ source('sl_gtfs', 'stop_times') }} as st
join {{ source('sl_gtfs', 'trips') }} as t using (trip_id)
join {{ source('sl_gtfs', 'routes') }} as r using (route_id)
where nullif(st.departure_time, '') is not null
