-- One row per news item. An item whose publication time changed can appear in two month
-- files; the latest sighting wins. `text` is what the tagging reads: headline, summary and
-- the feed's categories (the Government's feed names the ministry and policy area).
select
    id as item_id,
    source,
    title,
    nullif(summary, '') as summary,
    url,
    cast(published_at as timestamptz) as published_at,
    cast(first_seen as timestamptz) as first_seen,
    cast(last_seen as timestamptz) as last_seen,
    categories,
    title || ' ' || coalesce(summary, '') || ' ' || coalesce(array_to_string(categories, ' '), '') as text
from {{ source('news', 'items') }}
qualify row_number() over (partition by id order by last_seen desc) = 1
