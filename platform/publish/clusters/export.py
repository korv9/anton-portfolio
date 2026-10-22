"""Write frontend/public/data/clusters/<name>.json from each run's metrics and the gold marts.

    python platform/publish/clusters/export.py            # every clustering below
    python platform/publish/clusters/export.py tax-mix    # one

Runs after the fit scripts and `dbt build --select tag:clusters`. Each file holds the run's
method, `diagnostics` (n, k, noise and largest share, original-space silhouette, bootstrap ARI with
its 5-95 % range, null and p, AMI with the reference labels, status) and run id, plus:
- `members` from gold.mart_cluster_assignments when the run publishes them (entity, period, cluster);
- `shares` from gold.mart_cluster_shares when it has shares over time.
A status of "counter_example" (mean bootstrap ARI under 0.6) or "unvalidated" must not be shown
as a finding. Files over MAX_BYTES stop the export.
"""
from __future__ import annotations

import json
import sys

import duckdb

import stats

NAMES = ["debate-topics", "session-maps", "talk-vote", "municipal-trajectories", "riksdag-eras", "tax-mix",
         "field-language", "labour-market-types", "demand-curves"]
OUT = stats.PUBLIC / "clusters"
MAX_BYTES = 200_000
MEMBER_COLUMNS = ["clustering", "entity_id", "entity_name", "period", "cluster"]
SHARE_COLUMNS = ["period", "segment", "cluster", "share", "low", "high", "passages"]


def table(con, sql: str, columns: list[str], params: list) -> dict:
    rows = con.execute(sql, params).fetchall()
    return {"columns": columns, "rows": [[round(v, 4) if isinstance(v, float) else v for v in r] for r in rows]}


def payload(con, name: str) -> dict:
    metrics = json.loads((stats.FEATURES / name / "run/metrics.json").read_text(encoding="utf-8"))
    out = {"schema_version": 1, **{k: v for k, v in metrics.items() if k not in ("assignments", "members", "shares")}}
    if metrics.get("members"):
        out["members"] = table(con, f"""select {', '.join(MEMBER_COLUMNS)} from gold.mart_cluster_assignments
                                        where clustering in (select unnest(?)) order by all""",
                               MEMBER_COLUMNS, [metrics["assignments"]])
    if metrics.get("shares"):
        out["shares"] = table(con, f"""select {', '.join(SHARE_COLUMNS)} from gold.mart_cluster_shares
                                       where clustering = ? order by all""", SHARE_COLUMNS, [name])
    return out


def main(names: list[str]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with duckdb.connect(str(stats.DATABASE), read_only=True) as con:
        for name in names:
            body = json.dumps(payload(con, name), ensure_ascii=False, separators=(",", ":")) + "\n"
            size = len(body.encode("utf-8"))
            if size > MAX_BYTES:
                raise SystemExit(f"{name}: {size} bytes is over {MAX_BYTES}")
            (OUT / f"{name}.json").write_text(body, encoding="utf-8", newline="\n")
            print(f"clusters/{name}.json {size} bytes")


if __name__ == "__main__":
    main(sys.argv[1:] or NAMES)
