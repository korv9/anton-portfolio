-- Every cluster of each map variant with its composition (works, traditions, largest-work share,
-- entropy, cross-work flag), representative passages and distinctive words, and its review
-- status. Status is 'unreviewed' unless a person has reviewed the cluster's fingerprint
-- (platform/nlp/philosophy/reviewed_clusters.json). Labels are never generated.
select *, 'derived' as content_type from {{ source('philosophy_features', 'clusters') }}
