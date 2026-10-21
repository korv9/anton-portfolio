-- Every library in Biblioteksdatabasen: its municipality, type and WGS84 position (0,0 or NULL
-- when unknown). dump_order keeps the dump's order for the published list.
select sigel, name, municipality_code, library_type, alive, country_code, longitude, latitude, dump_order
from {{ ref('stg_kb_libraries') }}
