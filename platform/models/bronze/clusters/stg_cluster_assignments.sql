-- Every cluster run's assignments; cluster -1 is noise.
select clustering, entity_id, entity_name, period, cluster::integer as cluster, probability
from {{ source('clusters', 'assignments') }}
