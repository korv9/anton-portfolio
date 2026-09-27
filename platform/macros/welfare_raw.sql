{#
  Readers for PxWeb files in the bronze store. The sources themselves are declared in
  models/bronze/welfare/sources.yml with dbt-duckdb external locations under PORTFOLIO_RAW
  (default ../warehouse/raw, correct when dbt runs from platform/, as the profile assumes).
#}

{#
  One row per PxWeb data row: the file's dimension codes (`dims`), its measure codes
  (`measures`) and the row itself (`cell`). Read by variable code with px_dim() and
  px_value(), never by position: the order differs between tables of one source.
#}
{% macro pxweb_rows(relation) -%}
    select
        filename,
        [c.code for c in columns if c.type <> 'c'] as dims,
        [c.code for c in columns if c.type = 'c'] as measures,
        unnest(data) as cell
    from {{ relation }}
{%- endmacro %}

{% macro px_dim(code) -%}
cell.key[list_position(dims, '{{ code }}')]
{%- endmacro %}

{# Raw text of a measure, by measure code or 1-based position. #}
{% macro px_raw(measure) -%}
{%- if measure is string -%}
cell.values[list_position(measures, '{{ measure }}')]
{%- else -%}
cell.values[{{ measure }}]
{%- endif -%}
{%- endmacro %}

{# PxWeb markers such as '..' (not available) and '.' (not applicable) become NULL. #}
{% macro px_value(measure) -%}
try_cast({{ px_raw(measure) }} as double)
{%- endmacro %}

{# The raw marker when a cell is not a number, so a NULL can be told apart from a gap. #}
{% macro px_marker(measure) -%}
case when try_cast({{ px_raw(measure) }} as double) is null then {{ px_raw(measure) }} end
{%- endmacro %}
