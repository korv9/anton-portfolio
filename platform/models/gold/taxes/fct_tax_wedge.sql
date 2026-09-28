-- Labour taxation per country, year, household and wage level (OECD Taxing Wages): the tax
-- wedge, the average and marginal rates and net income. PPP dollars for amounts, so they
-- compare across countries.
select
    country_code, year, household_type, wage_level, spouse_wage_level,
    max(value) filter (where measure = 'AV_TW') as tax_wedge_pct,
    max(value) filter (where measure = 'MR_TW_PE') as marginal_tax_wedge_pct,
    max(value) filter (where measure = 'AV_ITR') as income_tax_pct,
    max(value) filter (where measure = 'AV_R_EMPEE_SSC') as employee_ssc_pct,
    max(value) filter (where measure = 'AV_R_EMPER_SSC') as employer_ssc_pct,
    max(value) filter (where measure = 'NPATR') as net_personal_average_rate_pct,
    max(value) filter (where measure = 'GEBT' and unit = 'USD_PPP') as gross_earnings_usd_ppp,
    max(value) filter (where measure = 'NIAT' and unit = 'USD_PPP') as net_income_usd_ppp,
    max(value) filter (where measure = 'GLCBT' and unit = 'USD_PPP') as labour_cost_usd_ppp,
    max(value) filter (where measure = 'GEBT' and unit = 'XDC') as gross_earnings_national
from {{ ref('stg_oecd_taxing_wages') }}
group by all
