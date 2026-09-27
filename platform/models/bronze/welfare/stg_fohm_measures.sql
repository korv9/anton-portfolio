-- Measure labels per FoHM table, from each table's variable metadata.
with variables as (
    select regexp_extract(filename, '([a-z0-9]+)/metadata\.json$', 1) as source_table,
           unnest(variables) as variable
    from {{ source('fohm', 'metadata') }}
)
select
    source_table,
    unnest(variable."values") as measure_code,
    unnest(variable.valueTexts) as measure_label
from variables
where variable.code in ('Psykisk hälsa', 'Hälsotillstånd', 'Sociala relationer')
