"""The cleaning audit and the before/after comparison of symbol occurrences.

    python platform/nlp/symbolic/cleaning_report.py

Reads the cleaned silver documents and occurrences and writes under
warehouse/features/symbolic/:

    cleaning_audit.parquet     one row per document: character counts, share removed, the
                               sections removed, footnote blocks, warnings, cleaning version
    cleaning_comparison.json   occurrence counts before and after cleaning: in total, per
                               document, per symbol and per tradition, and which documents
                               changed

"Before" is occurrences_before_cleaning.parquet, a snapshot of silver.int_symbol_occurrences
taken from the previous cleaning (snapshot() writes it; run it before rebuilding silver). When
there is no snapshot, the comparison says so and reports only the current counts.
"""
from __future__ import annotations

import json
import os
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import pipeline  # noqa: E402

BEFORE = pipeline.FEATURES / "occurrences_before_cleaning.parquet"
AUDIT_COLUMNS = ["document_id", "title", "tradition", "raw_char_count", "body_char_count",
                 "clean_char_count", "removed_char_count", "removed_share", "sections_removed",
                 "footnote_blocks_removed", "cleaning_warnings", "cleaning_version", "word_count"]


def _connect(database: Path):
    import duckdb

    con = duckdb.connect(str(database), read_only=True)
    os.chdir(pipeline.ROOT / "platform")  # the bronze views read raw files relative to platform/
    return con


def snapshot(database: Path = pipeline.DATABASE, path: Path = BEFORE) -> int:
    """Save the current occurrences as the "before" side of the next comparison."""
    con = _connect(database)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        con.execute("copy (select occurrence_id, document_id, symbol_id, tradition from "
                    f"silver.int_symbol_occurrences) to '{path.as_posix()}' (format parquet)")
        return con.execute(f"select count(*) from '{path.as_posix()}'").fetchone()[0]
    finally:
        con.close()


def compare(before: list[tuple[str, str, str]] | None, after: list[tuple[str, str, str]]) -> dict:
    """Counts per document, symbol and tradition before and after, from (document, symbol,
    tradition) rows. `before` None means no snapshot was available."""
    def counts(rows):
        return {"total": len(rows),
                "per_document": dict(sorted(Counter(r[0] for r in rows).items())),
                "per_symbol": dict(sorted(Counter(r[1] for r in rows).items())),
                "per_tradition": dict(sorted(Counter(r[2] for r in rows).items()))}

    now = counts(after)
    if before is None:
        return {"old_occurrence_count": None, "new_occurrence_count": now["total"],
                "removed_occurrences": None, "documents_affected": None, "after": now,
                "limitation": "No snapshot of the occurrences before cleaning was available."}
    then = counts(before)

    def delta(key):
        keys = sorted(set(then[key]) | set(now[key]))
        return {k: {"before": then[key].get(k, 0), "after": now[key].get(k, 0),
                    "change": now[key].get(k, 0) - then[key].get(k, 0)} for k in keys}

    per_document = delta("per_document")
    return {
        "old_occurrence_count": then["total"],
        "new_occurrence_count": now["total"],
        "removed_occurrences": then["total"] - now["total"],
        "documents_affected": sorted(k for k, v in per_document.items() if v["change"]),
        "per_document": per_document,
        "per_symbol": delta("per_symbol"),
        "per_tradition": delta("per_tradition"),
    }


def main() -> int:
    import pyarrow.parquet as pq

    con = _connect(pipeline.DATABASE)
    try:
        audit = con.execute(f"select {', '.join(AUDIT_COLUMNS)} from silver.int_symbolic_documents "
                            "order by document_id").to_arrow_table()
        after = con.execute("select document_id, symbol_id, tradition from silver.int_symbol_occurrences"
                            ).fetchall()
        before = (con.execute(f"select document_id, symbol_id, tradition from '{BEFORE.as_posix()}'")
                  .fetchall() if BEFORE.is_file() else None)
    finally:
        con.close()
    pipeline.FEATURES.mkdir(parents=True, exist_ok=True)
    pq.write_table(audit, pipeline.FEATURES / "cleaning_audit.parquet")
    result = compare(before, after)
    result["cleaning"] = [
        {k: (json.loads(v) if k in ("sections_removed", "cleaning_warnings") else v)
         for k, v in row.items()}
        for row in audit.to_pylist()]
    (pipeline.FEATURES / "cleaning_comparison.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"occurrences {result['old_occurrence_count']} -> {result['new_occurrence_count']}; "
          f"documents affected: {result['documents_affected']}")
    for row in audit.to_pylist():
        print(f"  {row['document_id']:24s} removed {row['removed_share']:.1%}  "
              f"{', '.join(json.loads(row['sections_removed']))}")
    return 0


if __name__ == "__main__":
    if sys.argv[1:] == ["--snapshot"]:
        print(f"{snapshot()} occurrences saved to {BEFORE}")
        sys.exit(0)
    sys.exit(main())
