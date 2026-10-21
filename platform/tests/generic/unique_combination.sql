{#
  Fails for every combination of `columns` that occurs more than once, and for every row
  with a null in one of them: the grain test for facts whose key is several columns.
  Equivalent to dbt_utils.unique_combination_of_columns plus not_null on each column,
  kept local so the project has no package dependency. `nullable` names key columns where
  a null is a real value (not stated, no committee); the model's schema says why. Nulls
  still group together, so a null there is still checked for duplicates.
#}
{% test unique_combination(model, columns, nullable=[]) %}
{%- set required = columns | reject('in', nullable) | list %}
select {{ columns | join(', ') }}, count(*) as occurrences
from {{ model }}
group by {{ columns | join(', ') }}
having count(*) > 1
{%- if required %}
    or {{ required | join(' is null or ') }} is null
{%- endif %}
{% endtest %}
