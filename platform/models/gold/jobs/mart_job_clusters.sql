{{ config(enabled=var('job_clusters_enabled', false), tags=['job_clusters']) }}

select a.*, p.cluster_label, j.title, j.role_family, j.seniority,
    year(j.published_at)::integer as published_year, j.region,
    coalesce(s.skills, []::varchar[]) as skills
from {{ source('jobs_ml', 'job_cluster_assignments') }} a
join {{ ref('int_job_ads_enriched') }} j using (job_id)
join {{ source('jobs_ml', 'job_cluster_profiles') }} p using (cluster_id, run_id)
left join (
    select job_id, list(skill order by skill) as skills
    from {{ ref('bridge_job_skills') }} group by job_id
) s using (job_id)
