-- The full public text (contact details redacted) of every detailed ad and every open, non-duplicate
-- ad. export.py writes the detailed ones to texts.json and the rest to texts-remaining.json.
select a.ad_id, a.description, a.text_origin, a.contact_redactions, a.content_hash,
    coalesce(m.detailed, false) as detailed
from {{ ref('stg_job_assistant_ads') }} as a
join {{ ref('mart_job_assistant_ads') }} as o using (ad_id)
left join {{ ref('mart_job_assistant_matches') }} as m using (ad_id)
where m.detailed or (o.removed_at is null and not o.expired and o.duplicate_of is null)
