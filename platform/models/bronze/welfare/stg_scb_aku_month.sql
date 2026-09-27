-- AKU national monthly series. `labour_measure_code` combines status and unit
-- (SYS = employed, thousands; SYSP = employment rate, percent; and so on).
with cells as (
    {{ pxweb_rows(source('scb', 'aku_month')) }}
)
select
    {{ px_dim('Arbetskraftstillh') }} as labour_measure_code,
    {{ px_dim('TypData') }} as series_type_code,
    {{ px_dim('Kon') }} as sex_code,
    {{ px_dim('Alder') }} as age_code,
    {{ px_dim('Tid') }} as period_code,
    {{ px_value(1) }} as value,
    {{ px_marker(1) }} as value_marker,
    filename as source_file
from cells
