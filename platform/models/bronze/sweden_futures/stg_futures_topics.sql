-- One sampled future-marked sentence (id only) × its unsupervised cluster.
select * from {{ source('futures', 'topics') }}
