{{ config(enabled=var('job_clusters_enabled', false), tags=['job_clusters']) }}
select * from {{ ref('mart_job_clusters') }}
where not isfinite(umap_x) or not isfinite(umap_y)
    or not isfinite(cluster_probability) or cluster_probability not between 0 and 1
    or is_noise != (cluster_id = -1)
