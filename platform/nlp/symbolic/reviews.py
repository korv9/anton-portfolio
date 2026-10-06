"""The human review of Symbolic Atlas clusters: reading, checking and publishing it.

reviewed_clusters.json (next to this file) is edited by hand and never written by code. It
holds one entry per cluster a person has looked at:

    {
      "experiment": "book_centered",
      "clusters": {
        "17": {
          "fingerprint": "3f2a…",            # from review/cluster_candidates.parquet
          "status": "reviewed",               # unreviewed | candidate | reviewed | rejected
          "label": "Threshold / passage",
          "description": "Contexts involving movement across boundaries …",
          "interpretation": "Why this cluster matters, in a few sentences.",
          "confidence": "medium",             # low | medium | high
          "reviewed_by": "human",
          "notes": "Private to the review; never published."
        }
      }
    }

Cluster numbers change whenever anything upstream changes, so an entry is matched to the
current run by its fingerprint (the hash of the cluster's member ids), not its number. An
entry whose fingerprint no longer matches any cluster is stale: it is reported and ignored,
never published under a cluster it did not review.

Only status "reviewed" with a label is public. Nothing here invents a label.
"""
from __future__ import annotations

import json
from pathlib import Path

FILE = Path(__file__).resolve().parent / "reviewed_clusters.json"
STATUSES = {"unreviewed", "candidate", "reviewed", "rejected"}
CONFIDENCE = {"low", "medium", "high"}
PUBLIC_FIELDS = ("label", "description", "interpretation", "confidence")


class ReviewError(ValueError):
    pass


def validate(data: dict) -> dict:
    """The parsed review file, checked: known statuses, and a reviewed entry has a fingerprint,
    a label, a description and a confidence."""
    if not isinstance(data.get("clusters", {}), dict):
        raise ReviewError("clusters must be an object keyed by cluster id")
    for key, entry in data.get("clusters", {}).items():
        status = entry.get("status", "unreviewed")
        if status not in STATUSES:
            raise ReviewError(f"cluster {key}: unknown status {status!r}")
        if status in ("reviewed", "rejected") and not entry.get("fingerprint"):
            raise ReviewError(f"cluster {key}: a {status} cluster needs its fingerprint")
        if status == "reviewed":
            for field in ("label", "description", "confidence"):
                if not str(entry.get(field, "")).strip():
                    raise ReviewError(f"cluster {key}: a reviewed cluster needs a {field}")
            if entry["confidence"] not in CONFIDENCE:
                raise ReviewError(f"cluster {key}: confidence must be one of {sorted(CONFIDENCE)}")
    return data


def load(path: Path = FILE) -> dict:
    if not path.is_file():
        return {"experiment": "book_centered", "clusters": {}}
    return validate(json.loads(path.read_text(encoding="utf-8")))


def by_fingerprint(data: dict) -> dict[str, dict]:
    return {e["fingerprint"]: {**e, "reviewed_cluster_key": k}
            for k, e in data.get("clusters", {}).items() if e.get("fingerprint")}


def stale(data: dict, fingerprints: set[str]) -> list[str]:
    """Keys of entries whose fingerprint matches no current cluster."""
    return sorted(k for k, e in data.get("clusters", {}).items()
                  if e.get("fingerprint") and e["fingerprint"] not in fingerprints)


def public(data: dict, fingerprints: dict[str, int]) -> list[dict]:
    """The reviewed clusters that may be shown, matched to current cluster ids by fingerprint:
    status reviewed, a label, and a fingerprint present in this run. Notes stay private."""
    out = []
    for entry in data.get("clusters", {}).values():
        if entry.get("status") != "reviewed" or entry.get("fingerprint") not in fingerprints:
            continue
        out.append({"cluster_id": fingerprints[entry["fingerprint"]],
                    "fingerprint": entry["fingerprint"],
                    **{k: entry.get(k) for k in PUBLIC_FIELDS}})
    return sorted(out, key=lambda e: e["cluster_id"])
