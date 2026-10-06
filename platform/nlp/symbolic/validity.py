"""What the Symbolic Atlas clusters follow: the symbol, or the book and how it was made?

    python platform/nlp/symbolic/validity.py

Run after experiments.py. For the baseline and the book-centred clusters it measures two things.

1. Association. The adjusted mutual information (AMI, 0 = chance, 1 = identical) between the
   cluster labels of the clustered points and each property of a point: its symbol, book,
   translator, tradition, genre, source type and period. AMI corrects for the number of
   categories, so a property with a hundred books is not favoured over one with five periods.
   A clustering about symbols should score high on symbol and low on the rest.

2. Book pairs. Each book's points spread over the clusters; two books that share a property
   (an English voice, a tradition, a genre, a source type) should not land in more similar
   clusters than two books that share none, unless that property shapes the text. For every
   pair of books with at least MIN_POINTS clustered points, the similarity of their cluster
   distributions (1 - Jensen-Shannon distance, base 2) is averaged by the relation between
   them. The English voice is the cleanest test: one translator or compiler behind several
   unrelated works (Samuel Butler's Iliad and Odyssey, Joseph Jacobs's collections) shows
   whether a voice travels across books. It is the translator when recorded, else the author of
   a retelling, a collection or an English work; unknown voices are left out.

Not measured here: whether an occurrence is literal ("he drank water") or symbolic. That needs
a hand-labelled sample, and none exists yet; the output says so rather than guess.

Writes warehouse/features/symbolic/validity.json.
"""
from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import pipeline  # noqa: E402

EXPERIMENTS = ["baseline", "book_centered"]
FACTORS = ["symbol_id", "document_id", "english_voice", "tradition", "genre", "source_type", "period"]
RELATIONS = ["english_voice", "tradition", "genre", "source_type", "period"]
# Whose English a book is read in: the translator when one is recorded; for a retelling, a
# collection or a work written in English, its author; for a translation whose translator is
# not recorded (the King James Bible, Heimskringla), unknown, and left out of the voice test.
VOICE = ("case when d.translator is not null then d.translator "
         "when d.source_type <> 'translation' and d.author <> 'Anonymous' then d.author end")
MIN_POINTS = 30
OUT = pipeline.FEATURES / "validity.json"


def points(name: str) -> list[dict]:
    import duckdb
    import pyarrow.parquet as pq

    projection = pq.read_table(pipeline.FEATURES / "experiments" / name / "atlas_projection.parquet",
                               columns=["occurrence_id", "cluster_id"]).to_pylist()
    con = duckdb.connect(str(pipeline.DATABASE), read_only=True)
    try:
        meta = {r[0]: r[1:] for r in con.execute(
            "select o.occurrence_id, o.symbol_id, o.document_id, "
            f"coalesce({VOICE}, 'unknown'), d.tradition, d.genre, d.source_type, d.period "
            "from silver.int_symbol_occurrences o join silver.int_symbolic_documents d using (document_id)"
        ).fetchall()}
    finally:
        con.close()
    return [dict(zip(["cluster_id", *FACTORS], [p["cluster_id"], *meta[p["occurrence_id"]]]))
            for p in projection if p["occurrence_id"] in meta]


def association(rows: list[dict]) -> dict:
    from sklearn.metrics import adjusted_mutual_info_score

    clustered = [r for r in rows if r["cluster_id"] != -1]
    labels = [r["cluster_id"] for r in clustered]
    return {f: round(float(adjusted_mutual_info_score(labels, [r[f] for r in clustered])), 4)
            for f in FACTORS}


def js_similarity(p: np.ndarray, q: np.ndarray) -> float:
    m = (p + q) / 2

    def kl(a: np.ndarray, b: np.ndarray) -> float:
        nz = a > 0
        return float((a[nz] * np.log2(a[nz] / b[nz])).sum())

    return 1 - float(np.sqrt(max((kl(p, m) + kl(q, m)) / 2, 0.0)))


def book_pairs(rows: list[dict]) -> dict:
    clustered = [r for r in rows if r["cluster_id"] != -1]
    clusters = sorted({r["cluster_id"] for r in clustered})
    index = {c: i for i, c in enumerate(clusters)}
    counts: dict[str, np.ndarray] = defaultdict(lambda: np.zeros(len(clusters)))
    props: dict[str, dict] = {}
    for r in clustered:
        counts[r["document_id"]][index[r["cluster_id"]]] += 1
        props[r["document_id"]] = {k: r[k] for k in RELATIONS}
    books = sorted(b for b, v in counts.items() if v.sum() >= MIN_POINTS)
    dist = {b: counts[b] / counts[b].sum() for b in books}
    groups: dict[str, list[float]] = defaultdict(list)
    for a, b in combinations(books, 2):
        s = js_similarity(dist[a], dist[b])
        shared = [k for k in RELATIONS if props[a][k] == props[b][k]
                  and not (k == "english_voice" and props[a][k] == "unknown")]
        for k in shared:
            groups[f"same_{k}"].append(s)
        if not shared:
            groups["nothing_shared"].append(s)
        groups["all_pairs"].append(s)
    return {"books": len(books), "min_points": MIN_POINTS,
            "mean_similarity": {g: {"pairs": len(v), "mean": round(float(np.mean(v)), 4)}
                                for g, v in sorted(groups.items())}}


def main() -> int:
    out = {"method": "adjusted mutual information between cluster labels and point properties; "
                     "mean Jensen-Shannon similarity of book cluster distributions by shared property",
           "not_measured": {"literal_vs_symbolic": "needs a hand-labelled sample of occurrences; none exists yet"},
           "experiments": {}}
    for name in EXPERIMENTS:
        rows = points(name)
        out["experiments"][name] = {
            "points": len(rows),
            "clustered": sum(r["cluster_id"] != -1 for r in rows),
            "english_voices": len({r["english_voice"] for r in rows} - {"unknown"}),
            "association_ami": association(rows),
            "book_pairs": book_pairs(rows),
            "books_by_source_type": dict(Counter(r["source_type"] for r in {r["document_id"]: r for r in rows}.values())),
        }
        print(name, json.dumps(out["experiments"][name]["association_ami"]))
    OUT.write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
