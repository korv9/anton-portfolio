-- Tax and fee rates per municipality, parish and year (Skatteverket), for the calculator.
-- Grain: year x parish_code x parish_name; several parishes can share a municipality's code.
-- The municipal rate is the municipality's and the region's together.
select
    year, municipality_code, municipality_name, parish_code, parish_name,
    municipal_rate + regional_rate as local_income_tax_rate,
    municipal_rate, regional_rate, burial_rate, church_rate
from {{ ref('stg_skatteverket_rates') }}
