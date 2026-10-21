{{ config(enabled=var('job_clusters_enabled', false), tags=['job_clusters']) }}

-- One row per cluster and run: label and profile.
select * from {{ source('jobs_ml', 'job_cluster_profiles') }}
