-- The pre-registered stop rule. Riksdag shares are published only when passed is true, and then
-- only for validated foundations.
select * from {{ ref('stg_moral_gate') }}
