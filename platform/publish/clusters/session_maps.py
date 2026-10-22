"""The 33 per-session speech maps as one index (clustering plan section 2.3): no new clustering.

    python platform/publish/clusters/session_maps.py

Each politics/parliament/sessions/<s>/umap.json already holds up to 400 speech chunks with a 2D
UMAP position, topic and party. This writes features/clusters/session-maps: per session the file,
its chunk count, topics, unassigned share and largest topics, and per chunk its topic (for the
mart). The topic ids and labels are checked to mean the same in every session (one topic model),
so a slicer over sessions compares like with like. The published maps carry no vectors, so no
silhouette or refit is possible here; the export is marked unvalidated and its 2D distances are
a picture, not a measurement.
"""
from __future__ import annotations

from collections import Counter
import json

import pandas as pd

import stats

SESSIONS = stats.PUBLIC / "politics/parliament/sessions"


def main() -> None:
    rows, index, labels = [], [], {}
    for path in sorted(SESSIONS.glob("*/umap.json")):
        data = json.loads(path.read_text(encoding="utf-8"))["data"]
        for r in data:
            if labels.setdefault(r["topic_id"], r["topic_label"]) != r["topic_label"]:
                raise SystemExit(f"Topic {r['topic_id']} has two labels; the sessions use different models")
        topics = Counter(r["topic_id"] for r in data)
        assigned = sum(v for t, v in topics.items() if t >= 0)
        index.append({"session": data[0]["session"], "path": path.relative_to(stats.PUBLIC).as_posix(),
                      "chunks": len(data), "speeches": data[0].get("session_population"),
                      "topics": len([t for t in topics if t >= 0]),
                      "unassigned_share": round(topics.get(-1, 0) / len(data), 4),
                      "top_topics": [[t, round(n / max(assigned, 1), 4)] for t, n in topics.most_common() if t >= 0][:5]})
        rows += [(r["chunk_id"], r["party"], r["session"], r["topic_id"]) for r in data]
    frame = pd.DataFrame(rows, columns=["chunk_id", "party", "session", "topic_id"])
    cluster = frame.topic_id.to_numpy()
    diagnostics = stats.diagnostics(
        cluster, None, None, None, {"party": stats.ami(cluster, frame.party.tolist())},
        note="A picture, not a measurement. The maps carry no vectors: silhouette and stability cannot be computed from them, "
             "and a silhouette in the 2D map space is not a measure of quality.")
    metrics = {"title": "Same parliament, 33 maps",
               "method": {"features": "speech chunks of the parliament-current topic model",
                          "layout": "UMAP 2D per session (picture only)", "sample": "up to 400 chunks per session"},
               "diagnostics": diagnostics,
               "clusters": [{"id": t, "name": labels[t], "size": int((cluster == t).sum())} for t in sorted(labels)],
               "sessions": index, "assignments": ["session-maps"], "members": False, "shares": False}
    assignments = stats.frame("session-maps", frame.chunk_id, frame.party, frame.session, cluster)
    stats.save("session-maps", frame, assignments, metrics)


if __name__ == "__main__":
    main()
