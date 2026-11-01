"""Run one benchmark method in its own process and write its metrics.

    python -m ml.experiments.dr_bench.run umap10 [--full]

Writes tmp/dr-bench/results/<method>[-full].json, 10-d embeddings and labels under emb/, and
2-d maps as tmp/dr-bench/<method>[-full].npy. Rules: tmp/dr-bench/RULES.md.
"""
from __future__ import annotations

import argparse
import json
import time

import numpy as np
import psutil

from ml.atlas import build

from . import data, methods
from . import metrics as m

SEEDS = (0, 1, 2)


def reference(x: np.ndarray, queries: np.ndarray, full: bool) -> np.ndarray:
    path = data.path(f'knn384{"-full" if full else ""}.npy')
    if not path.exists():
        np.save(path, m.neighbours(x, queries, euclid=False))
    return np.load(path)


def baseline(frame, x, full: bool) -> dict:
    """Aligned-384 retention and purity on the same rows, cached."""
    path = data.path(f'aligned{"-full" if full else ""}.json')
    if not path.exists():
        path.write_text(json.dumps({'retention': m.retention(frame, x, False),
                                    'purity': m.purity(frame, x, False)}))
    return json.loads(path.read_text())


def cached_umap(full: bool, name: str) -> tuple[list[np.ndarray] | None, np.ndarray | None]:
    """Production seeds 0-2 and map at full size, reused instead of rerun (RULES.md)."""
    if not full or name not in ('umap10', 'umap2'):
        return None, None
    saved = np.load(build.WORK / f'clusters-v2-whiten-ledoit-wolf-{build.MIN_CLUSTER}-{build.MIN_SAMPLES}.npz')
    return list(saved['runs'][:3]), saved['flat']


def embeddings(name: str, x: np.ndarray, full: bool, out: dict) -> list[np.ndarray]:
    tag = '-full' if full else ''
    if name == 'umap10-plscan':   # reuses the umap10 embeddings
        return [np.load(data.path(f'emb/umap10{tag}-s{s}.npy')) for s in SEEDS]
    seeds = SEEDS if name in methods.TEN else (0,)
    knn, ys = None, []
    for s in seeds:
        started = time.time()
        if name == 'umap10-pre' and knn is None:
            knn = methods.exact_knn(x)
            out['knn_seconds'] = round(time.time() - started, 1)
        ys.append(methods.reduce(name, x, s, knn))
        out.setdefault('dr_seconds', []).append(round(time.time() - started, 1))
        print(name, 'seed', s, out['dr_seconds'][-1], 's', flush=True)
        target = data.path(f'emb/{name}{tag}-s{s}.npy') if name in methods.TEN else data.path(f'{name}{tag}.npy')
        target.parent.mkdir(exist_ok=True)
        np.save(target, ys[-1].astype(np.float32))
    return ys


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('method')
    parser.add_argument('--full', action='store_true')
    args = parser.parse_args()
    name, full = args.method, args.full
    started = time.time()
    frame, x, queries, trust_rows = data.load(full)
    size = (build.MIN_CLUSTER, build.MIN_SAMPLES) if full else (40, 5)
    out = {'method': name, 'rows': len(x), 'min_cluster_size': size[0], 'min_samples': size[1]}
    base = baseline(frame, x, full)
    if name == 'evoc':
        runs = []
        for s in SEEDS:
            t = time.time()
            labels, layers = methods.evoc_labels(x, s)
            runs.append(labels)
            out.setdefault('dr_seconds', []).append(round(time.time() - t, 1))
            if s == 0:
                out['layers'] = layers
        out['clustering'] = m.clustering(frame, runs)
    else:
        cached_runs, flat = cached_umap(full, name)
        runs, ys = None, None
        if name == 'umap10' and cached_runs is not None:
            runs = cached_runs
            out['note'] = 'labels from the production cache; its 10-d embeddings were not kept, so a, c, d are absent'
        elif name == 'umap2' and flat is not None:
            ys = [flat]
            np.save(data.path('umap2-full.npy'), flat.astype(np.float32))
        else:
            ys = embeddings(name, x, full, out)
        if ys is not None:
            y = ys[0].astype(np.float32)
            out['knn15'] = m.knn_overlap(reference(x, queries, full), m.neighbours(y, queries, True))
            out['trust'] = m.trust(x, y, trust_rows)
            out['retention'] = m.retention(frame, y, True)
            out['retention_ratio'] = m.ratio(out['retention'], base['retention'])
            out['purity'] = m.purity(frame, y, True)
        if name in methods.TEN or name == 'umap10-plscan':
            if runs is None:
                cluster = methods.plscan_labels if name == 'umap10-plscan' else methods.hdbscan_labels
                t = time.time()
                runs = [cluster(y, *size) for y in ys]
                out['cluster_seconds'] = round(time.time() - t, 1)
                np.save(data.path(f'emb/{name}{"-full" if full else ""}-labels.npy'), np.stack(runs))
            out['clustering'] = m.clustering(frame, runs)
    out['aligned'] = base
    out['seconds'] = round(time.time() - started, 1)
    out['peak_gb'] = round(psutil.Process().memory_info().peak_wset / 2 ** 30, 2)
    if name.startswith('torchdr'):
        import torch
        out['gpu_peak_gb'] = round(torch.cuda.max_memory_allocated() / 2 ** 30, 2)
    path = data.path(f'results/{name}{"-full" if full else ""}.json')
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(out, indent=1))
    print(json.dumps(out), flush=True)


if __name__ == '__main__':
    main()
