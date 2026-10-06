{#
  Fails for every non-null value outside [min, max]: shares, similarities, balances.
#}
{% test between(model, column_name, min, max) %}
select {{ column_name }}
from {{ model }}
where {{ column_name }} is not null
  and ({{ column_name }} < {{ min }} or {{ column_name }} > {{ max }})
{% endtest %}
