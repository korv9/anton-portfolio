-- Within a clustering and period the assigned entities' clusters, and the published shares
-- within a segment, each add up to one; so do a municipality's occupation-field shares in a year.
select 'assignments' as mart, clustering, period, null as segment, sum(share) as total
from (select distinct clustering, period, cluster, cluster_share as share
      from {{ ref('mart_cluster_assignments') }} where not is_noise)
group by clustering, period
having abs(sum(share) - 1) > 1e-6
union all
select 'shares', clustering, period, segment, sum(share)
from {{ ref('mart_cluster_shares') }}
group by clustering, period, segment
having abs(sum(share) - 1) > 1e-3
union all
select 'job_ads', null, year::varchar, municipality_code, sum(share)
from {{ ref('mart_job_ad_municipality_field') }}
group by year, municipality_code
having abs(sum(share) - 1) > 1e-6
