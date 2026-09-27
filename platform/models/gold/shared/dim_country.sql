select country_code, country_name_sv, country_name_en, is_nordic, is_eu27
from {{ ref('ess_countries') }}
