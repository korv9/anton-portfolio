-- Residents and employed residents (15–74, counted where they live) per DeSO and year in
-- Stockholm County, on the division SCB used that year (DeSO 2018 up to 2023, DeSO 2025 from
-- 2024). SCB fills the other division's cells of a year with zeros, so a division is kept for a
-- year only where it has residents. Employed residents begin in 2020.
select deso_version, deso_code, year, residents, employed
from {{ ref('stg_outdoor_deso') }}
qualify sum(residents) over (partition by deso_version, year) > 0
