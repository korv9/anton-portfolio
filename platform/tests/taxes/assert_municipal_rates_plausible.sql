-- Every parish of the latest year has a local income tax between 28 and 36 per cent, and all
-- 290 municipalities are present.
with latest as (select max(year) as year from {{ ref('fct_municipal_tax_rate') }})
select 'rate' as problem, parish_code
from {{ ref('fct_municipal_tax_rate') }} join latest using (year)
where local_income_tax_rate not between 28 and 36
union all
select 'municipalities', cast(count(distinct municipality_code) as varchar)
from {{ ref('fct_municipal_tax_rate') }} join latest using (year)
having count(distinct municipality_code) <> 290
