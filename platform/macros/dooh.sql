{# The dooh subject's station key: a station name lowercased with every character other than
   a letter removed, so "MÖRBY CENTRUM", "Mörby centrum" and "Midsommar-kransen" match GTFS. #}
{% macro dooh_name_key(column) -%}
regexp_replace(lower({{ column }}), '[^a-zåäöéü]', '', 'g')
{%- endmacro %}
