{{ config(tags=['sweden_futures']) }}
-- DiVA thesis records from 2019-01 at their latest harvested month, with degree level and HSV
-- subject area read from dc:type and the OAI setSpecs. A null year (deleted, or no Swedish
-- abstract) leaves the record out of the mart.
with latest as (
    select *, list_filter(string_split(sets, '|'), s -> list_contains(
        ['AgricultureVeterinaryMedForestry', 'FineArt', 'HumanitiesTheology', 'LifeEarthScience',
         'Medicine', 'PhysicsChemistryMaths', 'SocialBehaviourLaw', 'Technology'], s)) as areas
    from {{ ref('stg_futures_theses_detail') }}
    qualify month = max(month) over (partition by id)
)

select
    id, month, year, words,
    split_part(sets, '|', 1) as institution,
    case when types ilike '%masterThesis%' then 'master'
         when types ilike '%bachelorThesis%' then 'bachelor'
         else 'other' end as level,
    case len(areas) when 0 then 'none' when 1 then areas[1] else 'several' end as area,
    m_research, m_framtiden, m_framtida, m_framtid_compound, m_long_term, m_vision, m_other
from latest
