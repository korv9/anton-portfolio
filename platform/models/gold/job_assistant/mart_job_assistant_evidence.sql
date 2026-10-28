-- The quotes behind each published judgement: the ad sentence and the CV lines, numbered per side.
select
    e.ad_id, e.skill, e.side,
    cast(row_number() over (partition by e.ad_id, e.skill, e.side order by e.line nulls last,
        case e.cv_level when 'practical' then 1 when 'education_or_project' then 2 else 3 end, e.quote) as integer) as quote_number,
    e.quote, e.line, e.source, e.cv_level, e.cv_source
from {{ ref('int_job_assistant_evidence') }} as e
join {{ ref('mart_job_assistant_matches') }} as m using (ad_id)
where m.detailed
