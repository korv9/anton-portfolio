-- The headline tax types add up to the total, for Sweden, every year (within rounding).
with parts as (
    select year,
           sum(pct_gdp) filter (where tax_code in ('T_1000', 'T_2000', 'T_3000', 'T_4000', 'T_5000', 'T_6000')) as parts,
           max(pct_gdp) filter (where tax_code = '_T') as total
    from {{ ref('fct_tax_revenue') }}
    where country_code = 'SWE'
    group by year
)
select * from parts where abs(parts - total) > 0.05
