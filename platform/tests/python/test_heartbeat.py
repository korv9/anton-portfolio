"""data-heartbeat.yml's decision: a subject past its sla.fresh_within is stale (the issue opens),
a fresh one is not (it closes), and a failed run keeps the time of the last success."""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "publish"))

import heartbeat  # noqa: E402

NOW = datetime(2026, 10, 22, 12, tzinfo=timezone.utc)
INGEST = [{"ingest": "python fetch.py"}, {"dbt": {"select": ["tag:x"]}}]
SUBJECTS = {
    "daily": {"sla": {"fresh_within": "36h"}, "steps": INGEST},
    "weekly": {"sla": {"fresh_within": "8d"}, "steps": INGEST},
    "manual": {"sla": {"fresh_within": "none"}, "steps": INGEST},
    "built_only": {"sla": {"fresh_within": "8d"}, "steps": INGEST[1:]},
}


def status(**subjects):
    return {"subjects": subjects}


def test_a_fresh_status_closes_and_a_stale_one_opens(tmp_path):
    fresh = status(daily={"outcome": "success", "recorded_at": "2026-10-22T04:40:00+00:00"},
                   weekly={"outcome": "success", "recorded_at": "2026-10-17T23:00:00+00:00"})
    assert heartbeat.stale(SUBJECTS, fresh, NOW) == {}
    old = status(daily={"outcome": "success", "recorded_at": "2026-10-20T04:40:00+00:00"},
                 weekly={"outcome": "success", "recorded_at": "2026-10-10T23:00:00+00:00"})
    assert set(heartbeat.stale(SUBJECTS, old, NOW)) == {"daily", "weekly"}
    # The fixture file, as the workflow reads it, prints one Markdown line per stale subject.
    path = tmp_path / "ingestion.json"
    path.write_text(json.dumps(old))
    assert "36h" in heartbeat.stale(SUBJECTS, json.loads(path.read_text()), NOW)["daily"]


def test_a_failed_run_counts_from_the_last_success_and_a_missing_subject_is_stale():
    failed = status(daily={"outcome": "failure", "recorded_at": "2026-10-22T05:00:00+00:00",
                           "last_success_at": "2026-10-19T05:00:00+00:00"},
                    weekly={"outcome": "failure", "recorded_at": "2026-10-18T05:00:00+00:00"})
    found = heartbeat.stale(SUBJECTS, failed, NOW)
    assert "2026-10-19" in found["daily"]
    assert found["weekly"] == "no successful ingestion recorded"
    assert heartbeat.stale(SUBJECTS, status(), NOW).keys() == {"daily", "weekly"}


def test_manual_subjects_and_subjects_without_ingestion_are_not_checked():
    found = heartbeat.stale(SUBJECTS, status(), NOW)
    assert "manual" not in found and "built_only" not in found
    assert heartbeat.duration("36h").total_seconds() == 36 * 3600
    assert heartbeat.duration("8d").days == 8


def test_the_active_release_is_compared_for_every_subject_with_an_sla():
    subjects = {"built": {"sla": {"fresh_within": "8d"}, "group": "weekly", "steps": INGEST[1:]},
                "fed": {"sla": {"fresh_within": "36h"}, "group": "daily", "steps": INGEST},
                "hand": {"sla": {"fresh_within": "none"}, "group": "weekly", "steps": INGEST[1:]},
                "unlisted": {"sla": {"fresh_within": "8d"}, "group": "absent", "steps": INGEST[1:]}}
    ingested = status(fed={"outcome": "success", "recorded_at": "2026-10-22T04:40:00+00:00"})
    current = {"groups": {"weekly": {"published_at": "2026-10-10T00:00:00+00:00"},
                          "daily": {"published_at": "2026-10-19T00:00:00+00:00"}}}
    found = heartbeat.stale(subjects, ingested, NOW, current)
    assert set(found) == {"built", "fed", "unlisted"}
    assert "2026-10-10" in found["built"] and "8d" in found["built"]
    assert "2026-10-19" in found["fed"] and found["unlisted"] == "group absent has no active release"
    current["groups"]["weekly"]["published_at"] = "2026-10-20T00:00:00+00:00"
    current["groups"]["daily"]["published_at"] = "2026-10-22T04:50:00+00:00"
    assert set(heartbeat.stale(subjects, ingested, NOW, current)) == {"unlisted"}
    assert heartbeat.stale(subjects, ingested, NOW) == {}  # no manifest: ingestion only


def test_the_subjects_the_audit_named_are_checked():
    import yaml
    declared = yaml.safe_load((ROOT / "pipeline.yml").read_text(encoding="utf-8"))["subjects"]
    found = heartbeat.stale(declared, status(), NOW, {"groups": {}})
    assert {"clusters", "politics", "concepts", "cross_domain"} <= set(found)
    assert not {n for n, s in declared.items() if s["sla"]["fresh_within"] == "none"} & set(found)
