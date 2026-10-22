"""SWEDEN E topic pilot: one future-marked sentence per Riksdag speech and DiVA Swedish abstract.

    python -m ml.futures_topics.sentences riksdag            # every session archive not yet read
    python -m ml.futures_topics.sentences diva --from 2005-01
    python -m ml.futures_topics.sentences sample             # RUN/sample.parquet, the pre-registered draw

The unit, filters and draw are fixed in docs/sweden-futures-topics-preregistration.md. Riksdag
archives are streamed once and deleted, as futures_language.py does; DiVA is harvested month by
month of record datestamp with futures_theses.py's rule for the Swedish abstract. Each archive or
month writes candidates/<key>.parquet (document id, year, sentence), so a stopped run resumes.
The candidates stay under warehouse/ml/futures_topics/, which is not pushed. The sample is written
to RUN, under the warehouse features tree, so warehouse_store.py carries it to the R2 store that
the clustering job in .github/workflows/cluster-jobs.yml pulls from. It is never published.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys
import tempfile
from datetime import date
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

REPO = Path(__file__).resolve().parents[2]
for folder in ("platform/ingest/riksdagen", "platform/ingest/diva"):
    sys.path.insert(0, str(REPO / folder))

OUT = Path(os.environ.get("FUTURES_TOPICS_TEXT", REPO / "warehouse/ml/futures_topics"))
FEATURES = Path(os.environ.get("PORTFOLIO_FEATURES", REPO / "warehouse/features")) / "sweden/futures_topics"
RUN = FEATURES / "run"
SEED = 20261022
PER_CELL = 1500
YEARS = {"riksdag": (1994, 2025), "diva": (2005, 2025)}
SPLIT = re.compile(r"(?<=[.!?])\s+|\s*\n\s*")
WORD = re.compile(r"\w+")
SCHEMA = pa.schema([("corpus", pa.string()), ("key", pa.string()), ("doc_id", pa.string()),
                    ("year", pa.int32()), ("sentence_index", pa.int32()), ("sentence", pa.string()),
                    ("deleted", pa.bool_())])


def rank(*parts) -> int:
    return int(hashlib.sha1(":".join(map(str, (SEED, *parts))).encode()).hexdigest()[:15], 16)


def marked_sentence(doc_id: str, text: str, marker) -> tuple[int, str] | None:
    """The marker-matching sentence of 6 to 80 words with the lowest hash, or None."""
    found = [(i, s.strip()) for i, s in enumerate(SPLIT.split(text))
             if marker.search(s) and 6 <= len(WORD.findall(s)) <= 80]
    return min(found, key=lambda f: rank(doc_id, f[0]), default=None)


def write(rows: list[dict], key: str) -> None:
    target = OUT / "candidates" / f"{key}.parquet"
    target.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(pa.Table.from_pylist(rows, schema=SCHEMA), target.with_suffix(".tmp"))
    target.with_suffix(".tmp").replace(target)


def riksdag(marker) -> None:
    from futures_language import sessions, speeches, http_session
    http = http_session()
    for code, url in sessions(http).items():
        key = f"riksdag-{code}"
        if (OUT / "candidates" / f"{key}.parquet").exists():
            continue
        rows = []
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / f"{code}.zip"
            with http.get(url, stream=True, timeout=(30, 300)) as response, path.open("wb") as out:
                response.raise_for_status()
                for chunk in response.iter_content(1 << 20):
                    out.write(chunk)
            seen = set()
            for s in speeches(path):
                if s["id"] in seen or not s["date"][:4].isdigit():
                    continue
                seen.add(s["id"])
                if hit := marked_sentence(s["id"], s["text"], marker):
                    rows.append({"corpus": "riksdag", "key": key, "doc_id": s["id"], "year": int(s["date"][:4]),
                                 "sentence_index": hit[0], "sentence": hit[1], "deleted": False})
        write(rows, key)
        print(f"{key}: {len(seen):,} speeches, {len(rows):,} with a marked sentence", flush=True)


def diva(marker, start: str) -> None:
    from futures_theses import SWEDISH, harvest, swedish
    from harvest import months
    today = date.today()
    current = f"{today.year:04d}-{today.month:02d}"
    for month, first, until in months(start, current):
        key = f"diva-{month}"
        if month == current or (OUT / "candidates" / f"{key}.parquet").exists():
            continue
        rows = []
        for r in {r["id"]: r for r in harvest(first, until)}.values():
            abstract = None
            if not r.get("deleted") and (r.get("language") or "").lower() in SWEDISH and r.get("year"):
                abstract = swedish(r.get("descriptions") or [])
            hit = abstract and marked_sentence(r["id"], abstract, marker)
            # A deleted or changed record without a marked sentence still replaces older versions.
            rows.append({"corpus": "diva", "key": key, "doc_id": r["id"], "year": r.get("year"),
                         "sentence_index": hit[0] if hit else None, "sentence": hit[1] if hit else None,
                         "deleted": not hit})
        write(rows, key)
        print(f"{key}: {len(rows):,} records, {sum(not r['deleted'] for r in rows):,} marked", flush=True)


def sample() -> None:
    """Latest DiVA version per identifier; then per corpus and year the PER_CELL documents with the
    lowest hash, inside the pre-registered years."""
    import duckdb
    frame = duckdb.sql(f"""
        select * from read_parquet('{(OUT / "candidates").as_posix()}/*.parquet')
        qualify row_number() over (partition by corpus, doc_id order by key desc) = 1
    """).df()
    frame = frame[~frame.deleted & frame.sentence.notna()].copy()
    frame["year"] = frame.year.astype(int)
    keep = frame.apply(lambda r: YEARS[r.corpus][0] <= r.year <= YEARS[r.corpus][1], axis=1)
    frame = frame[keep].copy()
    frame["rank"] = [rank(d) for d in frame.doc_id]
    frame = frame.sort_values("rank").groupby(["corpus", "year"], group_keys=False).head(PER_CELL)
    frame["sentence_id"] = [hashlib.sha1(f"{c}:{d}:{i}".encode()).hexdigest()[:16]
                            for c, d, i in zip(frame.corpus, frame.doc_id, frame.sentence_index)]
    frame = frame.sort_values(["corpus", "year", "rank"])[
        ["sentence_id", "corpus", "doc_id", "year", "sentence_index", "sentence"]].reset_index(drop=True)
    RUN.mkdir(parents=True, exist_ok=True)
    frame.to_parquet(RUN / "sample.parquet", index=False)
    print(frame.groupby(["corpus", "year"]).size().unstack(0).to_string())


def main() -> None:
    from futures_language import TERMS, load_terms
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("step", choices=["riksdag", "diva", "sample"])
    parser.add_argument("--from", dest="start", default="2005-01")
    args = parser.parse_args()
    marker = next(p for t, p in load_terms(TERMS)[0] if t == "future")
    if args.step == "riksdag":
        riksdag(marker)
    elif args.step == "diva":
        diva(marker, args.start)
    else:
        sample()


if __name__ == "__main__":
    main()
