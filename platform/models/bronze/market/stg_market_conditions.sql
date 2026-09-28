-- Ads per month and occupation field by conditions of employment. The 2020-2021 archives
-- write employment type and working hours as upper-case codes (VANLIG_ANSTALLNING, HELTID);
-- later archives write labels (Vanlig anställning, Heltid). Both map to the later labels.
-- Each archive counts only its own period (its year, or its quarter), so an ad that appears
-- in two archives (republished across the turn of a year) is counted once.
with source as (
    select
        cast(publication_month || '-01' as date) as month,
        field_id,
        case upper(replace(coalesce(employment_type, ''), ' ', '_'))
            when 'VANLIG_ANSTÄLLNING' then 'Vanlig anställning'
            when 'VANLIG_ANSTALLNING' then 'Vanlig anställning'
            when 'BEHOVSANSTÄLLNING' then 'Behovsanställning'
            when 'BEHOVSANSTALLNING' then 'Behovsanställning'
            when 'SOMMARJOBB' then 'Sommarjobb / feriejobb'
            when 'SOMMARJOBB_/_FERIEJOBB' then 'Sommarjobb / feriejobb'
            when 'ARBETE_UTOMLANDS' then 'Arbete utomlands'
            when 'FERIEJOBB' then 'Sommarjobb / feriejobb'
            when '' then 'Okänd'
            else employment_type
        end as employment_type,
        -- Part of the 2024 archive gives the duration here ("Tillsvidare", "6 månader eller
        -- längre") instead of the working hours; those count as not stated.
        case upper(coalesce(working_hours, ''))
            when 'HELTID' then 'Heltid'
            when 'DELTID' then 'Deltid'
            else 'Okänd'
        end as working_hours,
        experience_required,
        ads,
        vacancies,
        regexp_extract(filename, '(\d{4}(-Q\d)?)\.parquet$', 1) as archive
    from {{ source('jobtech_market', 'conditions') }}
    where publication_month similar to '\d{4}-\d{2}'
)
select
    month, field_id, employment_type, working_hours, experience_required,
    sum(ads)::bigint as ads,
    sum(vacancies)::bigint as vacancies
from source
where month >= date '2020-01-01'
  and month <= (select max(month) from {{ ref('stg_market_ads') }})
  and (
        case when archive like '%-Q%'
            then year(month) = cast(left(archive, 4) as integer)
             and quarter(month) = cast(right(archive, 1) as integer)
            else year(month) = cast(archive as integer)
        end)
group by all
