-- A bootstrap range is ordered and is not a single point unless the share is 0 or 1.
select clustering, period, segment, cluster, share, low, high
from {{ ref('mart_cluster_shares') }}
where low > high or (low = high and share not in (0, 1) and passages > 1)
