-- The analytical tensions (seeds/philosophy/tensions.csv): two poles, the anchor sentence each
-- pole is embedded from, and what the lens asks. Lenses, not objective axes. Interpretation.
select *, 'interpretation' as content_type from {{ ref('tensions') }}
