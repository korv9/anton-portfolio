-- Three Swedens (H4): how far each municipality's 10 nearest neighbours agree between the social,
-- job-ad and vote spaces (Jaccard per pair, agreement their mean), the 20 misfits and the two
-- published SWEDEN C groupings. Names come from dim_municipality.
select t.municipality_code, m.municipality_name, t.agreement,
       t.jaccard_social_jobs, t.jaccard_social_votes, t.jaccard_jobs_votes,
       t.misfit_rank, t.misfit_rank is not null as is_misfit,
       t.neighbours_social, t.neighbours_jobs, t.neighbours_votes, t.group_k2, t.group_k4
from {{ ref('stg_municipality_three_spaces') }} as t
join {{ ref('dim_municipality') }} as m
    on m.municipality_code = t.municipality_code and m.valid_to is null
