-- The DiVA 2024-25 jump taken apart: publication year × degree level × HSV subject area ×
-- institution over Swedish-language student-thesis abstracts harvested from record month 2019-01,
-- with the abstracts using each alternative of the future marker. `future_without_research`
-- counts abstracts that still match the marker once "framtida forskning" and its kin are dropped;
-- `future_without_research_long_term` also drops "långsiktig" and "på lång sikt".
select
    year::integer as year, level, area, institution,
    count(*) as abstracts,
    count(*) filter (where m_research + m_framtiden + m_framtida + m_framtid_compound
                           + m_long_term + m_vision + m_other > 0) as future_abstracts,
    count(*) filter (where m_framtiden + m_framtida + m_framtid_compound
                           + m_long_term + m_vision + m_other > 0) as future_without_research,
    count(*) filter (where m_framtiden + m_framtida + m_framtid_compound
                           + m_vision + m_other > 0) as future_without_research_long_term,
    count(*) filter (where m_research > 0) as using_research,
    count(*) filter (where m_framtiden > 0) as using_framtiden,
    count(*) filter (where m_framtida > 0) as using_framtida,
    count(*) filter (where m_framtid_compound > 0) as using_framtid_compound,
    count(*) filter (where m_long_term > 0) as using_long_term,
    count(*) filter (where m_vision > 0) as using_vision,
    count(*) filter (where m_other > 0) as using_other,
    sum(words) as words
from {{ ref('int_sweden_future_theses_detail_latest') }}
where year is not null
group by all
