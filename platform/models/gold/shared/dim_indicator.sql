-- Every indicator in fct_indicator: its source, unit, welfare domain and direction, and how
-- it may be aggregated (seeds/welfare/indicator_aggregation.csv; survey indicators follow
-- source-wide rules below). `welfare_dimension` groups indicators as SCB's Nya mått på
-- välfärd does; `domain` is the finer area used on the site.
with indicators as (
select indicator_key, source_key, source_code, indicator_name, unit, domain,
       welfare_dimension, higher_is_better, description
from {{ ref('indicators') }}
union all
select
    'fohm_' || m.topic || '_' || m.measure_code,
    'fohm',
    m.measure_code,
    first(l.measure_label),
    'procent',
    m.domain,
    'social',
    m.higher_is_better,
    'Andel av befolkningen enligt Nationella folkhälsoenkäten. Län: 16-84 år, fyra år sammanslagna.'
from {{ ref('fohm_measures') }} as m
join {{ ref('stg_fohm_measures') }} as l
    on l.measure_code = m.measure_code and l.source_table like 'hlv1' || m.topic || '%'
group by m.topic, m.measure_code, m.domain, m.higher_is_better
union all
select
    'ess_' || variable, 'ess', variable, name_sv,
    'medelvärde ' || scale_min || '-' || scale_max,
    domain, 'social', higher_is_better,
    name_en || '. Viktat medelvärde (pspwght) per land och omgång.'
from {{ ref('ess_variables') }}
union all
select
    'kolada_' || k.kpi_id, 'kolada', k.kpi_id, m.kpi_title,
    null, k.domain, k.welfare_dimension, k.higher_is_better, m.kpi_description
from {{ ref('kolada_kpis') }} as k
join {{ ref('stg_kolada_kpis') }} as m using (kpi_id)
)
select
    i.*,
    coalesce(a.measure_type, case i.source_key when 'fohm' then 'share' when 'ess' then 'mean_score' end)
        as measure_type,
    coalesce(a.time_rule, 'not_aggregable') as time_rule,
    coalesce(a.space_rule, case i.source_key
        when 'fohm' then 'population_weighted_mean'
        when 'ess' then 'recompute_from_microdata' end) as space_rule,
    coalesce(a.weight_indicator, case when i.source_key = 'fohm' then 'scb_population' end)
        as weight_indicator,
    a.components,
    coalesce(a.aggregation_note, case i.source_key
        when 'fohm' then 'Population-weighted survey estimate. County values pool four years and cannot be split into years or added over periods. Across counties a population-weighted mean approximates the national estimate; FoHM publishes the national value, use it.'
        when 'ess' then 'Weighted respondent means. Aggregate only from respondents (silver.int_welfare_ess_answers): pspwght within a country, anweight (pspwght x pweight) when pooling countries. Never average country means.'
    end) as aggregation_note
from indicators as i
left join {{ ref('indicator_aggregation') }} as a using (indicator_key)
