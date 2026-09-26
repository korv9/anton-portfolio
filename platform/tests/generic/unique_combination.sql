{#
  Fails for every combination of `columns` that occurs more than once: the grain test for
  facts whose key is several columns. Equivalent to dbt_utils.unique_combination_of_columns,
  kept local so the project has no package dependency.
#}
{% test unique_combination(model, columns) %}
select {{ columns | join(', ') }}, count(*) as occurrences
from {{ model }}
group by {{ columns | join(', ') }}
having count(*) > 1
{% endtest %}
