-- A roll call lists all 349 members, present or not. Three in the source do not (1998/99,
-- 2007/08, 2010/11); they are flagged is_complete = false. More than that means the parser
-- or the source has changed.
select count(*) as incomplete
from {{ ref('fct_roll_call') }}
where not is_complete
having count(*) > 3
