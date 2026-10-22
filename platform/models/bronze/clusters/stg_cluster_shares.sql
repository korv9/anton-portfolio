-- Cluster shares per period and segment, noise left out, with the bootstrap 5-95 % range.
select clustering, period::varchar as period, segment, cluster::integer as cluster, share, low, high, passages
from {{ source('clusters', 'shares') }}
