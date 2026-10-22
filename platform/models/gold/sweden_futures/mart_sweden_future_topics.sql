-- The futures topic pilot: year × corpus × unsupervised cluster of sampled future-marked sentences
-- (Riksdag speeches and Swedish DiVA abstracts, one sentence per document, at most 1,500 a year per
-- corpus). Cluster -1 is noise and stays in the denominator. Labels stay "unreviewed cluster N"
-- until the owner has reviewed them; the corpora share one embedding space but are never pooled.
with counted as (
    select corpus, year::integer as year, cluster::integer as cluster, count(*) as sentences
    from {{ ref('stg_futures_topics') }}
    group by all
), totals as (
    select corpus, year, sum(sentences) as year_sentences from counted group by all
), labels as (
    -- One row per cluster: the per-corpus rows repeat the cluster's label, terms and stability.
    select cluster::integer as cluster, label, top_terms, stable from {{ ref('stg_futures_topic_clusters') }}
    qualify row_number() over (partition by cluster order by corpus) = 1
)

select
    c.year::integer as year, c.corpus, c.cluster::integer as cluster,
    coalesce(l.label, 'noise') as label, l.top_terms, coalesce(l.stable, false) as stable,
    coalesce(n.sentences, 0) as sentences, t.year_sentences,
    coalesce(n.sentences, 0) / t.year_sentences as share,
    c.share_low, c.share_high, c.run_id
from {{ ref('stg_futures_topic_cells') }} as c
join totals as t on t.corpus = c.corpus and t.year = c.year
left join counted as n on n.corpus = c.corpus and n.year = c.year and n.cluster = c.cluster
left join labels as l on l.cluster = c.cluster
