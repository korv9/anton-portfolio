def cluster(space, min_cluster_size=60, min_samples=5, selection_method='leaf'):
    from hdbscan import HDBSCAN

    if min_cluster_size < 2 or min_cluster_size > len(space):
        raise ValueError('min_cluster_size must be between 2 and dataset size')
    model = HDBSCAN(min_cluster_size=min_cluster_size, min_samples=min_samples,
                    cluster_selection_method=selection_method, core_dist_n_jobs=1)
    labels = model.fit_predict(space)
    return labels, model.probabilities_
