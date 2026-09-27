{#
  Use a model's configured schema as is (bronze, silver, gold, seeds) instead of dbt's
  default <target>_<schema>, so scripts and dashboards address `gold.fct_indicator`
  whatever the target is called.
#}
{% macro generate_schema_name(custom_schema_name, node) -%}
    {{ custom_schema_name | trim if custom_schema_name else target.schema }}
{%- endmacro %}
