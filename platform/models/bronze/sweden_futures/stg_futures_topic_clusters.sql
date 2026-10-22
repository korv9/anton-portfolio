-- Cluster × corpus: unreviewed label, top terms, stability and test statistics.
select * from {{ source('futures', 'topic_clusters') }}
