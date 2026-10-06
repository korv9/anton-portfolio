"""Fetch the AI Act and every act related to it from the Publications Office (Cellar).

    python platform/ingest/eu_ai_act/ingest_cellar.py

1. Asks Cellar's SPARQL endpoint which documents amend, correct, consolidate, propose to
   amend or are based on Regulation (EU) 2024/1689, and keeps the answer as it came, one file
   per distinct answer (cellar/related@<sha12>.json): a new amendment or corrigendum shows up
   as a new version, and older answers stay.
2. Fetches the text, as XHTML, of the regulation as published in the Official Journal, of every
   consolidated version Cellar lists, and of every act that amends it: in English and Swedish
   for the regulation and its consolidated versions, in English for amending acts. A CELEX
   number names one published text, so each is a file of its own (acts/<CELEX>.<lang>.xhtml)
   and a new consolidated version never overwrites an older one.
3. Writes cellar/fetched.json: every text attempted, with its status. Cellar does not hold an
   XHTML rendering of every document (the first consolidated version has none); those are
   recorded as unavailable rather than failing the run.

Every file has its provenance line (URL, headers, time, SHA-256) in
warehouse/raw/eu_ai_act/_manifest.jsonl (lib/rawstore.py). Requests are spaced out.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "lib"))
sys.path.insert(0, str(ROOT))

import rawstore  # noqa: E402
from legal import cellar  # noqa: E402

from sources import CELEX, CONSOLIDATED_PREFIX, LANGUAGES  # noqa: E402

SOURCE = "eu_ai_act"
PAUSE = 2.0


def related(http) -> list[dict]:
    query = cellar.related_query(CELEX)
    response = http.get(cellar.SPARQL, params={"query": query}, timeout=120,
                        headers={"Accept": "application/sparql-results+json"})
    response.raise_for_status()
    rawstore.store_version(SOURCE, "cellar/related.json", response.content,
                           url=response.url, headers={"Accept": "application/sparql-results+json"})
    return cellar.parse_related(response.json())


def wanted_texts(rows: list[dict]) -> list[tuple[str, str]]:
    """(CELEX, language) pairs to fetch: the act, its consolidated versions, its amending acts."""
    texts = [(CELEX, lang) for lang in LANGUAGES]
    for row in rows:
        if row["relation"] == "consolidates" and row["celex"].startswith(CONSOLIDATED_PREFIX):
            texts += [(row["celex"], lang) for lang in LANGUAGES]
        elif row["relation"] == "amends":
            texts.append((row["celex"], "en"))
    seen, unique = set(), []
    for item in texts:
        if item not in seen:
            seen.add(item)
            unique.append(item)
    return unique


def main() -> int:
    http = rawstore.session()
    rows = related(http)
    print(f"Related documents in Cellar: {len(rows)}")
    attempts = []
    for celex, lang in wanted_texts(rows):
        url = cellar.text_url(celex)
        headers = cellar.text_headers(lang)
        relative = f"acts/{celex}.{lang}.xhtml"
        try:
            response = http.get(url, headers=headers, timeout=180)
            if response.status_code == 404:
                attempts.append({"celex": celex, "language": lang, "status": "unavailable",
                                 "url": url})
            else:
                response.raise_for_status()
                rawstore.store(SOURCE, relative, response.content, url=url, headers=headers)
                attempts.append({"celex": celex, "language": lang, "status": "fetched",
                                 "url": url, "path": relative})
        except Exception as error:  # one failing text should not stop the others
            attempts.append({"celex": celex, "language": lang, "status": "failed", "url": url,
                             "error": str(error)[:300]})
        rawstore.time.sleep(PAUSE)
    rawstore.store(SOURCE, "cellar/fetched.json",
                   json.dumps(attempts, ensure_ascii=False, indent=1).encode("utf-8"),
                   url="platform/ingest/eu_ai_act/ingest_cellar.py", method="LOCAL")
    for status in ("fetched", "unavailable", "failed"):
        print(f"  {status}: {sum(a['status'] == status for a in attempts)}")
    for a in attempts:
        if a["status"] == "failed":
            print("  failed:", a["celex"], a["language"], a["error"])
    return 1 if any(a["status"] == "failed" for a in attempts) else 0


if __name__ == "__main__":
    sys.exit(main())
