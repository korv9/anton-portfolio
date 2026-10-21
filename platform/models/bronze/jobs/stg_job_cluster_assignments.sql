{{ config(enabled=var('job_clusters_enabled', false), tags=['job_clusters']) }}

-- One row per clustered ad: run, cluster, map position and membership probability.
select * from {{ source('jobs_ml', 'job_cluster_assignments') }}
