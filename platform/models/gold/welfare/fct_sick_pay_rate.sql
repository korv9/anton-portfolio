-- Sjukpenningtal 2.0. Grain: region (country, county, municipality) x month x sex x age.
-- The rate is a rolling twelve-month measure, so December is the calendar-year value.
select * from {{ ref('int_welfare_sick_pay_rate') }}
