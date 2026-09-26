-- Nationella folkhälsoenkäten, all six tables stacked. One row per table, measure, region
-- or age group, sex and period. The statistic variable splits each value into share,
-- interval bounds and number of responses; silver pivots them.
{% set tables = {
    'hlv1psyxreg': ('Psykisk hälsa', 'region'), 'hlv1psyaald': ('Psykisk hälsa', 'age'),
    'hlv1allmxreg': ('Hälsotillstånd', 'region'), 'hlv1allmaald': ('Hälsotillstånd', 'age'),
    'hlv1socxreg': ('Sociala relationer', 'region'), 'hlv1socaald': ('Sociala relationer', 'age'),
} %}
{% for table, (measure_variable, breakdown) in tables.items() %}
select
    '{{ table }}' as source_table,
    '{{ breakdown }}' as breakdown,
    {{ px_dim(measure_variable) }} as measure_code,
    {% if breakdown == 'region' %}{{ px_dim('Region') }}{% else %}null{% endif %} as region_code,
    {% if breakdown == 'age' %}{{ px_dim('Ålder') }}{% else %}null{% endif %} as age_code,
    {{ px_dim('Kön') }} as sex_code,
    {{ px_dim('År') }} as period_code,
    {{ px_dim('Andel och konfidensintervall') }} as statistic_code,
    {{ px_value(1) }} as value,
    {{ px_marker(1) }} as value_marker,
    filename as source_file
from ({{ pxweb_rows(source('fohm', table)) }})
{% if not loop.last %}union all{% endif %}
{% endfor %}
