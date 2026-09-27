select sex_key, name_sv, name_en, sort_order from {{ ref('sexes') }}
