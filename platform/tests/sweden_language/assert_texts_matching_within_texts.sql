-- A category is never used by more distinct texts than a cell has, by length band or by mix.
select 'bands' as mart, year, category, texts, texts_matching
from {{ ref('mart_sweden_job_language_bands') }}
where texts_matching > texts or texts_matching < 0
union all
select 'mix', year, category, texts, texts_matching
from {{ ref('mart_sweden_job_language_mix') }}
where texts_matching > texts or texts_matching < 0
