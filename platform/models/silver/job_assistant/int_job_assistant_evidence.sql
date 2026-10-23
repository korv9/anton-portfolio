-- Each judgement's quotes, one row each: the ad sentence (side ad) and the CV lines (side cv).
with ad as (
    select ad_id, skill, unnest(from_json(ad_quotes, '[{"quote": "VARCHAR", "line": "INTEGER", "field": "VARCHAR"}]')) as q
    from {{ ref('int_job_assistant_judgements') }}
),
cv as (
    select ad_id, skill, unnest(from_json(cv_quotes, '[{"quote": "VARCHAR", "ref": "VARCHAR", "level": "VARCHAR"}]')) as q
    from {{ ref('int_job_assistant_judgements') }}
)
select ad_id, skill, 'ad' as side, q.quote, q.line, q.field as source, null::varchar as cv_level from ad
union all
select ad_id, skill, 'cv' as side, q.quote, null::integer as line, q.ref as source, q.level as cv_level from cv
