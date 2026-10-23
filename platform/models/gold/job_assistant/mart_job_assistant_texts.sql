-- The full public text (contact details redacted) of exactly the detailed ads.
select a.ad_id, a.description, a.text_origin, a.contact_redactions, a.content_hash
from {{ ref('stg_job_assistant_ads') }} as a
join {{ ref('mart_job_assistant_matches') }} as m using (ad_id)
where m.detailed
