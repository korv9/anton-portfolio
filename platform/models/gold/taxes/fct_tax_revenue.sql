-- Tax revenue per country, year and tax type: share of GDP and, in national currency, the
-- amount. General government, all levels, OECD Revenue Statistics.
select
    r.country_code, r.year, r.tax_code,
    max(r.value) filter (where r.unit = 'PT_B1GQ') as pct_gdp,
    max(r.value) filter (where r.unit = 'XDC') as amount_national,
    max(r.currency) filter (where r.unit = 'XDC') as currency
from {{ ref('stg_oecd_revenue') }} as r
join {{ ref('dim_tax_type') }} using (tax_code)
group by all
