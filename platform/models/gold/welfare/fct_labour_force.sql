-- AKU labour force. Grain: region x period x sex x age group x series type x status.
-- The rate's denominator depends on the status; see int_welfare_labour_force.
select * from {{ ref('int_welfare_labour_force') }}
where labour_status is not null
