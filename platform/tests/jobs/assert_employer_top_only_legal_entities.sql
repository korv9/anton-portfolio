-- Every listed employer is a legal entity: the month part (third and fourth of the last ten digits)
-- of its own organisation number is 20 or more. Joined on employer_id, so a sole trader with a
-- personal identity number cannot pass on a legal entity's name.
select t.period_kind, t.employer_rank, t.employer_id
from {{ ref('mart_job_employer_top') }} as t
left join {{ ref('dim_employer') }} as e using (employer_id)
where coalesce(try_cast(substr(right(regexp_replace(e.organization_number, '[^0-9]', '', 'g'), 10), 3, 2)
    as integer) >= 20, false) = false
