-- Nationella folkhälsoenkäten. Grain: indicator x region x period x sex x age group.
-- Periods are pooled four-year spans for counties and single years for age groups.
select * from {{ ref('int_welfare_health_survey') }}
where share_pct is not null or responses is not null
