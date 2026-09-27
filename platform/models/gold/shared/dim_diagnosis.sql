-- ICD-10 chapters as Försäkringskassan groups them, plus F43, which FK publishes as its
-- own table. F43 sits inside chapter F00-F99; the two must not be added together.
select
    diagnosis_code,
    diagnosis_label,
    case when diagnosis_code = 'ALL' then null else 'ALL' end as parent_diagnosis_code,
    diagnosis_code = 'F00-F99' as is_psychiatric
from {{ ref('stg_fk_diagnosis_chapters') }}
union all
select 'F43', 'F43 Reaktion på svår stress och anpassningsstörningar', 'F00-F99', true
