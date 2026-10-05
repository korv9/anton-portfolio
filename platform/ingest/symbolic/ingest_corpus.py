"""Fetch the Symbolic Atlas corpus from Project Gutenberg into the bronze store.

    python platform/ingest/symbolic/ingest_corpus.py

Each document in corpus.json is fetched as Gutenberg's plain-text UTF-8 file and stored exactly
as received under warehouse/raw/symbolic/gutenberg/<id>.txt, with its provenance line in
warehouse/raw/symbolic/_manifest.jsonl (lib/rawstore.py). A refetch that returns the same bytes
does not rewrite the file. No cleaning happens here: the text is cleaned in dbt (silver).

The corpus metadata (title, author, tradition) is copied to warehouse/raw/symbolic/corpus.json
next to the texts so the bronze model reads one place.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))

import rawstore  # noqa: E402

HERE = Path(__file__).resolve().parent
SOURCE = "symbolic"
PAUSE = 2.0


def text_url(gutenberg_id: int) -> str:
    return f"https://www.gutenberg.org/cache/epub/{gutenberg_id}/pg{gutenberg_id}.txt"


def main() -> int:
    corpus = json.loads((HERE / "corpus.json").read_text(encoding="utf-8"))["documents"]
    http = rawstore.session()
    fetched, failed = 0, []
    for doc in corpus:
        url = text_url(doc["gutenberg_id"])
        try:
            rawstore.fetch(http, SOURCE, f"gutenberg/{doc['id']}.txt", url, pause=PAUSE)
            fetched += 1
        except Exception as error:  # one failing book should not stop the others
            failed.append(f"{doc['id']}: {error}")
    meta = [dict(doc, source="gutenberg", source_url=text_url(doc["gutenberg_id"]),
                 path=f"gutenberg/{doc['id']}.txt") for doc in corpus]
    rawstore.store(SOURCE, "corpus.json",
                   json.dumps(meta, ensure_ascii=False, indent=1).encode("utf-8"),
                   url="platform/ingest/symbolic/corpus.json", method="LOCAL")
    print(f"Documents attempted: {len(corpus)}, fetched: {fetched}, failures: {len(failed)}")
    for line in failed:
        print("  failed:", line)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
