-- One row per matched current ad. detailed: its judgements and text are published (the review
-- list, stretch ads and the evaluation sample); sample: one of 30 outside ads picked by a hash of
-- the id, so the owner's labels can find ads the rules missed.
with sampled as (
    select ad_id
    from {{ ref('stg_job_assistant_matches') }}
    where match_class = 'outside'
    order by sha256('job-assistant-sample-v1:' || ad_id)
    limit 30
)
select
    m.ad_id, m.rank, m.match_class, m.role, m.role_from_title, m.reasons, m.gaps, m.uncertain,
    m.similarity, m.remote_quote, m.senior_title, m.years_asked, m.junior_quote,
    case when m.explanation_status = 'verified' then m.explanation end as explanation,
    m.explanation_status, m.explanation_model, m.content_hash, m.profile_version, m.cv_sha256, m.engine,
    s.ad_id is not null as sample,
    m.match_class in ('strong', 'possible', 'stretch') or s.ad_id is not null as detailed
from {{ ref('stg_job_assistant_matches') }} as m
left join sampled as s using (ad_id)
