"""How a gold file is serialised and described in semantic-model.json.

Shared by legacy/build_gold.py and the dbt exports in publish/, so a table produces the
same bytes and the same model entry whichever of the two writes it. A subject moving from
one to the other is only done when both agree byte for byte.
"""
import hashlib
import json


def payload(data) -> bytes:
    """Compact JSON with sorted keys and a trailing newline: every gold file's format."""
    return (json.dumps(data, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n").encode("utf-8")


def fingerprint(content: bytes) -> dict:
    return {"sha256": hashlib.sha256(content).hexdigest(), "bytes": len(content)}


def describe(name, records, grain, primary_key, join_columns, source_note, limitations="", content=b""):
    """The semantic-model entry for a table file: grain, keys, observed column kinds, hash."""
    columns = {}
    for record in records:
        for field, value in record.items():
            kind = ("null" if value is None else "boolean" if isinstance(value, bool)
                    else "number" if isinstance(value, (int, float)) else "string" if isinstance(value, str)
                    else "array" if isinstance(value, list) else "object")
            columns.setdefault(field, set()).add(kind)
    return {
        "path": f"tables/{name}.json", "rows": len(records), "grain": grain,
        "primary_key": primary_key, "join_columns": join_columns,
        "columns": {field: sorted(kinds) for field, kinds in columns.items()},
        "source": source_note, "limitations": limitations,
        **fingerprint(content),
    }


def percentage(numerator, denominator):
    """Percent to four decimals, or None without a denominator. Rounded in Python so a
    value computed here and one computed in legacy/ are the same double."""
    return round(100 * numerator / denominator, 4) if denominator else None
