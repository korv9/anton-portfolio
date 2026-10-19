-- One row per SCB table: its subject path, period range and variables as listed.
with listed as (
    select unnest(tables) as t from {{ source('catalogue', 'scb_tables') }}
)
select
    t.id as table_id,
    t.label as title,
    t.source as institution,
    t.subjectCode as subject_area,
    t.paths[1][2].id as subject_code,
    t.paths[1][2].label as subject_label,
    t.timeUnit as time_unit,
    t.firstPeriod as first_period,
    t.lastPeriod as last_period,
    try_cast(left(t.firstPeriod, 4) as integer) as first_year,
    try_cast(left(t.lastPeriod, 4) as integer) as last_year,
    try_cast(t.updated as timestamp) as updated_at,
    t.category = 'public' as is_public,
    t.variableNames as variable_names
from listed
