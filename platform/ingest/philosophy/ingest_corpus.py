"""Fetch the Philosophy Atlas corpus from Project Gutenberg into the bronze store.

    python platform/ingest/philosophy/ingest_corpus.py

Each work in corpus.json is fetched as Gutenberg's plain-text UTF-8 file and stored exactly as
received under warehouse/raw/philosophy/gutenberg/<id>.txt, with its provenance line in
warehouse/raw/philosophy/_manifest.jsonl (lib/rawstore.py). Requests are spaced out and retried,
since Gutenberg resets connections under load. The corpus metadata (author, year, tradition,
translator) is copied next to the texts. Cleaning happens in dbt (silver).
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))

import rawstore  # noqa: E402

HERE = Path(__file__).resolve().parent
SOURCE = "philosophy"
PAUSE = 6.0
ATTEMPTS = 4


def text_url(gutenberg_id: int) -> str:
    return f"https://www.gutenberg.org/cache/epub/{gutenberg_id}/pg{gutenberg_id}.txt"


def main() -> int:
    corpus = json.loads((HERE / "corpus.json").read_text(encoding="utf-8"))["documents"]
    http = rawstore.session()
    failed = []
    for doc in corpus:
        url = text_url(doc["gutenberg_id"])
        for attempt in range(ATTEMPTS):
            try:
                rawstore.fetch(http, SOURCE, f"gutenberg/{doc['id']}.txt", url, pause=PAUSE)
                break
            except Exception as error:
                if attempt == ATTEMPTS - 1:
                    failed.append(f"{doc['id']}: {error}")
                time.sleep(PAUSE * (attempt + 2))
    meta = [dict(doc, source="gutenberg", source_url=text_url(doc["gutenberg_id"]),
                 path=f"gutenberg/{doc['id']}.txt") for doc in corpus]
    rawstore.store(SOURCE, "corpus.json", json.dumps(meta, ensure_ascii=False, indent=1).encode("utf-8"),
                   url="platform/ingest/philosophy/corpus.json", method="LOCAL")
    print(f"Works attempted: {len(corpus)}, failures: {len(failed)}")
    for line in failed:
        print("  failed:", line)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
