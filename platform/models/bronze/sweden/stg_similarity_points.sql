-- The analysed municipalities of the 2024 clustering: K-means groups (gap rule and finer
-- split), SKR's group and the first two principal components.
select
    r.year,
    p.code as municipality_code,
    p."group" as group_id,
    p.finer_group,
    p.skr_group,
    p.x as pc1,
    p.y as pc2
from {{ source('sweden_similarity', 'run') }} as r, unnest(r.points) as u(p)
