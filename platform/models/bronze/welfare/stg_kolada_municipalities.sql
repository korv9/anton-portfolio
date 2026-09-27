select m.id as kolada_region_id, m.title as kolada_region_name, m.type as kolada_region_type
from (select unnest("values") as m from {{ source('kolada', 'municipalities') }})
