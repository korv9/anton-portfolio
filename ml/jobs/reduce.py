def reduce(embeddings, neighbors=30, dimensions=5, seed=42, cluster_min_dist=0., visual_min_dist=.08):
    import numpy as np
    from umap import UMAP

    neighbors = min(neighbors, len(embeddings) - 1)
    dimensions = min(dimensions, len(embeddings) - 2)
    shared = dict(n_neighbors=neighbors, metric='cosine', random_state=seed, n_jobs=1, init='random')
    space = UMAP(n_components=dimensions, min_dist=cluster_min_dist, **shared).fit_transform(embeddings)
    visual = UMAP(n_components=2, min_dist=visual_min_dist, **shared).fit_transform(embeddings)
    if not np.isfinite(space).all() or not np.isfinite(visual).all():
        raise ValueError('UMAP produced nonfinite coordinates')
    return space, visual
