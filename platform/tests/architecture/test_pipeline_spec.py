"""platform/pipeline.yml's spec: every subject declares an SLA and the write mode per layer that
the code uses, its dbt source freshness warns at that SLA, and the hourly heartbeat that checks
it reads public data only."""
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform/publish"))

import heartbeat  # noqa: E402

SUBJECTS = yaml.safe_load((ROOT / "platform/pipeline.yml").read_text(encoding="utf-8"))["subjects"]
KEYS = {"schedule", "sla", "write", "group", "needs", "raw", "features", "prune", "target", "manual",
        "sources", "steps"}
MERGE_BY_PATH = {"merge": ["path"]}


def test_every_subject_declares_an_sla_and_only_known_keys():
    for name, subject in SUBJECTS.items():
        assert set(subject) <= KEYS, f"{name}: unknown {set(subject) - KEYS}"
        assert set(subject["sla"]) == {"fresh_within"}, name
        within = subject["sla"]["fresh_within"]
        if subject.get("manual"):
            assert within == "none", f"{name} runs by hand and promises no freshness"
            continue
        # Longer than the schedule's period, so one run on time never reads as stale.
        period = 24 if subject["schedule"].endswith("* * *") else 7 * 24
        assert heartbeat.duration(within).total_seconds() > period * 3600, name


def test_write_modes_match_what_each_layer_does():
    for name, subject in SUBJECTS.items():
        write = subject["write"]
        assert set(write) <= {"raw", "features", "warehouse", "delivery"}, name
        # pipeline.py push --prune deletes remote raw files that are gone locally; nothing else does.
        if subject.get("raw"):
            assert write["raw"] == ("mirror" if subject.get("prune") else MERGE_BY_PATH), name
        elif subject.get("sources"):
            # An ingest that keeps its own archive in R2, merged by item (news).
            assert set(write["raw"]) == {"merge"} and write["raw"]["merge"], name
        else:
            assert "raw" not in write, name
        assert write.get("features") == (MERGE_BY_PATH if subject.get("features") else None), name
        if any("dbt" in step for step in subject["steps"]):
            assert write["warehouse"] == "overwrite", name
        assert write.get("delivery") == ("versioned" if subject.get("group") else None), name


def test_no_dbt_model_is_incremental():
    """warehouse: overwrite holds only while every model is rebuilt in full."""
    for path in (ROOT / "platform/models").rglob("*.sql"):
        assert not re.search(r"is_incremental|incremental['\"]", path.read_text(encoding="utf-8")), path


def hours(threshold: dict) -> int:
    return threshold["count"] * {"hour": 1, "day": 24}[threshold["period"]]


def test_source_freshness_warns_at_the_subject_sla():
    folders = {"eu_ai_act": "ai_act"}
    found = set()
    for path in (ROOT / "platform/models/bronze").glob("*/*sources.yml"):
        for source in yaml.safe_load(path.read_text(encoding="utf-8"))["sources"]:
            for table in source["tables"]:
                freshness = table.get("config", {}).get("freshness")
                if not freshness:
                    continue
                found.add(path.parent.name)
                subject = SUBJECTS[folders.get(path.parent.name, path.parent.name)]
                sla = heartbeat.duration(subject["sla"]["fresh_within"]).total_seconds() / 3600
                assert hours(freshness["warn_after"]) == sla, (path, table["name"])
                assert hours(freshness["error_after"]) == 2 * sla, (path, table["name"])
                assert table["config"]["loaded_at_field"], (path, table["name"])
    assert {"news", "sfs"} <= found


def test_heartbeat_runs_hourly_with_public_data_only():
    text = (ROOT / ".github/workflows/data-heartbeat.yml").read_text(encoding="utf-8")
    config = yaml.safe_load(text)
    (cron,) = [entry["cron"] for entry in config[True]["schedule"]]
    minute, *rest = cron.split()
    assert rest == ["*"] * 4 and minute.isdigit() and int(minute) % 15, "hourly, off the busy minutes"
    assert config["permissions"] == {"contents": "read", "issues": "write"}
    assert config["concurrency"]["group"] != "data-refresh"
    (job,) = config["jobs"].values()
    assert "environment" not in job and "secrets." not in text
    assert re.search(r"python platform/publish/heartbeat\.py", text)
