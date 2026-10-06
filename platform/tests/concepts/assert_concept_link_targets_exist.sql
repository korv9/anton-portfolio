-- Every link points at something that exists: a tension, a Riksdag concept or a job-ad term.
select l.*
from {{ ref('mart_concept_links') }} as l
where (l.kind = 'philosophy_tension' and l.target_id not in (select tension_id from {{ ref('dim_tension') }}))
   or (l.kind = 'riksdag_framing' and l.target_id not in (select concept_id from {{ ref('ai_politics_concepts') }}))
   or (l.kind = 'job_term' and l.target_id not in (select term_id from {{ ref('job_ai_governance_terms') }}))
   or (l.kind = 'ai_act_view' and l.target_id not like 'ai-act-%')
