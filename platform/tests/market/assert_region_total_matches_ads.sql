-- The county total over all fields keeps every ad, including those without a field.
select t.year, t.region, t.ads, a.ads as source_ads
from {{ ref('mart_market_region_yearly_total') }} as t
full join (
    select year(month) as year, region, sum(ads) as ads
    from {{ ref('stg_market_ads') }}
    group by all
) as a using (year, region)
where t.ads is distinct from a.ads
