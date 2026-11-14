-- Every listed name belongs to an employer with a legal entity's organisation number (month part
-- of the last ten digits 20 or more); no name of a sole trader with a personal identity number.
select t.period_kind, t.employer_rank
from {{ ref('mart_job_employer_top') }} as t
join {{ ref('dim_employer') }} as e using (employer_name)
group by t.period_kind, t.employer_rank
having not coalesce(bool_or(try_cast(substr(right(regexp_replace(e.organization_number, '[^0-9]', '', 'g'), 10),
    3, 2) as integer) >= 20), false)
