-- One line per fetch of a news feed. Columns as logged; error is absent when no fetch failed.
select * from {{ source('news', 'fetches') }}
