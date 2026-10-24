-- Education and conditions (citizenship, clearance, language) an ad states; listed apart from the class.
with checks as (
    select ad_id, unnest(from_json(checks, '[{"kind": "VARCHAR", "label": "VARCHAR", "quote": "VARCHAR", "line": "INTEGER"}]')) as c
    from {{ ref('stg_job_assistant_matches') }}
)
select ad_id, c.kind, c.label, c.quote, c.line from checks
