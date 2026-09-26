-- Population on 31 December. Grain: region x year x sex.
select * from {{ ref('int_welfare_population') }}
