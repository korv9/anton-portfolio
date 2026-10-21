-- Sampled occurrence: UMAP position and HDBSCAN cluster (-1 is noise).
select * from {{ source('symbolic_features', 'atlas_projection') }}
