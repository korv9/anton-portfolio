-- County populations must add up to the country's, every year and for each sex. Years
-- published under SCB's cell key method carry deliberate noise per cell, so they may
-- differ by a few people, never by more than 0.01 per cent.
with counties as (
    select p.period_key, p.sex_key, sum(p.population) as county_sum
    from {{ ref('fct_population') }} as p
    join {{ ref('dim_region') }} as r using (region_code)
    where r.region_level = 'county'
    group by all
)
select c.*, n.population as country, n.is_perturbed
from counties as c
join {{ ref('fct_population') }} as n
    on n.region_code = '00' and n.period_key = c.period_key and n.sex_key = c.sex_key
where case when n.is_perturbed
           then abs(c.county_sum - n.population) > 0.0001 * n.population
           else c.county_sum <> n.population end
