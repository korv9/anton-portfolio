-- One row per hourly run of ads.py, with the ads it saw as new, changed and removed.
select
    cast(json ->> 'started' as timestamptz) as started,
    try_cast(json ->> 'finished' as timestamptz) as finished,
    json ->> 'outcome' as outcome,
    cast(json ->> 'ads' as integer) as ads_kept,
    cast(json ->> 'current' as integer) as ads_current,
    coalesce(list_sum([w.new for w in from_json(json -> 'windows', '[{"new": "INTEGER"}]')]), 0) as ads_new,
    coalesce(list_sum([w.changed for w in from_json(json -> 'windows', '[{"changed": "INTEGER"}]')]), 0) as ads_changed,
    coalesce(list_sum([w.removed for w in from_json(json -> 'windows', '[{"removed": "INTEGER"}]')]), 0) as ads_removed
from {{ source('job_assistant', 'runs') }}
