-- ml/three_swedens.py: one row per analysed municipality; misfit_rank is null outside the 20 misfits.
select municipality_code, agreement, jaccard_social_jobs, jaccard_social_votes, jaccard_jobs_votes,
       misfit_rank::integer as misfit_rank, neighbours_social, neighbours_jobs, neighbours_votes,
       group_k2::integer as group_k2, group_k4::integer as group_k4
from {{ source('clusters', 'three_spaces') }}
