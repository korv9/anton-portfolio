-- Kolada key figures. Grain: indicator x region x year x sex.
select * from {{ ref('int_welfare_kolada') }}
