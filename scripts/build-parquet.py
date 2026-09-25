"""Build the Parquet marts the browser queries directly.

Member votes are the first one. They exist today only inside 1,438 per-decision shards, so
answering "how did this party's members vote on this point" means downloading a whole
document. As one Parquet file partitioned by session, DuckDB-WASM can read just the row
groups a filter touches, over HTTP range requests.

Shards are read through delivery.py, so this works whether or not they are still local.
"""
import json
from concurrent.futures import ThreadPoolExecutor

import duckdb
import pyarrow as pa
import pyarrow.parquet as pq

import delivery
from common import POLITICS, PUBLIC

OUT = PUBLIC / "parquet"

SCHEMA = pa.schema([
    ("vote_id", pa.string()),
    ("session", pa.string()),
    ("designation", pa.string()),
    ("point", pa.int32()),
    ("vote_date", pa.string()),
    ("title", pa.string()),
    ("committee", pa.string()),
    ("member_id", pa.string()),
    ("member_name", pa.string()),
    ("party", pa.string()),
    ("vote", pa.string()),
])


def decision_rows(entry):
    """One row per member vote in a decision, carrying the decision's identity."""
    detail = json.loads(delivery.read_bytes("politics/" + entry["path"]))
    first = detail["parties"][0] if detail["parties"] else {}
    common = {
        "vote_id": first.get("vote_id", entry["id"]),
        "session": first.get("session"),
        "designation": entry.get("designation"),
        "point": entry.get("point"),
        "vote_date": first.get("vote_date", entry.get("date")),
        "title": entry.get("title"),
        "committee": entry.get("committee"),
    }
    return [{**common,
             "member_id": member["member_id"],
             "member_name": member["member_name"],
             "party": member["party"],
             "vote": member["vote"]}
            for member in detail["members"]]


def build_member_votes():
    OUT.mkdir(parents=True, exist_ok=True)
    written = []
    for index in sorted((POLITICS / "decisions").glob("*/index.json")):
        slug = index.parent.name
        decisions = json.loads(index.read_text(encoding="utf-8-sig"))
        with ThreadPoolExecutor(max_workers=16) as pool:
            batches = list(pool.map(decision_rows, decisions))
        rows = [row for batch in batches for row in batch]
        path = OUT / f"fact_member_vote/session={slug}/part-0.parquet"
        path.parent.mkdir(parents=True, exist_ok=True)
        # ZSTD over the default snappy: these columns are extremely repetitive, and a smaller
        # file means fewer bytes per range request in the browser.
        pq.write_table(pa.Table.from_pylist(rows, schema=SCHEMA), path,
                       compression="zstd", row_group_size=20000)
        written.append((slug, len(rows), path.stat().st_size))
    return written


def main():
    written = build_member_votes()
    total_rows = sum(rows for _, rows, _ in written)
    total_bytes = sum(size for _, _, size in written)
    for slug, rows, size in written:
        print(f"  session={slug}  {rows:>7} rows  {size / 1048576:>6.2f} MB")
    print(f"fact_member_vote: {total_rows} rows, {total_bytes / 1048576:.2f} MB")

    # Prove the file answers the prototype's question before anything ships.
    connection = duckdb.connect()
    sample = connection.execute(
        f"select party, vote, count(*) n from read_parquet('{OUT}/fact_member_vote/**/*.parquet') "
        "where designation = 'MJU3' and point = 2 group by 1, 2 order by 1, 2 limit 5").fetchall()
    print("sample query:", sample)


if __name__ == "__main__":
    main()
