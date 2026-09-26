-- Every indicator in fct_indicator: its source, unit, welfare domain and direction.
-- `welfare_dimension` groups indicators as SCB's Nya mått på välfärd does (economic,
-- social, environmental); `domain` is the finer area used on the site.
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
