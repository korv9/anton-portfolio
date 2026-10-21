-- The laws kept from configs/workers_ai/sfs_selection.yaml, repealed ones left out.
select * from {{ source('sfs', 'selection') }}
