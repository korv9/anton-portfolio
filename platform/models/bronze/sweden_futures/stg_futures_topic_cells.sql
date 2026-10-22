-- Cluster × corpus × year: sentences and the bootstrap interval of the share.
select * from {{ source('futures', 'topic_cells') }}
