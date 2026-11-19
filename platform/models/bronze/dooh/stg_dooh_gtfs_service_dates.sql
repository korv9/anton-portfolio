-- Dates each metro service runs: calendar.txt's weekday pattern between its dates, with
-- calendar_dates.txt's additions (1) and removals (2).
{% set days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] %}
with calendar as (
    select service_id, strptime(start_date, '%Y%m%d')::date as start_date,
           strptime(end_date, '%Y%m%d')::date as end_date,
           [{% for d in days %}{{ d }} = '1'{{ ',' if not loop.last }}{% endfor %}] as runs
    from {{ source('sl_gtfs', 'calendar') }}
), pattern as (
    select service_id, d::date as service_date
    from calendar, unnest(generate_series(start_date, end_date, interval 1 day)) as t(d)
    where runs[isodow(d::date)]
), changes as (
    select service_id, strptime(date, '%Y%m%d')::date as service_date, exception_type
    from {{ source('sl_gtfs', 'calendar_dates') }}
)
select service_id, service_date from pattern
where (service_id, service_date) not in (select service_id, service_date from changes where exception_type = '2')
union
select service_id, service_date from changes where exception_type = '1'
