-- Calendar, one row per day from the earliest population year to 2030. Periods of any
-- length join here through dim_period's start and end dates.
select
    cast(day as date) as date_day,
    year(day) as year,
    quarter(day) as quarter,
    month(day) as month,
    strftime(day, '%Y-%m') as year_month,
    year(day) || '-Q' || quarter(day) as year_quarter,
    ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti',
     'september', 'oktober', 'november', 'december'][month(day)] as month_name_sv,
    isodow(day) as iso_day_of_week,
    day(day) = 1 as is_month_start,
    day = last_day(day) as is_month_end
from generate_series(date '1968-01-01', date '2030-12-31', interval 1 day) as days(day)
