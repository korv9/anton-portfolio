-- Reconciliation against SCB's published AKU annual averages for 2025, ages 15-74:
-- unemployment 8.8 per cent and employment rate 69.0 per cent for the whole country.
-- A change in parsing or in the status mapping moves these first.
select *
from {{ ref('fct_labour_force') }}
where region_code = '00' and period_key = '2025' and sex_key = 'T' and age_group_key = '15-74'
  and ((labour_status = 'unemployed' and rate_pct <> 8.8)
    or (labour_status = 'employed' and rate_pct <> 69.0))
