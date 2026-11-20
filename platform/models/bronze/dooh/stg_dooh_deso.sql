-- Residents and employed residents per DeSO and year in Stockholm County (SCB PxWeb). SCB
-- publishes a year on the division in force: DeSO 2018 up to 2023, DeSO 2025 from 2024; a code
-- of the other division that year has no value or a zero; gold keeps the division in use.
{% set version %}case when ends_with({{ px_dim('Region') }}, '_DeSO2025') then '2025' else '2018' end{% endset %}
with residents as (
    select {{ version }} as deso_version, replace({{ px_dim('Region') }}, '_DeSO2025', '') as deso_code,
           cast({{ px_dim('Tid') }} as integer) as year, {{ px_value(1) }} as residents
    from ({{ pxweb_rows(source('scb_deso', 'residents')) }})
), employed as (
    select {{ version }} as deso_version, replace({{ px_dim('Region') }}, '_DeSO2025', '') as deso_code,
           cast({{ px_dim('Tid') }} as integer) as year, {{ px_value(1) }} as employed
    from ({{ pxweb_rows(source('scb_deso', 'employed')) }})
)
select deso_version, deso_code, year, r.residents, e.employed
from residents as r
full join employed as e using (deso_version, deso_code, year)
where coalesce(r.residents, e.employed) is not null
