-- Between-party spread per validated foundation against the within-year party shuffle null.
select *, holm_p < 0.05 as finding
from {{ ref('stg_moral_spread') }}
