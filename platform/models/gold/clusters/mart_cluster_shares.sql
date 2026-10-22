-- Cluster shares per period and segment (a party, or 'all') with the bootstrap 5-95 % range.
select clustering, period, segment, cluster, share, low, high, passages
from {{ ref('stg_cluster_shares') }}
