-- One row per fetch of a raw file, from every source's fetch log: when it was ingested
-- (fetched_at), when its bytes last changed, what the server said about its copy, and which run
-- and subject fetched it. Checkpoint seals are not fetches and are left out.
-- Read here, not as a source: dbt-duckdb formats a source's external_location with str.format,
-- and the column map's braces would break it. Older lines lack the lineage fields (null).
select
    regexp_extract(replace(filename, '\', '/'), '([^/]+)/_manifest\.jsonl$', 1) as raw_source,
    -- A stored file, or a feed line (news) that logs a request without storing a file.
    case when path is not null then 'file' else 'feed' end as entry,
    coalesce(path, source) as path,
    logical_path,
    url,
    method,
    cast(fetched_at as timestamptz) as ingested_at,
    cast(content_changed_at as timestamptz) as content_changed_at,
    cast(source_modified_at as timestamptz) as source_modified_at,
    etag,
    sha256,
    bytes,
    coalesce(changed, false) as changed,
    coalesce(not_modified, false) as not_modified,
    error,
    run_id,
    subject
from read_json(
    '{{ env_var('PORTFOLIO_RAW', '../warehouse/raw') }}/*/_manifest.jsonl',
    format = 'newline_delimited', filename = true,
    columns = {
        'path': 'VARCHAR', 'source': 'VARCHAR', 'url': 'VARCHAR', 'method': 'VARCHAR',
        'fetched_at': 'VARCHAR', 'content_changed_at': 'VARCHAR', 'source_modified_at': 'VARCHAR',
        'etag': 'VARCHAR', 'sha256': 'VARCHAR', 'bytes': 'BIGINT', 'changed': 'BOOLEAN',
        'not_modified': 'BOOLEAN', 'error': 'VARCHAR', 'run_id': 'VARCHAR', 'subject': 'VARCHAR',
        'logical_path': 'VARCHAR'
    }
)
where coalesce(path, '') not like '\_checkpoints/%' escape '\'
