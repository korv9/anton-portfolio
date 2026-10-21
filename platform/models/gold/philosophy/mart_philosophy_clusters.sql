-- Every cluster of each map variant with its composition (works, traditions, largest-work share,
-- entropy, cross-work flag), representative passages and distinctive words, and its review
-- status. Status is 'unreviewed' unless a person has reviewed the cluster's fingerprint
-- (platform/nlp/philosophy/reviewed_clusters.json). Labels are never generated.
-- review_label is cast: while no cluster is reviewed the parquet column is all null and untyped.
select * replace (cast(review_label as varchar) as review_label), 'derived' as content_type
from {{ ref('stg_philosophy_clusters') }}
