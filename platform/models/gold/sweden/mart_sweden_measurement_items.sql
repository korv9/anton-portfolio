-- Politics of Measurement: one row per published statistical table (SCB) or key figure
-- (Kolada), classified into the research domains by seeds/sweden/*_domains.csv. Counting
-- these describes what official statistics publish; it says nothing about how important a
-- domain is, and one table is not one indicator.
with scb as (
    select
        t.*,
        coalesce(sub.domain_id, area.domain_id) as domain_id,
        g.region_codes, g.county_codes, g.municipality_codes, g.subarea_codes, g.measures
    from {{ ref('stg_sweden_scb_tables') }} t
    left join {{ ref('scb_subject_domains') }} sub on sub.subject_code = t.subject_code
    left join {{ ref('scb_subject_domains') }} area on area.subject_code = t.subject_area
    left join {{ ref('stg_sweden_scb_geography') }} g using (table_id)
    where t.is_public
),

kolada as (
    select
        k.*,
        case
            when a.domain_id = 'culture'
                 and regexp_matches(lower(k.title), 'idrott|fritid|motion|simhall|badhus|friluft')
                then 'leisure'
            else a.domain_id
        end as domain_id
    from {{ ref('stg_sweden_kolada_kpis') }} k
    left join {{ ref('kolada_area_domains') }} a using (operating_area)
)

select
    'scb' as catalogue,
    table_id as item_id,
    title,
    institution,
    subject_code,
    subject_label,
    domain_id,
    case time_unit
        when 'Monthly' then 'month' when 'Quarterly' then 'quarter'
        when 'Annual' then 'year' else lower(time_unit)
    end as frequency,
    first_year,
    last_year,
    case
        when subarea_codes >= 50 then 'subarea'
        when municipality_codes >= 200 then 'municipality'
        when county_codes >= 15 then 'county'
        else 'national'
    end as geo_resolution,
    last_year >= extract(year from current_date) - 2 as is_current,
    updated_at,
    measures
from scb

union all

select
    'kolada',
    kpi_id,
    title,
    coalesce(institution, 'Kolada (RKA)'),
    operating_area,
    operating_area,
    domain_id,
    'year',
    null,
    null,
    case municipality_type when 'L' then 'county' else 'municipality' end,
    scheduled_period is not null,
    null,
    null
from kolada
