-- How each symbol's occurrences spread over the clusters: count, share of the symbol's points
-- and mean membership probability. Noise (-1) is a row like any cluster, so the shares add up.
select
    symbol_id,
    cluster_id,
    count(*) as occurrence_count,
    count(*) / sum(count(*)) over (partition by symbol_id) as share_within_symbol,
    avg(cluster_probability) as avg_cluster_probability
from {{ ref('mart_symbol_atlas') }}
group by symbol_id, cluster_id
