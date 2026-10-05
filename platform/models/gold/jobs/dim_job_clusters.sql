{{ config(enabled=var('job_clusters_enabled', false), tags=['job_clusters']) }}

-- Employer language and repeated templates can drive semantic density. Expose
-- concentration from the existing ad metadata, alongside skill-based ML labels.
with employer_counts as (
    select a.cluster_id, a.run_id, coalesce(j.employer_name, 'Unspecified') as employer,
        count(*) as ads
    from {{ source('jobs_ml', 'job_cluster_assignments') }} a
    join {{ ref('int_job_ads_enriched') }} j using (job_id)
    group by 1, 2, 3
), ranked as (
    select *, row_number() over (partition by cluster_id, run_id order by ads desc, employer) as rank,
        sum(ads) over (partition by cluster_id, run_id) as total
    from employer_counts
), employer_profile as (
    select cluster_id, run_id,
        to_json(list(struct_pack(label := employer, count := ads, share := ads::double / total)
            order by ads desc, employer)) as top_employers
    from ranked where rank <= 5 group by 1, 2
)
select p.*, e.top_employers
from {{ source('jobs_ml', 'job_cluster_profiles') }} p
left join employer_profile e using (cluster_id, run_id)
