"""Allegora's search over every Swedish law and ordinance in force, as a Cloud Run service.

    POST /search  {"question": "...", "k": 8}  with header X-Allegora-Key
      -> {"index": {...index.json}, "hits": [{id, title, url, text, law, kind, score, stycken}]}
    GET  /health  -> {"n": <passages>}

Loads what sfs_index.py wrote (INDEX, a mounted Cloud Storage folder) once at start, embeds the
question with Vertex AI as RETRIEVAL_QUERY, and ranks every passage by cosine similarity, which is
exact: about 105,000 x 256 multiply-adds per question. A hit is a whole paragraph, at most one per
paragraph and from at most four laws (retrieval.py); score is the cosine of its best passage.
Only the Worker holds the key (ALLEGORA_KEY, from Secret Manager), so no one else can spend the
project's Vertex quota.
"""
from __future__ import annotations

import hmac
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import retrieval  # noqa: E402
import vertex  # noqa: E402

INDEX = Path(os.environ.get("INDEX", "/data/index"))
KEY = os.environ.get("ALLEGORA_KEY", "")
MAX_QUESTION, MAX_K = 500, 8


def load(folder: Path) -> tuple[dict, retrieval.Lines, np.ndarray]:
    meta = json.loads((folder / "index.json").read_text(encoding="utf-8"))
    passages = retrieval.Lines((folder / "passages.jsonl").read_bytes())
    vectors = np.frombuffer((folder / "vectors.f16").read_bytes(), dtype=np.float16)
    vectors = vectors.reshape(len(passages), meta["dims"]).astype(np.float32)
    return meta, passages, vectors


def top(vectors: np.ndarray, paragraphs: retrieval.Paragraphs, query: np.ndarray,
        k: int) -> list[dict]:
    scores = vectors @ (query / np.linalg.norm(query))
    return [paragraphs.whole(p, scores, s) for p, s in retrieval.rank(scores, paragraphs, k)]


class Handler(BaseHTTPRequestHandler):
    def reply(self, status: int, body: dict) -> None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:  # noqa: N802
        self.reply(200, {"n": len(PASSAGES)} if self.path == "/health" else {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/search":
            return self.reply(404, {"error": "not found"})
        if not KEY or not hmac.compare_digest(self.headers.get("X-Allegora-Key", ""), KEY):
            return self.reply(401, {"error": "key"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(min(length, 4096)))
            question = str(body["question"]).strip()
            k = min(max(int(body.get("k", MAX_K)), 1), MAX_K)
        except (ValueError, KeyError, TypeError):
            return self.reply(400, {"error": "question"})
        if not question or len(question) > MAX_QUESTION:
            return self.reply(400, {"error": "question"})
        try:
            query = np.asarray(vertex.embed([question], "RETRIEVAL_QUERY")[0], dtype=np.float32)
        except RuntimeError as error:
            print(error, file=sys.stderr)
            return self.reply(503, {"error": "embedding"})
        self.reply(200, {"index": META, "hits": top(VECTORS, PARAGRAPHS, query, k)})


if __name__ == "__main__":
    META, PASSAGES, VECTORS = load(INDEX)
    PARAGRAPHS = retrieval.Paragraphs(PASSAGES)
    print(f"loaded {len(PASSAGES)} passages from {INDEX}", flush=True)
    ThreadingHTTPServer(("", int(os.environ.get("PORT", "8080"))), Handler).serve_forever()
