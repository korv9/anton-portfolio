"""Allegora's search variants compared on the local index (docs/allegora-gcp.md).

    python search_compare.py --index ../../../tmp/allegora-index

Asks the Swedish eval questions (configs/workers_ai/eval_questions.yaml, corpus sfs), the two
reference questions and a few questions about something else, and prints per variant recall@8
on the paragraph, the share of ordinances, laws per answer and the best cosine. The question
vectors come from Vertex once (VERTEX_ACCESS_TOKEN) and are kept in --cache.
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from pathlib import Path

import numpy as np
import yaml

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import retrieval  # noqa: E402
import search_service  # noqa: E402
import vertex  # noqa: E402

ROOT = HERE.parents[2]
REFERENCE = [
    ("Får min hyresvärd gå in i min lägenhet när jag inte är hemma?", ["sfs-1970-994-12-26"]),
    ("Får min hyresvärd höja hyran hur som helst?", []),
]
# Not about law: the best cosine these reach is the floor for "nothing found".
ELSEWHERE = [
    "Hur bakar man surdegsbröd?",
    "Vem vann fotbolls-VM 2018?",
    "Hur högt är Eiffeltornet?",
    "Kan du rekommendera en bra film?",
    "Vilken färg har en flamingo?",
    "Hur byter jag däck på cykeln?",
]


def questions() -> list[tuple[str, list[str]]]:
    data = yaml.safe_load((ROOT / "configs/workers_ai/eval_questions.yaml").read_text("utf-8"))
    return [(q["question"], q["expected"]) for q in data["questions"] if q["corpus"] == "sfs"] \
        + REFERENCE


def vectors(texts: list[str], cache: Path) -> dict[str, list[float]]:
    known = json.loads(cache.read_text("utf-8")) if cache.exists() else {}
    missing = [t for t in texts if t not in known]
    if missing:
        known |= dict(zip(missing, vertex.embed(missing, "RETRIEVAL_QUERY")))
        cache.write_text(json.dumps(known, ensure_ascii=False), "utf-8")
    return known


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--index", type=Path, required=True)
    parser.add_argument("--cache", type=Path, default=ROOT / "tmp/allegora-queries.json")
    parser.add_argument("--out", type=Path,
                        default=ROOT / "warehouse/features/workers_ai/eval/sfs-all-search.json")
    args = parser.parse_args()
    _, passages, matrix = search_service.load(args.index)
    started = time.perf_counter()
    paragraphs = retrieval.Paragraphs(passages)
    print(f"{len(paragraphs.members)} paragraphs grouped in {time.perf_counter() - started:.2f} s")
    started = time.perf_counter()
    lexical = retrieval.Lexical(passages)
    print(f"FTS5 built in {time.perf_counter() - started:.2f} s")
    asked = questions()
    known = vectors([q for q, _ in asked] + ELSEWHERE, args.cache)
    ordinance = np.array([p["kind"] == "förordning" for p in passages])

    def variant(question: str, name: str) -> list[dict]:
        query = np.asarray(known[question], dtype=np.float32)
        scores = matrix @ (query / np.linalg.norm(query))
        if name == "vector":  # today's search: the eight best passages
            best = np.argsort(-scores)[:8]
            return [passages[i] | {"paragraph": retrieval.paragraph_key(passages[i]),
                                   "score": float(scores[i])} for i in best]
        if name.endswith("-down"):
            scores = scores - 0.02 * ordinance
        order = retrieval.fused(scores, lexical.search(question)) if "fts" in name else None
        laws = retrieval.MAX_LAWS if "cap" in name else 99
        return [paragraphs.whole(p, scores, s) | {"paragraph": paragraphs.whole(p, scores, s)["id"]}
                for p, s in retrieval.rank(scores, paragraphs, 8, laws, order)]

    names = ["vector", "paragraph", "paragraph-cap", "paragraph-cap-down", "fts-paragraph-cap"]
    report: dict = {"variants": {}, "elsewhere_best": {}}
    for name in names:
        rows = []
        for question, expected in asked:
            hits = variant(question, name)
            rows.append({
                "question": question,
                "found": any(h["paragraph"] in expected for h in hits) if expected else None,
                "laws": len({h["law"] for h in hits}),
                "ordinances": sum(h["kind"] == "förordning" for h in hits),
                "paragraphs": len({h["paragraph"] for h in hits}),
                "best": round(max(h["score"] for h in hits), 4),
                "hits": [[h["paragraph"], round(h["score"], 4)] for h in hits],
            })
        judged = [r for r in rows if r["found"] is not None]
        summary = {
            "recall_at_8": f"{sum(r['found'] for r in judged)}/{len(judged)}",
            "found": [int(r["found"]) for r in judged],
            "ordinance_share": round(sum(r["ordinances"] for r in rows) / (8 * len(rows)), 3),
            "laws_median": statistics.median(r["laws"] for r in rows),
            "laws_max": max(r["laws"] for r in rows),
        }
        report["variants"][name] = summary | {"rows": rows}
        print(f"{name:20} {json.dumps(summary)}")
    for question in ELSEWHERE:
        query = np.asarray(known[question], dtype=np.float32)
        report["elsewhere_best"][question] = round(float(np.max(matrix @ (query / np.linalg.norm(query)))), 4)
    legal = [r["best"] for r in report["variants"]["vector"]["rows"]]
    print("best cosine, law questions:", sorted(legal))
    print("best cosine, elsewhere:", sorted(report["elsewhere_best"].values()))
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=1), "utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
