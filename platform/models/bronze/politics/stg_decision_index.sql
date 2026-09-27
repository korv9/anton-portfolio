-- One row per roll-call decision in the per-session indexes, as delivered: the session slug
-- from the file path, the decision object untouched, and its position (files are read in
-- path order, then rows in file order; the delivered mart keeps that order).
select
    regexp_extract(filename, '/decisions/([^/]+)/index\.json$', 1) as slug,
    json ->> '$.id' as vote_id,
    json as decision,
    row_number() over () as file_order
from {{ source('politics_delivery', 'decision_index') }}
