-- The change history of each ad: new, changed and removed, in the order ads.py observed them.
with events as (
    select ad_id, unnest(from_json(history, '[{"at": "VARCHAR", "event": "VARCHAR", "hash": "VARCHAR"}]')) as e
    from {{ ref('stg_job_assistant_ads') }}
)
select
    ad_id,
    cast(row_number() over (partition by ad_id order by e.at) as integer) as event_number,
    cast(e.at as timestamptz) as observed_at,
    e.event,
    e.hash as content_hash
from events
