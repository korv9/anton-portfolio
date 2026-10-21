-- Every document in Riksdagen's SFS list as ingest.py --all wrote it, repealed ones included.
select * from {{ source('sfs', 'catalogue') }}
