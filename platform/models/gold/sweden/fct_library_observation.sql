-- Public-library observations of the four bibstat terms SWEDEN D uses, with the municipality
-- Biblioteksdatabasen gives the reporting organisation. municipality_code is NULL when the
-- library has none or a code that is not current; value is NULL when bibstat has no number.
-- bibstat holds a few repeated submissions (Lindängenbiblioteket 2016: two observations with
-- the same values); only the first observation id of each library, year and term is kept.
select
    o.observation_id,
    o.term,
    case o.term
        when 'BemanService01' then 'service_points'
        when 'Besok01' then 'visits'
        when 'Publ199' then 'activities'
        when 'Aktiv99' then 'active_borrowers'
    end as measure,
    o.sigel,
    o.sample_year as year,
    m.municipality_code,
    o.value
from {{ ref('stg_kb_statistics') }} as o
left join {{ ref('dim_library') }} as l on l.sigel = o.sigel
left join {{ ref('dim_municipality') }} as m
    on m.municipality_code = l.municipality_code and m.valid_to is null
where o.term in ('BemanService01', 'Besok01', 'Publ199', 'Aktiv99')
  and o.target_group in ('Folkbibliotek', 'Folk- och skolbibliotek')
qualify row_number() over (partition by o.sigel, o.sample_year, o.term order by o.observation_id) = 1
