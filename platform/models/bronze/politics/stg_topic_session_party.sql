-- Topic word shares from both topic models' session files, typed, with the model each file
-- belongs to and its position (files in path order, then rows in file order).
with files as (
    select
        case when replace(filename, '\', '/') like '%/politics/parliament/sessions/%' then 'parliament-current'
             else 'debates-legacy' end as model_id,
        filename,
        json -> '$.data[*]' as rows
    from {{ source('politics_delivery', 'topic_session') }}
)
select
    model_id,
    cast(rows[i] ->> '$.session' as VARCHAR) as session,
    cast(rows[i] ->> '$.session_year' as BIGINT) as session_year,
    cast(rows[i] ->> '$.party' as VARCHAR) as party,
    cast(rows[i] ->> '$.topic_id' as BIGINT) as topic_id,
    cast(rows[i] ->> '$.topic_label' as VARCHAR) as topic_label,
    cast(rows[i] ->> '$.segments' as BIGINT) as segments,
    cast(rows[i] ->> '$.words' as BIGINT) as words,
    cast(rows[i] ->> '$.word_share_pct' as DOUBLE) as word_share_pct,
    row_number() over (order by model_id = 'parliament-current', filename, i) as file_order
from files, range(1, len(rows) + 1) as t(i)
