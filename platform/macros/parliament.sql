{#
  One spelling per party across sources and decades. Folkpartiet became Liberalerna (L) in
  2015 and KDS became KD in 1996; SCB, PSU and the roll-call files use all of these. An
  independent member is '-'. Anything else, such as small parties in election tables, is kept
  as written and grouped by the models that need it.
#}
{% macro parliament_party(expression) -%}
case upper(trim({{ expression }}))
    when 'FP' then 'L'
    when 'KDS' then 'KD'
    when '' then '-'
    when '-' then '-'
    else upper(trim({{ expression }}))
end
{%- endmacro %}

{# '1993/94' from '199394', '1999/2000' from '19992000', anything already written with a slash unchanged. #}
{% macro parliament_session(expression) -%}
case
    when regexp_matches({{ expression }}, '^\d{6}$')
        then substr({{ expression }}, 1, 4) || '/' || substr({{ expression }}, 5, 2)
    when regexp_matches({{ expression }}, '^\d{8}$')
        then substr({{ expression }}, 1, 4) || '/' || substr({{ expression }}, 5, 4)
    else {{ expression }}
end
{%- endmacro %}
