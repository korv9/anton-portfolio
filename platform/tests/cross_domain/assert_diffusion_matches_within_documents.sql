-- A term never matches more documents than the month holds.
select * from {{ ref('mart_ai_act_term_diffusion') }} where matches > documents
