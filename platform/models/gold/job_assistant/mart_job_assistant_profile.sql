-- The approved profile version and CV the published matches used, and the last run's Workers AI use.
select * from {{ ref('stg_job_assistant_profile') }}
