-- The futures topic pilot per cluster × corpus: unreviewed label, c-TF-IDF top terms, stability,
-- the share's linear trend (permutation p, Holm over stable cluster × corpus tests) and, per
-- cluster, the Riksdag-DiVA correlation of differenced yearly shares at lag 0 and at the strongest
-- lag in -3..+3 (Holm over clusters). corpus_specific: 90 % or more of its sentences from one corpus,
-- so never evidence that the corpora share a future. Exploratory until the clusters are reviewed.
select
    cluster::integer as cluster, corpus, label, top_terms, stable, jaccard_min, security_terms, corpus_specific,
    sentences, corpus_sentences, share_mean, trend_slope, trend_p, trend_p_holm,
    r_lag0, p_lag0, p_lag0_holm, best_lag::integer as best_lag, r_best_lag, p_best_lag, p_best_lag_holm,
    r_by_lag, model, revision, run_id
from {{ ref('stg_futures_topic_clusters') }}
