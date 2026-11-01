"""Plots of every 2-d map (one palette) and the results table, from tmp/dr-bench.

    python -m ml.experiments.dr_bench.report
"""
from __future__ import annotations

import json

import matplotlib
import numpy as np

from . import data

matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402

PALETTE = {'ai_act': '#1f77b4', 'debates': '#d62728', 'jobs': '#2ca02c', 'laws': '#9467bd',
           'philosophy': '#ff7f0e', 'symbols': '#17becf'}
MAPS = ('umap2', 'tsne2', 'pacmap2', 'localmap2', 'phate2', 'torchdr-umap2')


def draw(ax, xy: np.ndarray, corpus: np.ndarray, title: str) -> None:
    order = np.random.default_rng(0).permutation(len(xy))   # no corpus painted last on top
    ax.scatter(xy[order, 0], xy[order, 1], s=0.6, linewidths=0, alpha=0.6,
               c=[PALETTE[c] for c in corpus[order]], rasterized=True)
    ax.set_title(title, fontsize=10)
    ax.set_xticks([])
    ax.set_yticks([])


def legend(fig) -> None:
    handles = [plt.Line2D([], [], marker='o', ls='', color=c, label=k) for k, c in PALETTE.items()]
    fig.legend(handles=handles, loc='lower center', ncol=6, frameon=False, fontsize=9)


def plots() -> None:
    frame, _, _, _ = data.load(False)
    corpus = frame.corpus.to_numpy()
    found = [(n, np.load(data.path(f'{n}.npy'))) for n in MAPS if data.path(f'{n}.npy').exists()]
    for name, xy in found:
        fig, ax = plt.subplots(figsize=(7, 7.4))
        draw(ax, xy, corpus, f'{name}, 20,000 passages')
        legend(fig)
        fig.savefig(data.path(f'{name}.png'), dpi=130, bbox_inches='tight')
        plt.close(fig)
    cols = 3
    fig, axes = plt.subplots(-(-len(found) // cols), cols, figsize=(5 * cols, 5.2 * -(-len(found) // cols)))
    for ax in axes.flat[len(found):]:
        ax.axis('off')
    for ax, (name, xy) in zip(axes.flat, found):
        draw(ax, xy, corpus, name)
    legend(fig)
    fig.savefig(data.path('grid.png'), dpi=110, bbox_inches='tight')
    plt.close(fig)


def table() -> None:
    rows = sorted(data.path('results').glob('*.json'))
    print('| method | rows | kNN15 | trust | retention ratio | purity | clusters | stable | noise (raw) | '
          'ARI | mixed | DR s (seed 0) | total s | peak GB |')
    print('|' + '---|' * 14)
    for p in rows:
        r = json.loads(p.read_text())
        c = r.get('clustering', {})
        noise = f"{c['noise']:.3f} ({c['noise_raw']:.3f})" if c else ''
        dr = r.get('dr_seconds', [''])[0]
        print(f"| {r['method']}{'-full' if p.stem.endswith('-full') else ''} | {r['rows']} | "
              f"{r.get('knn15', '')} | {r.get('trust', '')} | {r.get('retention_ratio', '')} | "
              f"{r.get('purity', '')} | {c.get('clusters', '')} | {c.get('stable', '')} | {noise} | "
              f"{c.get('ari', '')} | {c.get('mixed', '')} | {dr} | {r['seconds']} | {r['peak_gb']} |")


if __name__ == '__main__':
    plots()
    table()
