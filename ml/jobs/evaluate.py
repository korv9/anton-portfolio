def evaluate(embeddings, space, visual, labels, probabilities, jobs, seed=42, feature_vectors=None):
    import numpy as np
    from sklearn.manifold import trustworthiness
    from sklearn.metrics import silhouette_score, adjusted_rand_score
    from .profile import distribution

    rng = np.random.default_rng(seed)
    indices = np.sort(rng.choice(len(labels), min(len(labels), 1500), replace=False))
    mask = labels != -1
    clusters = sorted(set(labels[mask].tolist()))
    selected = np.flatnonzero(mask)
    if len(selected) > 1500:
        selected = np.sort(rng.choice(selected, 1500, replace=False))
    silhouette = None
    embedding_silhouette = None
    if 1 < len(set(labels[selected])) < len(selected):
        silhouette = float(silhouette_score(space[selected], labels[selected]))
        embedding_silhouette = float(silhouette_score(embeddings[selected], labels[selected], metric='cosine'))
    diagnostics = {'dataset_size': len(labels), 'cluster_count': len(clusters),
            'noise_share': float((~mask).mean()),
            'cluster_sizes': distribution(labels.tolist()),
            'mean_cluster_probability': float(probabilities[mask].mean()) if mask.any() else None,
            'silhouette': silhouette, 'silhouette_space': 'higher-dimensional UMAP; noise excluded',
            'embedding_silhouette': embedding_silhouette,
            'embedding_silhouette_space': 'original embeddings, cosine; noise excluded',
            'silhouette_sample_size': len(selected),
            'trustworthiness': float(trustworthiness(embeddings[indices], visual[indices], metric='cosine', n_neighbors=min(10, (len(indices) - 1) // 2))),
            'trustworthiness_sample_size': len(indices),
            'trustworthiness_space': 'original full-text embeddings, cosine',
            'role_adjusted_rand_index': float(adjusted_rand_score(jobs.role_family, labels)),
            'role_crosstab': [{'cluster_id': int(cid), 'roles': distribution(group.role_family.tolist())}
                              for cid, group in jobs.groupby('cluster_id')],
            'limitations': 'Selected software/data roles only. UMAP axes are uninterpretable; global distances and apparent density are not calibrated. Seniority comes from title rules; skills are mentions, not requirements.'}
    if feature_vectors is not None:
        diagnostics['feature_trustworthiness'] = float(trustworthiness(feature_vectors[indices], visual[indices], metric='cosine', n_neighbors=min(10, (len(indices) - 1) // 2)))
        diagnostics['feature_trustworthiness_space'] = 'engineered feature vectors, cosine'
    return diagnostics
