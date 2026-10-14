-- Every law in the selection has passages in silver_sfs_paragraphs.
select s.sfs, s.dok_id
from {{ source('sfs', 'selection') }} as s
left join (select distinct dok_id from {{ ref('silver_sfs_paragraphs') }}) as p
    on p.dok_id = s.dok_id
where p.dok_id is null
