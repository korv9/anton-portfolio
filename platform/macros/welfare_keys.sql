{#
  Conformed sex key: T (total), K (women), M (men), from each source's own coding.
  SCB: 1+2, 1, 2 / TotSa. Folkhälsomyndigheten: 00, 01, 02. Försäkringskassan: ALL, K, M.
#}
{% macro welfare_sex_key(column) -%}
case {{ column }}
    when '1+2' then 'T' when 'TotSa' then 'T' when '00' then 'T' when 'ALL' then 'T'
    when '1' then 'M' when '02' then 'M' when 'M' then 'M'
    when '2' then 'K' when '01' then 'K' when 'K' then 'K'
end
{%- endmacro %}
