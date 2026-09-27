-- Sick-leave cases. Grain: case type x region x month x sex x age group x diagnosis.
-- Started cases: all chapters nationally, and F43 by county. Ongoing: by county and age.
-- A suppressed count is NULL with `cases_suppressed`, never zero.
select * from {{ ref('int_welfare_sick_leave_cases') }}
